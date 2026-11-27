/**
 * Klienta valoda (Nils 27.11): ja klients ienāca caur EN/DE versiju, bet pēc datiem ir no Latvijas -
 * noklusējums LV. Admins var valodu nomainīt pats (pasūtījuma melnrakstā `clientLangOverride`).
 *
 * Tīras funkcijas (bez servera importiem): lieto gan admin UI, gan serveris.
 * Signālos tikai valstu kodi un jau pasūtījumā esošie lauki - IP adrese netiek glabāta.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { parseB2bWalletOrderMarks } from "@/lib/b2b-wallet";
import { isValidPlateNumber, isValidVin, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

/** Servera saglabātie signāli (tikai valstu kodi un numurzīme). */
export type ClientLangStoredSignals = {
  /** Vercel `x-vercel-ip-country` checkout brīdī (Stripe `metadata.ip_country`). */
  ipCountry?: string | null;
  /** Stripe `customer_details.address.country`. */
  billingCountry?: string | null;
  /** Kartes izdevējvalsts (`payment_method.card.country`). */
  cardCountry?: string | null;
  /** Pasūtījuma VIN laukā ievadīta LV numurzīme. */
  orderPlate?: string | null;
};

export type ClientLangSignals = ClientLangStoredSignals & {
  phones?: (string | null | undefined)[];
  emails?: (string | null | undefined)[];
  customerName?: string | null;
  /** Melnraksta `orderEdits.licensePlate` vai cits pasūtījuma numurzīmes lauks. */
  plates?: (string | null | undefined)[];
};

export type ClientLangReason = "billing" | "card" | "ip" | "plate" | "phone" | "email" | "name";

const REASON_WEIGHT: Record<ClientLangReason, number> = {
  billing: 2,
  card: 2,
  ip: 1,
  plate: 1,
  phone: 1,
  email: 1,
  name: 0.5,
};

const REASON_LABEL: Record<ClientLangReason, string> = {
  billing: "maksātājs LV",
  card: "karte LV",
  ip: "IP LV",
  plate: "LV numurs",
  phone: "+371",
  email: ".lv e-pasts",
  name: "vārds",
};

/** Latviešu garumzīmes / mīkstinājumi vārdā (vājš signāls). */
const LV_DIACRITICS = /[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/;

function isLv(country: string | null | undefined): boolean {
  return (country ?? "").trim().toUpperCase() === "LV";
}

function isLvPhone(raw: string | null | undefined): boolean {
  const t = (raw ?? "").replace(/[\s().-]/g, "");
  return /^(?:\+|00)371\d{8}$/.test(t);
}

function isLvEmail(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  const at = t.lastIndexOf("@");
  return at > 0 && t.slice(at + 1).endsWith(".lv");
}

/** Pasūtījuma VIN lauks ir LV numurzīme (nevis VIN). */
export function orderFieldLvPlate(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || isValidVin(normalizeVin(t))) return null;
  return isValidPlateNumber(t) ? normalizePlateNumber(t) : null;
}

/** Latvijas signāli, stiprākie pirmie. */
export function latvianClientReasons(s: ClientLangSignals): ClientLangReason[] {
  const out: ClientLangReason[] = [];
  if (isLv(s.billingCountry)) out.push("billing");
  if (isLv(s.cardCountry)) out.push("card");
  if (isLv(s.ipCountry)) out.push("ip");
  if (orderFieldLvPlate(s.orderPlate) || (s.plates ?? []).some((p) => orderFieldLvPlate(p))) out.push("plate");
  if ((s.phones ?? []).some(isLvPhone)) out.push("phone");
  if ((s.emails ?? []).some(isLvEmail)) out.push("email");
  if (LV_DIACRITICS.test(s.customerName ?? "")) out.push("name");
  return out;
}

/** ≥2 vidēji spēcīgi signāli vai 1 spēcīgs (maksātājs / karte LV); vārds tikai papildina. */
export function isLatvianClient(reasons: ClientLangReason[]): boolean {
  return reasons.reduce((sum, r) => sum + REASON_WEIGHT[r], 0) >= 2;
}

export type ClientLangSource = "partner" | "manual" | "auto_lv" | "site";

export type ClientLangDecision = {
  lang: ClientReportLang;
  source: ClientLangSource;
  /** Tikai `auto_lv`: kāpēc LV. */
  reasons: ClientLangReason[];
  /** Vietnes valoda pasūtot (Stripe `session.locale`; nezināma = LV). */
  siteLang: ClientReportLang;
};

export function normalizeClientLang(raw: string | null | undefined): ClientReportLang | null {
  const t = (raw ?? "").trim().toLowerCase().slice(0, 2);
  return t === "lv" || t === "en" || t === "ru" || t === "de" ? t : null;
}

/**
 * Pasūtījuma klienta valoda:
 * 1) B2B partnera izvēlētā atskaites valoda (`report_lang=` piezīmēs),
 * 2) admina izvēle (`clientLangOverride`),
 * 3) EN/DE vietne, bet klients pēc datiem no Latvijas -> LV (RU paliek RU - apzināta izvēle),
 * 4) vietnes valoda pasūtot, citādi LV.
 */
export function decideOrderClientLang(args: {
  notes?: string | null;
  locale?: string | null;
  override?: string | null;
  signals?: ClientLangSignals | null;
}): ClientLangDecision {
  const siteLang = normalizeClientLang(args.locale) ?? "lv";
  const partner = normalizeClientLang(parseB2bWalletOrderMarks(args.notes ?? "")?.reportLang ?? null);
  if (partner) return { lang: partner, source: "partner", reasons: [], siteLang };
  const manual = normalizeClientLang(args.override);
  if (manual) return { lang: manual, source: "manual", reasons: [], siteLang };
  if ((siteLang === "en" || siteLang === "de") && args.signals) {
    const reasons = latvianClientReasons(args.signals);
    if (isLatvianClient(reasons)) return { lang: "lv", source: "auto_lv", reasons, siteLang };
  }
  return { lang: siteLang, source: "site", reasons: [], siteLang };
}

/** Īss iemesls pie čipa: «LV - pēc: IP LV, LV numurs». */
export function clientLangDecisionLabel(d: ClientLangDecision): string {
  const L = d.lang.toUpperCase();
  if (d.source === "auto_lv") return `${L} - pēc: ${d.reasons.map((r) => REASON_LABEL[r]).join(", ")}`;
  if (d.source === "manual") return `${L} - manuāli`;
  if (d.source === "partner") return `${L} - partneris`;
  return `${L} - vietne`;
}

/** Stripe metadata `ip_country` -> divu burtu kods vai null. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(t) ? t : null;
}

type SessionLike = {
  metadata?: Record<string, string> | null;
  customer_details?: { address?: { country?: string | null } | null } | null;
  payment_intent?: unknown;
};

/** Kartes valsts no izvērsta `payment_intent.payment_method` (ja nav izvērsts - null). */
function cardCountryFromPaymentIntent(pi: unknown): string | null {
  if (!pi || typeof pi !== "object") return null;
  const pm = (pi as { payment_method?: unknown }).payment_method;
  if (!pm || typeof pm !== "object") return null;
  const card = (pm as { card?: { country?: unknown } | null }).card;
  return typeof card?.country === "string" ? normalizeCountryCode(card.country) : null;
}

/** Signāli no Stripe Checkout sesijas (bez papildu API pieprasījumiem). */
export function clientLangSignalsFromSession(session: SessionLike): ClientLangStoredSignals {
  const m = session.metadata ?? {};
  const out: ClientLangStoredSignals = {};
  const ip = normalizeCountryCode(m.ip_country);
  if (ip) out.ipCountry = ip;
  const billing = normalizeCountryCode(session.customer_details?.address?.country ?? null);
  if (billing) out.billingCountry = billing;
  const card = cardCountryFromPaymentIntent(session.payment_intent);
  if (card) out.cardCountry = card;
  const plate = orderFieldLvPlate(m.vin);
  if (plate) out.orderPlate = plate;
  return out;
}

/** Saglabātie signāli no nezināma JSON (klienta modelis / kešs). */
export function parseClientLangStoredSignals(raw: unknown): ClientLangStoredSignals | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  const out: ClientLangStoredSignals = {};
  const ip = normalizeCountryCode(s(o.ipCountry));
  if (ip) out.ipCountry = ip;
  const billing = normalizeCountryCode(s(o.billingCountry));
  if (billing) out.billingCountry = billing;
  const card = normalizeCountryCode(s(o.cardCountry));
  if (card) out.cardCountry = card;
  const plate = orderFieldLvPlate(s(o.orderPlate));
  if (plate) out.orderPlate = plate;
  return Object.keys(out).length > 0 ? out : null;
}

type OrderLike = {
  notes?: string | null;
  locale?: string | null;
  vin?: string | null;
  customerEmail?: string | null;
  customerDetailsEmail?: string | null;
  phone?: string | null;
  customerDetailsPhone?: string | null;
  customerName?: string | null;
  clientLangSignals?: ClientLangStoredSignals | null;
};

type DraftLike = {
  orderEdits?: {
    notes?: string;
    clientLangOverride?: string;
    customerEmail?: string;
    customerPhone?: string;
    customerName?: string;
    licensePlate?: string;
  };
} | null;

/** Serverim: pasūtījums (`getCheckoutSessionDetail`) + melnraksts -> klienta valoda. */
export function decideClientLangForOrder(order: OrderLike | null | undefined, draft?: DraftLike): ClientLangDecision {
  const e = draft?.orderEdits;
  return decideOrderClientLang({
    notes: e?.notes || order?.notes,
    locale: order?.locale,
    override: e?.clientLangOverride,
    signals: {
      ...(order?.clientLangSignals ?? {}),
      plates: [e?.licensePlate, order?.vin],
      phones: [e?.customerPhone, order?.phone, order?.customerDetailsPhone],
      emails: [e?.customerEmail, order?.customerEmail, order?.customerDetailsEmail],
      customerName: e?.customerName || order?.customerName || null,
    },
  });
}

/**
 * Checkout: valsts no Vercel galvenes `x-vercel-ip-country` Stripe metadata laukam `ip_country`.
 * Saglabā tikai divu burtu valsts kodu - IP adresi ne.
 */
export function checkoutIpCountryMetadata(headers: Pick<Headers, "get">): { ip_country?: string } {
  const c = normalizeCountryCode(headers.get("x-vercel-ip-country"));
  return c ? { ip_country: c } : {};
}
