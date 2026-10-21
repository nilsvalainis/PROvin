import { AUDIT_PREPARATION_URGENT_MS, auditDeadlineMs } from "@/lib/admin-audit-deadline";
import type { AuditResultColor } from "@/lib/admin-audit-result-color";

/** Telefona koncepta filtru etiķetes (desktop paliek Zaļš / Oranžs / Sarkans). */
export const ADMIN_MOBILE_AUDIT_FILTER_LABEL: Record<AuditResultColor | "all" | "none", string> = {
  all: "Visi",
  green: "Labi",
  orange: "Jāpēta",
  red: "Riski",
  none: "Bez",
};

export const ADMIN_MOBILE_ORDER_SECTIONS = [
  { id: "admin-m-sec-kopsavilkums", label: "Kopsavilkums", wizard: 0 },
  { id: "admin-m-sec-avoti", label: "Avoti", wizard: 1 },
  { id: "admin-m-sec-negadijumi", label: "Negadījumi", wizard: 2 },
  { id: "admin-m-sec-nobraukums", label: "Nobraukums", wizard: 1 },
  { id: "admin-m-sec-foto", label: "Foto", wizard: 12 },
  { id: "admin-m-sec-komentari", label: "Komentāri", wizard: 13 },
] as const;

export type AdminMobileOrderSectionId = (typeof ADMIN_MOBILE_ORDER_SECTIONS)[number]["id"];

/** Pasūtījuma doks: VIN SCAN tikai bezmaksas avoti (nekad auto-run maksas). */
export const ADMIN_MOBILE_VIN_SCAN_EVENT = "provin-admin-mobile-vin-scan";

export const ADMIN_MOBILE_PAID_SOURCE_KEYS = ["autodna", "carvertical", "auto_records", "oneauto", "asv"] as const;

export const ADMIN_MOBILE_SOURCE_STATUS = {
  loaded: "Ielādēts",
  pending: "Vēl nav",
  empty: "Nav datu",
  error: "Kļūda",
  paid: "Maksas",
} as const;

export type AdminMobileSourceStatus = keyof typeof ADMIN_MOBILE_SOURCE_STATUS;

export const ADMIN_MOBILE_ICON_URL = {
  meklet: "/admin-mobile/icons/meklet.svg",
  pasutijumi: "/admin-mobile/icons/pasutijumi.svg",
  vinParbaude: "/admin-mobile/icons/vin-parbaude.svg",
  atrie: "/admin-mobile/icons/atrie.svg",
  vairak: "/admin-mobile/icons/vairak.svg",
  pievienot: "/admin-mobile/icons/pievienot.svg",
  aizvert: "/admin-mobile/icons/aizvert.svg",
  atpakal: "/admin-mobile/icons/atpakal.svg",
  uzPrieksu: "/admin-mobile/icons/uz-prieksu.svg",
  izverst: "/admin-mobile/icons/izverst.svg",
  saklaut: "/admin-mobile/icons/saklaut.svg",
  atzime: "/admin-mobile/icons/atzime.svg",
  pulkstenis: "/admin-mobile/icons/pulkstenis.svg",
  ielade: "/admin-mobile/icons/ielade.svg",
  saite: "/admin-mobile/icons/saite.svg",
  atvertAvotu: "/admin-mobile/icons/atvert-avotu.svg",
  kopet: "/admin-mobile/icons/kopet.svg",
  pdf: "/admin-mobile/icons/pdf.svg",
  kamera: "/admin-mobile/icons/kamera.svg",
  rits: "/admin-mobile/icons/rits.svg",
  saglabats: "/admin-mobile/icons/saglabats.svg",
  navSaglabats: "/admin-mobile/icons/nav-saglabats.svg",
  kartot: "/admin-mobile/icons/kartot.svg",
  filtri: "/admin-mobile/icons/filtri.svg",
  iziet: "/admin-mobile/icons/iziet.svg",
  partneri: "/admin-mobile/icons/partneri.svg",
  dileri: "/admin-mobile/icons/dileri.svg",
  rekini: "/admin-mobile/icons/rekini.svg",
  statistika: "/admin-mobile/icons/statistika.svg",
  avatar: "/admin-mobile/icons/auto.svg",
  avotsIeladets: "/admin-mobile/icons/avots-ieladets.svg",
  avotsGaida: "/admin-mobile/icons/avots-gaida.svg",
  avotsTukss: "/admin-mobile/icons/avots-tukss.svg",
  avotsKluda: "/admin-mobile/icons/avots-kluda.svg",
  avotsMaksas: "/admin-mobile/icons/avots-maksas.svg",
  pavadzimes: "/admin-mobile/icons/pavadzimes.svg",
  radars: "/admin-mobile/icons/radars.svg",
  logistika: "/admin-mobile/icons/logistika.svg",
  sludinajums: "/admin-mobile/icons/sludinajums.svg",
  atskaite: "/admin-mobile/icons/atskaite.svg",
  iestatijumi: "/admin-mobile/icons/iestatijumi.svg",
  labot: "/admin-mobile/icons/labot.svg",
  komentars: "/admin-mobile/icons/komentars.svg",
} as const;

export type AdminMobileIconName = keyof typeof ADMIN_MOBILE_ICON_URL;

export function adminMobileIconUrl(name: AdminMobileIconName): string {
  return ADMIN_MOBILE_ICON_URL[name];
}

export type AdminMobileDeadlineTag = { label: string; tone: "overdue" | "urgent" | "ok" | "done" };

/**
 * Pasūtījuma kartītes termiņa birka telefonā: "Atlikušas 12 h", "Kavē 5 h", "Kavē 6 d", "Gatavs".
 * Negatīvas stundas ("-3625 h") nav saprotamas, tāpēc kavējumu rāda vārdiski, no 48 h dienās.
 */
export function formatAdminMobileDeadlineTag(
  createdUnixSec: number,
  opts: { complete?: boolean; nowMs?: number } = {},
): AdminMobileDeadlineTag {
  if (opts.complete) return { label: "Gatavs", tone: "done" };
  const nowMs = opts.nowMs ?? Date.now();
  const remainingMs = auditDeadlineMs(createdUnixSec) - nowMs;
  const hourMs = 60 * 60 * 1000;
  if (remainingMs <= 0) {
    const overdueH = Math.max(1, Math.ceil(Math.abs(remainingMs) / hourMs));
    const label = overdueH >= 48 ? `Kavē ${Math.floor(overdueH / 24)} d` : `Kavē ${overdueH} h`;
    return { label, tone: "overdue" };
  }
  if (remainingMs < hourMs) {
    return { label: `Atlikušas ${Math.max(1, Math.round(remainingMs / 60_000))} min`, tone: "urgent" };
  }
  const h = Math.max(1, Math.round(remainingMs / hourMs));
  return { label: `Atlikušas ${h} h`, tone: remainingMs <= AUDIT_PREPARATION_URGENT_MS ? "urgent" : "ok" };
}

/** Koncepta stūra birka: „44 h”. */
export function formatAdminMobileDeadlineHours(createdUnixSec: number, nowMs = Date.now()): string {
  const remainingMs = auditDeadlineMs(createdUnixSec) - nowMs;
  if (remainingMs <= 0) {
    const overdueH = Math.max(1, Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000)));
    return `-${overdueH} h`;
  }
  const h = Math.max(1, Math.round(remainingMs / (60 * 60 * 1000)));
  return `${h} h`;
}

export function adminMobileAuditFilterLabel(key: AuditResultColor | "all" | "none"): string {
  return ADMIN_MOBILE_AUDIT_FILTER_LABEL[key];
}

export function isAdminMobilePaidSourceKey(key: string): boolean {
  return (ADMIN_MOBILE_PAID_SOURCE_KEYS as readonly string[]).includes(key);
}

export function adminMobileSourceStatusIcon(status: AdminMobileSourceStatus): AdminMobileIconName {
  if (status === "loaded") return "avotsIeladets";
  if (status === "pending") return "avotsGaida";
  if (status === "empty") return "avotsTukss";
  if (status === "error") return "avotsKluda";
  return "avotsMaksas";
}

const WAYBILL_HOURS_RE = /(\d+(?:[.,]\d+)?)\s*h\b/i;
const WAYBILL_CODE_RE = /\b([A-Z]?\d{2,4}[-/]?\d+)\b/;

export function formatIrissWaybillChip(input: {
  code?: string | null;
  makeModel?: string | null;
  hoursLeft?: number | null;
  label?: string | null;
}): string {
  const fromLabel = (input.label ?? "").trim();
  const hours =
    input.hoursLeft != null && Number.isFinite(input.hoursLeft)
      ? `${Math.max(0, Math.round(input.hoursLeft))} h`
      : (WAYBILL_HOURS_RE.exec(fromLabel)?.[0] ?? "");
  const code = (input.code ?? "").trim() || WAYBILL_CODE_RE.exec(fromLabel)?.[1] || "";
  const make = (input.makeModel ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  const parts = [code, make, hours].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return fromLabel;
}

export function irissWaybillUrgent(hoursLeft: number | null | undefined, label?: string | null): boolean {
  if (hoursLeft != null && Number.isFinite(hoursLeft)) return hoursLeft < 24;
  const m = WAYBILL_HOURS_RE.exec(label ?? "");
  if (!m) return false;
  return Number.parseFloat(m[1].replace(",", ".")) < 24;
}

/** Telefona rādījums: `+371 28 782 68`. */
export function formatAdminMobilePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D+/g, "");
  if (!digits) return (raw ?? "").trim();
  const national = digits.startsWith("371") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (national.length < 7) return raw?.trim() || digits;
  const a = national.slice(0, 2);
  const b = national.slice(2, 5);
  const c = national.slice(5);
  return `+371 ${a} ${b} ${c}`.trim();
}

/** Ātro vērtējumu neitrālais laika tags: `20 h`. */
export function formatAdminMobileHoursLabel(remainingMs: number): string {
  if (!Number.isFinite(remainingMs)) return "0 h";
  if (remainingMs <= 0) {
    const overdueH = Math.max(1, Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000)));
    return `-${overdueH} h`;
  }
  const h = Math.max(1, Math.round(remainingMs / (60 * 60 * 1000)));
  return `${h} h`;
}
