/**
 * Klienta atskaites saite (Nils 22.11): klients atver savu PDF tīmeklī (telefonā bez pielikuma).
 *
 * - Publiskais ceļš `/{lv|en|de|ru}/atskaite/<token>`; middleware to pārraksta uz iekšējo
 *   `/klienta-atskaite/<locale>/<token>` (savs gaišs izkārtojums bez vietnes galvenes/analītikas).
 * - Tokens 32 baiti (256 biti) crypto random, base64url (43 zīmes). Glabā tikai sha256 hešu.
 * - Derīgums noklusējumā 30 dienas (`CLIENT_REPORT_LINK_TTL_DAYS`, 1-365), atsaucams.
 * - PDF: vienmēr JAUNĀKAIS klientam NOSŪTĪTAIS PDF (nosūtīšana = apstiprinājums). Ja atskaiti
 *   pārsūta (labota versija), tā pati saite rāda jauno versiju. Ceļu nosaka serveris no pasūtījuma
 *   `sessionId` (nekad no pieprasījuma).
 *
 * Šis fails ir tīrs (bez servera atkarībām) - testējams un lietojams arī middleware.
 */

import type { AppLocale } from "@/i18n/locales";

export const CLIENT_REPORT_LINK_PUBLIC_SEGMENT = "atskaite";
export const CLIENT_REPORT_LINK_INTERNAL_PREFIX = "/klienta-atskaite";
export const CLIENT_REPORT_LINK_PDF_API_PREFIX = "/api/atskaite";
export const CLIENT_REPORT_LINK_TOKEN_BYTES = 32;
export const CLIENT_REPORT_LINK_DEFAULT_TTL_DAYS = 30;
/** Cik vēsturisko (atsaukto/beigušos) ierakstu glabāt vienam pasūtījumam. */
export const CLIENT_REPORT_LINK_HISTORY_MAX = 20;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const LOCALES = ["lv", "en", "de", "ru"] as const;

export function isClientReportLinkToken(v: string): boolean {
  return TOKEN_RE.test(v);
}

export function isClientReportLinkHash(v: string): boolean {
  return HASH_RE.test(v);
}

export function clientReportLinkTtlDays(env: Record<string, string | undefined> = process.env): number {
  const n = Number((env.CLIENT_REPORT_LINK_TTL_DAYS ?? "").trim());
  if (!Number.isFinite(n) || n < 1 || n > 365) return CLIENT_REPORT_LINK_DEFAULT_TTL_DAYS;
  return Math.floor(n);
}

export function clientReportLinkPublicPath(locale: AppLocale, token: string): string {
  return `/${locale}/${CLIENT_REPORT_LINK_PUBLIC_SEGMENT}/${token}`;
}

export function clientReportLinkAbsoluteUrl(origin: string, locale: AppLocale, token: string): string {
  return `${origin.replace(/\/+$/, "")}${clientReportLinkPublicPath(locale, token)}`;
}

export function clientReportLinkPdfPath(token: string, download = false): string {
  return `${CLIENT_REPORT_LINK_PDF_API_PREFIX}/${token}${download ? "?dl=1" : ""}`;
}

/** Vai ceļš ir klienta atskaites lapa (publiskā vai iekšējā) - analītikai un galvenēm. */
export function isClientReportLinkPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] ?? "").trim();
  if (p === CLIENT_REPORT_LINK_INTERNAL_PREFIX || p.startsWith(`${CLIENT_REPORT_LINK_INTERNAL_PREFIX}/`)) return true;
  if (p.startsWith(`${CLIENT_REPORT_LINK_PDF_API_PREFIX}/`)) return true;
  return /^\/(lv|en|de|ru)\/atskaite(\/|$)/.test(p);
}

/**
 * `/lv/atskaite/<token>` → `/klienta-atskaite/lv/<token>`. Nederīgu tokenu arī pārraksta
 * (lapa parāda neitrālo «Saite vairs nav derīga»), lai nekas nenonāk vietnes 404 ar galveni.
 */
export function clientReportLinkRewritePath(pathname: string): string | null {
  const m = /^\/(lv|en|de|ru)\/atskaite(?:\/([^/]*))?\/?$/.exec(pathname);
  if (!m) return null;
  const locale = m[1]!;
  const raw = m[2] ?? "";
  const token = isClientReportLinkToken(raw) ? raw : "x";
  return `${CLIENT_REPORT_LINK_INTERNAL_PREFIX}/${locale}/${token}`;
}

export function resolveClientReportLinkLocale(v: string | null | undefined): AppLocale {
  return (LOCALES as readonly string[]).includes(String(v)) ? (v as AppLocale) : "lv";
}

/* ---------- Ieraksti ---------- */

export type ClientReportLinkRecord = {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  /** Lapas valoda, ar kuru saite izveidota. */
  locale: AppLocale;
  /** Nosūtīto versiju skaits izveides brīdī (tikai informācijai adminā). */
  pdfVersionAtCreate?: number;
};

export type ClientReportLinkDoc = {
  sessionId: string;
  links: ClientReportLinkRecord[];
};

export type ClientReportLinkState = "active" | "expired" | "revoked";

export function clientReportLinkState(r: ClientReportLinkRecord, nowMs = Date.now()): ClientReportLinkState {
  if (r.revokedAt) return "revoked";
  const t = Date.parse(r.expiresAt);
  if (!Number.isFinite(t) || t <= nowMs) return "expired";
  return "active";
}

export function isClientReportLinkUsable(r: ClientReportLinkRecord | null | undefined, nowMs = Date.now()): boolean {
  return Boolean(r) && clientReportLinkState(r!, nowMs) === "active";
}

export function activeClientReportLink(
  doc: ClientReportLinkDoc | null | undefined,
  nowMs = Date.now(),
): ClientReportLinkRecord | null {
  const list = doc?.links ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (isClientReportLinkUsable(list[i], nowMs)) return list[i]!;
  }
  return null;
}

function parseRecord(raw: unknown): ClientReportLinkRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tokenHash = typeof o.tokenHash === "string" ? o.tokenHash.trim().toLowerCase() : "";
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const expiresAt = typeof o.expiresAt === "string" ? o.expiresAt : "";
  if (!isClientReportLinkHash(tokenHash) || !createdAt || !expiresAt) return null;
  const v = Number(o.pdfVersionAtCreate);
  return {
    tokenHash,
    createdAt,
    expiresAt,
    locale: resolveClientReportLinkLocale(typeof o.locale === "string" ? o.locale : "lv"),
    ...(typeof o.revokedAt === "string" && o.revokedAt ? { revokedAt: o.revokedAt } : {}),
    ...(Number.isFinite(v) && v > 0 ? { pdfVersionAtCreate: Math.floor(v) } : {}),
  };
}

export function parseClientReportLinkDoc(raw: unknown, sessionId: string): ClientReportLinkDoc {
  const empty: ClientReportLinkDoc = { sessionId, links: [] };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  if (o.sessionId !== sessionId || !Array.isArray(o.links)) return empty;
  return {
    sessionId,
    links: o.links.map(parseRecord).filter((r): r is ClientReportLinkRecord => r != null),
  };
}

/** Atsauc visas aktīvās saites (tīra funkcija). */
export function revokeActiveLinks(doc: ClientReportLinkDoc, nowMs = Date.now()): ClientReportLinkDoc {
  const iso = new Date(nowMs).toISOString();
  return {
    sessionId: doc.sessionId,
    links: doc.links.map((l) => (clientReportLinkState(l, nowMs) === "active" ? { ...l, revokedAt: iso } : l)),
  };
}

/** Jauna saite: vecās aktīvās atsauc (vienā pasūtījumā vienlaikus derīga tikai viena saite). */
export function appendClientReportLink(
  doc: ClientReportLinkDoc,
  rec: ClientReportLinkRecord,
  nowMs = Date.now(),
): ClientReportLinkDoc {
  const revoked = revokeActiveLinks(doc, nowMs);
  const links = [...revoked.links, rec].slice(-CLIENT_REPORT_LINK_HISTORY_MAX);
  return { sessionId: doc.sessionId, links };
}

/* ---------- PDF ceļa aizsardzība ---------- */

function pfx(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

/** Vienīgais pieļautais vienas atskaites Blob ceļš: `<prefix>client-reports/<sessionId>.pdf`. */
export function clientReportPdfBlobPath(prefix: string, sessionId: string): string {
  return `${pfx(prefix)}client-reports/${sessionId}.pdf`;
}

/**
 * Versiju arhīva ceļš (no servera sūtījumu žurnāla) ir derīgs tikai, ja tas ir šī pasūtījuma
 * mapē `<prefix>client-reports/<sessionId>/v<N>-*.pdf` - bez `..`, bez citas mapes.
 */
export function isSafeClientReportArchiveBlobPath(p: string, prefix: string, sessionId: string): boolean {
  const base = `${pfx(prefix)}client-reports/${sessionId}/`;
  if (!p.startsWith(base)) return false;
  const name = p.slice(base.length);
  return /^v\d{1,4}-[A-Za-z0-9._-]{1,130}\.pdf$/i.test(name) && !name.includes("..");
}

/** Lejupielādes nosaukums: tikai drošas zīmes (Content-Disposition). */
export function safeClientReportPdfFilename(name: string | null | undefined): string {
  const base = String(name ?? "")
    .replace(/^v\d+-/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  if (!base || base === ".pdf" || base === "_") return "PROVIN_atskaite.pdf";
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

/** Atbildes galvenes lapai un PDF (bez kešošanas, bez indeksēšanas, bez referrer). */
export const CLIENT_REPORT_LINK_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};

/* ---------- Lapas teksti ---------- */

export type ClientReportLinkCopy = {
  title: string;
  ready: string;
  open: string;
  download: string;
  invalidTitle: string;
  invalidBody: string;
  contacts: string;
  offerEyebrow: string;
  offerTitle: string;
  offerLead: string;
  offerPaid: string;
  offerCharge: string;
  offerTotal: string;
  offerCta: (price: string) => string;
  offerValidUntil: (date: string) => string;
  offerSameOrder: string;
};

export const CLIENT_REPORT_LINK_COPY: Record<AppLocale, ClientReportLinkCopy> = {
  lv: {
    title: "PROVIN atskaite",
    ready: "Atskaite gatava",
    open: "Atvērt PDF",
    download: "Lejupielādēt PDF",
    invalidTitle: "Saite vairs nav derīga",
    invalidBody: "Rakstiet info@provin.lv - nosūtīsim atskaiti vēlreiz.",
    contacts: "Jautājumi",
    offerEyebrow: "Piedāvājums šim auto",
    offerTitle: "Papildiniet līdz pilnam PROVIN AUDITAM",
    offerLead: "Negadījumi, nobraukums, izsoļu arhīvi un risku analīze - tajā pašā pasūtījumā.",
    offerPaid: "Jau samaksāts (dīlera dati)",
    offerCharge: "Piemaksa",
    offerTotal: "Kopā PROVIN AUDITS",
    offerCta: (p) => `Pasūtīt pilno auditu par ${p}`,
    offerValidUntil: (d) => `Saite derīga līdz ${d}`,
    offerSameOrder: "dati paliek tajā pašā pasūtījumā",
  },
  en: {
    title: "PROVIN report",
    ready: "Report ready",
    open: "Open PDF",
    download: "Download PDF",
    invalidTitle: "This link is no longer valid",
    invalidBody: "Write to info@provin.lv and we will send the report again.",
    contacts: "Questions",
    offerEyebrow: "Offer for this car",
    offerTitle: "Upgrade to the full PROVIN AUDIT",
    offerLead: "Accidents, mileage, auction archives and risk analysis - in the same order.",
    offerPaid: "Already paid (dealer data)",
    offerCharge: "Top-up",
    offerTotal: "Total PROVIN AUDITS",
    offerCta: (p) => `Order the full audit for ${p}`,
    offerValidUntil: (d) => `Link valid until ${d}`,
    offerSameOrder: "data stays in the same order",
  },
  de: {
    title: "PROVIN Bericht",
    ready: "Bericht fertig",
    open: "PDF öffnen",
    download: "PDF herunterladen",
    invalidTitle: "Dieser Link ist nicht mehr gültig",
    invalidBody: "Schreiben Sie an info@provin.lv - wir senden den Bericht erneut.",
    contacts: "Fragen",
    offerEyebrow: "Angebot für dieses Auto",
    offerTitle: "Zum vollständigen PROVIN AUDIT erweitern",
    offerLead: "Unfälle, Kilometerstand, Auktionsarchive und Risikoanalyse - in derselben Bestellung.",
    offerPaid: "Bereits bezahlt (Händlerdaten)",
    offerCharge: "Aufpreis",
    offerTotal: "Gesamt PROVIN AUDITS",
    offerCta: (p) => `Vollständiges Audit für ${p} bestellen`,
    offerValidUntil: (d) => `Link gültig bis ${d}`,
    offerSameOrder: "Daten bleiben in derselben Bestellung",
  },
  ru: {
    title: "Отчёт PROVIN",
    ready: "Отчёт готов",
    open: "Открыть PDF",
    download: "Скачать PDF",
    invalidTitle: "Ссылка больше не действительна",
    invalidBody: "Напишите на info@provin.lv - мы отправим отчёт ещё раз.",
    contacts: "Вопросы",
    offerEyebrow: "Предложение для этого авто",
    offerTitle: "Дополните до полного PROVIN AUDITS",
    offerLead: "ДТП, пробег, архивы аукционов и анализ рисков - в том же заказе.",
    offerPaid: "Уже оплачено (данные дилера)",
    offerCharge: "Доплата",
    offerTotal: "Итого PROVIN AUDITS",
    offerCta: (p) => `Заказать полный аудит за ${p}`,
    offerValidUntil: (d) => `Ссылка действительна до ${d}`,
    offerSameOrder: "данные остаются в том же заказе",
  },
};

export const CLIENT_REPORT_PRODUCT_LABEL: Record<"dealer" | "mini" | "audits", Record<AppLocale, string>> = {
  dealer: {
    lv: "Oficiālā dīlera dati",
    en: "Official dealer data",
    ru: "Официальные данные дилера",
    de: "Offizielle Händlerdaten",
  },
  mini: { lv: "PROVIN MINI", en: "PROVIN MINI", ru: "PROVIN MINI", de: "PROVIN MINI" },
  audits: { lv: "PROVIN AUDITS", en: "PROVIN AUDITS", ru: "PROVIN AUDITS", de: "PROVIN AUDITS" },
};

/** DD.MM.YYYY Rīgas laikā. */
export function formatClientReportDate(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(t));
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}`;
}
