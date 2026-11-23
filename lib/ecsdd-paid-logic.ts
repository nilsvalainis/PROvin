import { CSDD_FORM_STRUCTURED_FIELDS, type CsddFormFields } from "@/lib/admin-source-blocks";
import { isCsddApiLockedKey } from "@/lib/csdd-field-lock";
import { applyCsddPdfImportToForm } from "@/lib/csdd-paste-parse";
import { isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/**
 * CSDD maksas izziņa (1,50 € ar SMS) - tīrā loģika (klients + serveris): SMS saite, ko meklēt, izziņas ievietošana CSDD blokā.
 * Relejs (`relay/provin-ecsdd`) tikai nolasa e.csdd "Sagatavot īsziņu" saiti; SMS sūta un maksā Nils savā telefonā.
 */

export type EcsddPaidSms = { number: string; body: string };

/** Apple (iPhone / Mac Ziņas) saprot `sms:NUM&body=`, pārējie - `sms:NUM?body=`. */
export function buildSmsHref(sms: EcsddPaidSms, platform: "apple" | "other" = "apple"): string {
  const num = sms.number.replace(/[^\d+]/g, "");
  return `sms:${num}${platform === "apple" ? "&" : "?"}body=${encodeURIComponent(sms.body)}`;
}

export function smsPlatformFromUserAgent(ua: string | null | undefined): "apple" | "other" {
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua ?? "") ? "apple" : "other";
}

/** Numurs, ko relejs pieņem: personalizēts numurs 2-8 burti/cipari ar vismaz vienu burtu. */
export function isEcsddPlate(raw: string | null | undefined): boolean {
  const p = normalizePlateNumber(raw ?? "");
  return /^[A-Z0-9]{2,8}$/.test(p) && /[A-Z]/.test(p);
}

/**
 * Pēc kā prasīt maksas izziņu: numurs (izziņa un SMS ir pēc numura), citādi VIN (e.csdd pats parāda numuru).
 */
export function resolvePaidQuery(csdd: CsddFormFields | null | undefined, orderVinOrPlate?: string | null): string | null {
  for (const raw of [csdd?.registry?.data?.registrationNumber, csdd?.registrationNumber, orderVinOrPlate]) {
    if (isEcsddPlate(raw)) return normalizePlateNumber(raw ?? "");
  }
  for (const raw of [orderVinOrPlate, csdd?.registry?.data?.vin, csdd?.vin]) {
    const v = normalizeVin(raw ?? "");
    if (isValidVin(v)) return v;
  }
  return null;
}

/** Releja atbilde `sms-link` (pēc Vercel API). */
export type EcsddPaidSmsLinkResult =
  | { status: "ok"; number: string; body: string; price?: string; vehicle?: string; plate?: string }
  | { status: "needs_login"; loginStarted?: boolean; verificationCode?: string; sessionState?: string }
  | { status: "not_found" | "no_button" | "not_configured" | "unreachable" }
  | { status: "error"; code?: string };

export type EcsddPaidReportResult =
  | { status: "found"; rawText: string; fields: CsddFormFields; paidAt?: string; plate?: string }
  | { status: "pending" | "no_button" | "not_configured" | "unreachable" }
  | { status: "needs_login"; sessionState?: string }
  | { status: "error"; code?: string };

const PAID_ERROR_LV: Record<string, string> = {
  not_found: "e.csdd šo numuru neatrada",
  no_button: "e.csdd nerāda maksas izziņas pogu",
  not_configured: "e.csdd relejs nav pieslēgts",
  unreachable: "e.csdd relejs nav sasniedzams",
  captcha: "e.csdd prasa captcha",
  page_changed: "e.csdd lapa mainījusies",
  unavailable: "e.csdd nav pieejams",
  invalid_query: "Nav numura vai VIN",
};

export function ecsddPaidErrorLv(code: string | undefined): string {
  return (code && PAID_ERROR_LV[code]) || "e.csdd pieprasījums neizdevās";
}

function isArrayRicher(a: unknown, b: unknown): boolean {
  return Array.isArray(a) && Array.isArray(b) && a.length > b.length;
}

/**
 * Maksas izziņa CSDD blokā: tas pats ceļš kā PDF augšupielāde (`applyCsddPdfImportToForm`, API lauki aizsargāti),
 * bet ar roku aizpildītie (netukšie) lauki un garākas ar roku papildinātas tabulas paliek.
 */
export function applyCsddPaidReportToForm(current: CsddFormFields, fields: CsddFormFields, rawText: string): CsddFormFields {
  const imported = applyCsddPdfImportToForm(current, fields, rawText);
  const out: CsddFormFields = { ...imported };
  for (const { key } of CSDD_FORM_STRUCTURED_FIELDS) {
    const cur = current[key];
    // API bloķētos laukus jau nokārtoja `protectCsddApiFields` (konflikts -> ikona); pārējie ar roku ievadītie paliek.
    if (current.registry && isCsddApiLockedKey(key)) continue;
    if (typeof cur === "string" && cur.trim()) (out as Record<string, unknown>)[key] = cur;
  }
  for (const key of ["mileageHistory", "technicalInspectionHistory", "ownerRegistrationEvents"] as const) {
    if (isArrayRicher(current[key], imported[key])) (out as Record<string, unknown>)[key] = current[key];
  }
  return out;
}

/** Cik ilgi un cik bieži admin gaida apmaksāto izziņu. */
export const PAID_POLL_INTERVAL_MS = 20_000;
export const PAID_POLL_TOTAL_MS = 10 * 60_000;

/** "Sūtīt automātiski": viens pieprasījums = viena SMS (Nila iPhone Īsceļš). */
export type EcsddAutoSmsRecord = {
  id: string;
  number: string;
  body: string;
  plate: string;
  createdAt: string;
  emailedAt?: string;
  /** Īsceļš paņēma ar "Iegūt URL saturu" - otrreiz neatdod. */
  consumedAt?: string;
};

/** SMS numurs (īsais vai pilnais) un teksts "CSDD <kods> <numurs>" - cits saturs netiek sūtīts. */
export function isValidAutoSms(sms: { number?: unknown; body?: unknown; plate?: unknown }): boolean {
  const num = typeof sms.number === "string" ? sms.number : "";
  const body = typeof sms.body === "string" ? sms.body.trim() : "";
  const plate = typeof sms.plate === "string" ? sms.plate.toUpperCase() : "";
  const m = body.match(/^CSDD \d{1,10} ([A-Z0-9]{2,8})$/);
  return /^\+?\d{3,15}$/.test(num) && Boolean(m) && m?.[1] === plate;
}

export function parseAutoSmsRecord(raw: unknown): EcsddAutoSmsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const rec = {
    id: s(o.id, 80) ?? "",
    number: s(o.number, 20) ?? "",
    body: s(o.body, 80) ?? "",
    plate: s(o.plate, 12) ?? "",
    createdAt: s(o.createdAt, 40) ?? "",
    ...(s(o.emailedAt, 40) ? { emailedAt: s(o.emailedAt, 40) } : {}),
    ...(s(o.consumedAt, 40) ? { consumedAt: s(o.consumedAt, 40) } : {}),
  };
  return rec.id && isValidAutoSms(rec) ? rec : null;
}

/**
 * Vai jauns "Sūtīt automātiski" drīkst sūtīt e-pastu: tas pats `id` -> nē (dubultklikšķis / atkārtots tīkls);
 * tas pats SMS teksts pēdējās 2 min -> nē (otra cilne).
 */
export function autoSmsDecision(prev: EcsddAutoSmsRecord | null, next: { id: string; body: string }, now: Date): "send" | "duplicate" {
  if (!prev) return "send";
  // Neizdevies e-pasts (nav `emailedAt`) pēc 30 s drīkst mēģināt vēlreiz.
  if (!prev.emailedAt && now.getTime() - Date.parse(prev.createdAt) > 30_000) return "send";
  if (prev.id === next.id) return "duplicate";
  if (prev.body === next.body && now.getTime() - Date.parse(prev.createdAt) < 2 * 60_000) return "duplicate";
  return "send";
}

/** Īsceļa "Iegūt URL saturu": neizmantots pieprasījums, ne vecāks par 10 min. */
export function autoSmsTakeable(rec: EcsddAutoSmsRecord | null, now: Date): boolean {
  return Boolean(rec && !rec.consumedAt && now.getTime() - Date.parse(rec.createdAt) <= PAID_POLL_TOTAL_MS);
}
