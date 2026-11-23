/**
 * «Izsoļu arhīvs dīlera datu vietā» (Nils 23.11.2026, viss variants A).
 *
 * Kad OneAuto dīlera datu nav, bet izsoļu arhīvā (TheCarApi vai manuāli pievienots avots) ir auto ar
 * bildēm, klientam piedāvājam izvēli: (1) nomainīt dīlera atskaiti pret izsoļu arhīvu (bez piemaksas)
 * vai (2) atgriezt naudu. Bez klienta izvēles neko nesūtām; PDF sūta Nils, atmaksu veic Nils.
 *
 * - Publiskais ceļš `/{lv|en|de|ru}/izvele/<token>`; middleware pārraksta uz `/izsoles-izvele/<locale>/<token>`.
 * - Tokens 32 baiti (256 biti), glabā tikai sha256 hešu; derīgs 30 dienas.
 * - Saite TIKAI atver lapu (e-pasta skeneri atver saites!) - izvēli fiksē tikai POST «Apstiprināt».
 *
 * Šis fails ir tīrs (bez servera atkarībām) - testējams un lietojams middleware.
 */
import type { AppLocale } from "@/i18n/locales";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

export const AUCTION_ARCHIVE_PUBLIC_SEGMENT = "izvele";
export const AUCTION_ARCHIVE_INTERNAL_PREFIX = "/izsoles-izvele";
export const AUCTION_ARCHIVE_API_PREFIX = "/api/izvele";
export const AUCTION_ARCHIVE_TTL_DAYS = 30;
/** Neatbild 3 dienas -> atgādinājums TIKAI Nilam (Nila lēmums 3A). */
export const AUCTION_ARCHIVE_REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
/** E-pastā 2 izplūdinātas bildes (Nila lēmums 5A). */
export const AUCTION_ARCHIVE_PREVIEW_MAX = 2;
export const AUCTION_ARCHIVE_HISTORY_MAX = 40;
export const AUCTION_ARCHIVE_MANUAL_SOURCES_MAX = 10;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const PHOTO_ID_RE = /^ih_ph_[a-f0-9]{24}$/;
const LOCALES = ["lv", "en", "de", "ru"] as const;

export function isAuctionArchiveToken(v: string): boolean {
  return TOKEN_RE.test(v);
}

export function isAuctionArchiveHash(v: string): boolean {
  return HASH_RE.test(v);
}

export function resolveAuctionArchiveLocale(v: string | null | undefined): AppLocale {
  return (LOCALES as readonly string[]).includes(String(v)) ? (v as AppLocale) : "lv";
}

export function auctionArchivePublicPath(locale: AppLocale, token: string): string {
  return `/${locale}/${AUCTION_ARCHIVE_PUBLIC_SEGMENT}/${token}`;
}

export function auctionArchiveAbsoluteUrl(origin: string, locale: AppLocale, token: string): string {
  return `${origin.replace(/\/+$/, "")}${auctionArchivePublicPath(locale, token)}`;
}

/** Izplūdinātā priekšskatījuma bilde e-pastam (n = 0..1). */
export function auctionArchivePreviewPath(token: string, n: number): string {
  return `${AUCTION_ARCHIVE_API_PREFIX}/${token}/foto/${n}`;
}

/** Vai ceļš ir izvēles lapa / tās API - analītikai, robots un galvenēm (tokens URL). */
export function isAuctionArchivePath(pathname: string): boolean {
  const p = (pathname.split("?")[0] ?? "").trim();
  if (p === AUCTION_ARCHIVE_INTERNAL_PREFIX || p.startsWith(`${AUCTION_ARCHIVE_INTERNAL_PREFIX}/`)) return true;
  if (p.startsWith(`${AUCTION_ARCHIVE_API_PREFIX}/`)) return true;
  return /^\/(lv|en|de|ru)\/izvele(\/|$)/.test(p);
}

/** `/lv/izvele/<token>` → `/izsoles-izvele/lv/<token>`. Nederīgs tokens → neitrālā lapa (nevis vietnes 404). */
export function auctionArchiveRewritePath(pathname: string): string | null {
  const m = /^\/(lv|en|de|ru)\/izvele(?:\/([^/]*))?\/?$/.exec(pathname);
  if (!m) return null;
  const raw = m[2] ?? "";
  return `${AUCTION_ARCHIVE_INTERNAL_PREFIX}/${m[1]!}/${isAuctionArchiveToken(raw) ? raw : "x"}`;
}

/** Galvenes lapai, POST atbildei un bildēm. */
export const AUCTION_ARCHIVE_HEADERS: Readonly<Record<string, string>> = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};

/* ---------- Statusi ---------- */

export const AUCTION_ARCHIVE_STATUSES = [
  "pending",
  "chose_archive",
  "chose_refund",
  "archive_sent",
  "refunded",
  "withdrawn",
] as const;
export type AuctionArchiveStatus = (typeof AUCTION_ARCHIVE_STATUSES)[number];
export type AuctionArchiveChoice = "archive" | "refund";
export type AuctionArchiveChannel = "email" | "whatsapp";
export type AuctionArchiveChoiceVia = "link" | "manual";

/** Admin saraksta / pasūtījuma statusa teksts (makets 5. solis). */
export const AUCTION_ARCHIVE_STATUS_LV: Record<AuctionArchiveStatus, string> = {
  pending: "Gaida klienta izvēli",
  chose_archive: "Izvēlējās arhīvu - jāsūta PDF",
  chose_refund: "Izvēlējās atmaksu",
  archive_sent: "Arhīvs nosūtīts",
  refunded: "Atmaksāts",
  withdrawn: "Piedāvājums atsaukts",
};

export type AuctionArchiveTone = "wait" | "todo" | "alert" | "done" | "muted";

/** «Izvēlējās atmaksu» sarkans līdz atmaksai (makets). */
export const AUCTION_ARCHIVE_STATUS_TONE: Record<AuctionArchiveStatus, AuctionArchiveTone> = {
  pending: "wait",
  chose_archive: "todo",
  chose_refund: "alert",
  archive_sent: "done",
  refunded: "done",
  withdrawn: "muted",
};

export function isAuctionArchiveStatus(v: unknown): v is AuctionArchiveStatus {
  return typeof v === "string" && (AUCTION_ARCHIVE_STATUSES as readonly string[]).includes(v);
}

/** Vai klients vēl drīkst izvēlēties / mainīt izvēli (kamēr PDF nav nosūtīts un atmaksa nav veikta). */
export function isAuctionArchiveChoiceOpen(status: AuctionArchiveStatus): boolean {
  return status === "pending" || status === "chose_archive" || status === "chose_refund";
}

export function statusForChoice(choice: AuctionArchiveChoice): AuctionArchiveStatus {
  return choice === "archive" ? "chose_archive" : "chose_refund";
}

export function isAuctionArchiveChoice(v: unknown): v is AuctionArchiveChoice {
  return v === "archive" || v === "refund";
}

/* ---------- Kopsavilkums ---------- */

export type AuctionArchiveAuction = {
  /** `site:id` vai `manual:<n>`. */
  key: string;
  /** YYYY-MM-DD (tukšs, ja nav). */
  date: string;
  /** «Openlane», «BCA», … */
  platform: string;
  /** Valsts nosaukums latviski (bez koda). */
  country: string;
  km: number | null;
  priceEur: number | null;
  photos: number;
};

export type AuctionArchiveManualSource = {
  kind: "link" | "pdf";
  label: string;
  /** Saite (tikai https) - adminam; klientam nerāda. */
  url?: string;
};

export type AuctionArchiveSummary = {
  vin: string;
  title: string;
  auctions: AuctionArchiveAuction[];
  photoCount: number;
  manualSources: AuctionArchiveManualSource[];
};

const PLATFORM_NAMES: Record<string, string> = {
  openlane: "Openlane",
  openline: "Openlane",
  adesa: "Openlane",
  bca: "BCA",
  auto1: "AUTO1",
  autobid: "Autobid",
  ecarstrade: "eCarsTrade",
  caronsale: "CarOnSale",
  copart: "Copart",
  iaai: "IAAI",
  manheim: "Manheim",
  vwfs: "VWFS",
  ayvens: "Ayvens",
};

export function auctionPlatformName(site: string, venue = ""): string {
  const s = site.trim().toLowerCase();
  if (PLATFORM_NAMES[s]) return PLATFORM_NAMES[s]!;
  const v = venue.trim();
  if (v) return v.slice(0, 60);
  return s ? s.charAt(0).toUpperCase() + s.slice(1, 40) : "Izsole";
}

function fieldValue(record: ThecarapiAdminRecord, keys: readonly string[]): string {
  for (const key of keys) {
    const hit = record.fields.find((field) => field.key === key);
    if (hit?.value.trim()) return hit.value.trim();
  }
  return "";
}

function parseIntLoose(raw: string, max: number): number | null {
  const n = Number(raw.replace(/[^\d.,]/g, "").replace(/[.,](\d{1,2})$/, "").replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 && n < max ? Math.round(n) : null;
}

function isoDay(raw: string): string {
  const s = raw.trim();
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1]!;
  const lv = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
  return lv ? `${lv[3]}-${lv[2]}-${lv[1]}` : "";
}

/** Latviskais valsts nosaukums: «Itālija (IT)» → «Itālija». Kods → nosaukums, ja dots `countryName`. */
function cleanCountry(raw: string, countryName?: (code: string) => string): string {
  const v = raw.trim();
  if (!v) return "";
  const named = countryName && /^[A-Za-z]{2}$/.test(v) ? countryName(v) : v;
  return named.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim().slice(0, 60);
}

/** Izsoles ieraksts ir piedāvājama vērtība (lauki vai bildes). */
export function isUsefulThecarapiRecord(r: ThecarapiAdminRecord): boolean {
  return r.fields.length > 0 || r.photos.length > 0 || r.photoUrls.length > 0;
}

/**
 * Bilžu skaits vienam ierakstam: saglabātās + vēl nesaglabātās CDN saites (bez dublikātiem pēc URL).
 */
export function thecarapiRecordPhotoCount(r: ThecarapiAdminRecord): number {
  const urls = new Set<string>();
  let n = 0;
  for (const p of r.photos) {
    n += 1;
    if (p.sourceUrl) urls.add(p.sourceUrl);
  }
  for (const u of r.photoUrls) if (u && !urls.has(u)) {
    urls.add(u);
    n += 1;
  }
  return n;
}

export function sanitizeManualSources(raw: unknown): AuctionArchiveManualSource[] {
  if (!Array.isArray(raw)) return [];
  const out: AuctionArchiveManualSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kind = o.kind === "pdf" ? "pdf" : o.kind === "link" ? "link" : null;
    if (!kind) continue;
    const label = String(o.label ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 120);
    const urlRaw = String(o.url ?? "").trim();
    let url: string | undefined;
    if (urlRaw) {
      try {
        const u = new URL(urlRaw);
        if (u.protocol === "https:") url = u.toString().slice(0, 500);
      } catch {
        url = undefined;
      }
    }
    if (!label && !url) continue;
    out.push({ kind, label: label || (url ? new URL(url).hostname : "Avots"), ...(url ? { url } : {}) });
    if (out.length >= AUCTION_ARCHIVE_MANUAL_SOURCES_MAX) break;
  }
  return out;
}

/**
 * Kopsavilkums no «Izsoļu portālu arhīvs» bloka (TheCarApi ieraksti + manuāli pievienotās bilžu grupas)
 * un manuāli pievienotajiem avotiem (checkcar.vin u.c.). Hronoloģiski (vecākais pirmais).
 */
export function buildAuctionArchiveSummary(args: {
  vin: string;
  title: string;
  block: Pick<CcVinBlockState, "thecarapiRecords" | "photoGroups"> | null | undefined;
  manualSources?: readonly AuctionArchiveManualSource[];
  countryName?: (code: string) => string;
}): AuctionArchiveSummary {
  const records = (args.block?.thecarapiRecords ?? []).filter(isUsefulThecarapiRecord);
  const auctions: AuctionArchiveAuction[] = [];
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  let photoCount = 0;
  for (const r of records) {
    for (const p of r.photos) {
      if (p.sourceUrl) seenUrls.add(p.sourceUrl);
      if (p.contentHash) seenHashes.add(p.contentHash.toLowerCase());
    }
    for (const u of r.photoUrls) if (u) seenUrls.add(u);
    const photos = thecarapiRecordPhotoCount(r);
    photoCount += photos;
    auctions.push({
      key: `${(r.site || "thecarapi").toLowerCase()}:${r.id}`.slice(0, 120),
      date: isoDay(r.photoDate || r.date || fieldValue(r, ["auction_date", "sale_date", "end_date", "last_seen_at"])),
      platform: auctionPlatformName(r.site, r.venue),
      country: cleanCountry(fieldValue(r, ["country", "country_code", "car_country_extended"]), args.countryName),
      km: parseIntLoose(fieldValue(r, ["mileage", "odometer"]), 5_000_000),
      priceEur: parseIntLoose(fieldValue(r, ["public_price_eur", "final_price", "current_final", "current_price", "start_price"]), 10_000_000),
      photos,
    });
  }
  // Manuāli pievienotās bilžu grupas (checkcar.vin u.c.) - bez TheCarApi kopijām pasūtījuma mapē.
  let manualPhotos = 0;
  for (const g of args.block?.photoGroups ?? []) {
    for (const p of g.photos ?? []) {
      if (p.sourceUrl && seenUrls.has(p.sourceUrl)) continue;
      if (p.contentHash && seenHashes.has(p.contentHash.toLowerCase())) continue;
      manualPhotos += 1;
    }
  }
  photoCount += manualPhotos;
  auctions.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  return {
    vin: args.vin,
    title: args.title.trim().slice(0, 120),
    auctions,
    photoCount,
    manualSources: [...(args.manualSources ?? [])],
  };
}

/** Situācija «Izsoļu arhīvs» redzama, ja ir izsoļu ieraksti vai manuāli pievienots avots. */
export function isAuctionArchiveEligible(summary: AuctionArchiveSummary): boolean {
  return summary.auctions.length > 0 || summary.manualSources.length > 0 || summary.photoCount > 0;
}

export function auctionArchiveYears(summary: AuctionArchiveSummary): string[] {
  return [...new Set(summary.auctions.map((a) => a.date.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)))].sort();
}

export function auctionArchiveCountries(summary: AuctionArchiveSummary): string[] {
  return [...new Set(summary.auctions.map((a) => a.country).filter(Boolean))];
}

export function auctionArchivePlatforms(summary: AuctionArchiveSummary): string[] {
  return [...new Set(summary.auctions.map((a) => a.platform).filter(Boolean))];
}

export function auctionArchiveMaxKm(summary: AuctionArchiveSummary): number | null {
  const km = summary.auctions.map((a) => a.km).filter((n): n is number => n != null);
  return km.length ? Math.max(...km) : null;
}

/** «2 izsoles», «1 izsole», «21 izsole» (latviešu skaitļa forma). */
export function lvCount(n: number, one: string, many: string): string {
  const one_ = n % 10 === 1 && n % 100 !== 11;
  return `${n} ${one_ ? one : many}`;
}

/** «193 320 km». */
export function formatKm(n: number | null): string {
  return n == null ? "" : `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}

/** «13 070 €». */
export function formatEurWhole(n: number | null): string {
  return n == null ? "" : `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
}

/** DD.MM.YYYY no YYYY-MM-DD. */
export function formatIsoDayLv(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/* ---------- Dokuments (piedāvājums pasūtījumā) ---------- */

export type AuctionArchiveEvent =
  | "offer_sent"
  | "choice"
  | "manual_choice"
  | "archive_sent"
  | "refunded"
  | "withdrawn"
  | "admin_reminded"
  | "client_reminded";

export type AuctionArchiveHistoryRow = {
  at: string;
  event: AuctionArchiveEvent;
  choice?: AuctionArchiveChoice;
  channel?: AuctionArchiveChannel;
};

/** Pasūtījuma kopija vienai bildei (privātais Blob `auction_archive_offers/<sessionId>/photos/<id>.jpg`). */
export type AuctionArchivePhoto = {
  id: string;
  /** Kura izsole (`AuctionArchiveAuction.key`) vai `manual`. */
  auctionKey: string;
  date: string;
  caption: string;
};

export const AUCTION_ARCHIVE_MARK_ZONES = ["front", "rear", "left", "right", "roof"] as const;
export type AuctionArchiveMarkZone = (typeof AUCTION_ARCHIVE_MARK_ZONES)[number];

/** Operatora atzīme «Redzams bildē» (izsole bojājumus nenorādīja, bet bildē tie redzami). */
export type AuctionArchiveOperatorMark = {
  auctionKey: string;
  zone: AuctionArchiveMarkZone;
  part?: string;
  note?: string;
};

export const AUCTION_ARCHIVE_MARKS_MAX = 20;

export function sanitizeOperatorMarks(raw: unknown): AuctionArchiveOperatorMark[] {
  if (!Array.isArray(raw)) return [];
  const clean = (v: unknown, max: number) =>
    String(v ?? "")
      .replace(/[\u0000-\u001f<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  const out: AuctionArchiveOperatorMark[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const zone = o.zone as AuctionArchiveMarkZone;
    if (!(AUCTION_ARCHIVE_MARK_ZONES as readonly string[]).includes(String(zone))) continue;
    const auctionKey = clean(o.auctionKey, 120);
    if (!auctionKey) continue;
    const part = clean(o.part, 60);
    const note = clean(o.note, 200);
    out.push({ auctionKey, zone, ...(part ? { part } : {}), ...(note ? { note } : {}) });
    if (out.length >= AUCTION_ARCHIVE_MARKS_MAX) break;
  }
  return out;
}

export type AuctionArchiveOfferDoc = {
  sessionId: string;
  status: AuctionArchiveStatus;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  locale: AppLocale;
  channel: AuctionArchiveChannel;
  /** Samaksātā summa centos (atmaksai). */
  paidCents: number | null;
  summary: AuctionArchiveSummary;
  /** Visas izsoles bildes, saglabātas pie mums (Openlane saites beidzas). */
  photos: AuctionArchivePhoto[];
  /** Cik bilžu neizdevās saglabāt (CDN vairs nedod). */
  photosMissing: number;
  /** Izvēlētās bildes e-pasta priekšskatījumam (izplūdinātas serverī). */
  previewIds: string[];
  /** Operatora atzīmes PDF bojājumu shēmā. */
  marks: AuctionArchiveOperatorMark[];
  choice?: AuctionArchiveChoice;
  choiceAt?: string;
  choiceVia?: AuctionArchiveChoiceVia;
  archiveSentAt?: string;
  refundedAt?: string;
  withdrawnAt?: string;
  adminRemindedAt?: string;
  /** Automātiskais atgādinājums klientam (vienreiz, tas pats kanāls - tikai e-pasts). */
  clientRemindedAt?: string;
  /** Atgādinājuma saites tokena hešs (otra derīgā saite; pirmā saite arī strādā). */
  reminderTokenHash?: string;
  /** E-pasts, uz kuru aizgāja piedāvājums (atgādinājumam - tas pats saņēmējs). */
  sentTo?: string;
  /** «Rādīt izsoļu cenas» (Nils 23.11, lēmums 4): pēc noklusējuma NErāda tekstos un PDF. */
  showPrices?: boolean;
  history: AuctionArchiveHistoryRow[];
};

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseAuction(raw: unknown): AuctionArchiveAuction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = str(o.key, 120);
  if (!key) return null;
  const photos = num(o.photos);
  return {
    key,
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(o.date, 10)) ? str(o.date, 10) : "",
    platform: str(o.platform, 60),
    country: str(o.country, 60),
    km: num(o.km),
    priceEur: num(o.priceEur),
    photos: photos != null && photos >= 0 ? Math.floor(photos) : 0,
  };
}

function parseSummary(raw: unknown, fallbackVin: string): AuctionArchiveSummary {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const count = num(o.photoCount);
  return {
    vin: str(o.vin, 17) || fallbackVin,
    title: str(o.title, 120),
    auctions: (Array.isArray(o.auctions) ? o.auctions : []).map(parseAuction).filter((a): a is AuctionArchiveAuction => a != null),
    photoCount: count != null && count >= 0 ? Math.floor(count) : 0,
    manualSources: sanitizeManualSources(o.manualSources),
  };
}

function parsePhoto(raw: unknown): AuctionArchivePhoto | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id, 40);
  if (!PHOTO_ID_RE.test(id)) return null;
  return { id, auctionKey: str(o.auctionKey, 120), date: str(o.date, 40), caption: str(o.caption, 160) };
}

const EVENTS: readonly AuctionArchiveEvent[] = [
  "offer_sent",
  "choice",
  "manual_choice",
  "archive_sent",
  "refunded",
  "withdrawn",
  "admin_reminded",
  "client_reminded",
];

function parseHistory(raw: unknown): AuctionArchiveHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AuctionArchiveHistoryRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const at = str(o.at, 40);
    if (!at || !EVENTS.includes(o.event as AuctionArchiveEvent)) continue;
    out.push({
      at,
      event: o.event as AuctionArchiveEvent,
      ...(isAuctionArchiveChoice(o.choice) ? { choice: o.choice } : {}),
      ...(o.channel === "email" || o.channel === "whatsapp" ? { channel: o.channel } : {}),
    });
  }
  return out.slice(-AUCTION_ARCHIVE_HISTORY_MAX);
}

export function parseAuctionArchiveOfferDoc(raw: unknown, sessionId: string): AuctionArchiveOfferDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.sessionId !== sessionId) return null;
  const tokenHash = str(o.tokenHash, 64).toLowerCase();
  if (!isAuctionArchiveHash(tokenHash) || !isAuctionArchiveStatus(o.status)) return null;
  const photos = (Array.isArray(o.photos) ? o.photos : []).map(parsePhoto).filter((p): p is AuctionArchivePhoto => p != null);
  const ids = new Set(photos.map((p) => p.id));
  const paid = num(o.paidCents);
  const missing = num(o.photosMissing);
  const opt = (k: string) => (str(o[k], 40) ? { [k]: str(o[k], 40) } : {});
  return {
    sessionId,
    status: o.status,
    tokenHash,
    createdAt: str(o.createdAt, 40),
    expiresAt: str(o.expiresAt, 40),
    locale: resolveAuctionArchiveLocale(str(o.locale, 4)),
    channel: o.channel === "whatsapp" ? "whatsapp" : "email",
    paidCents: paid != null && paid >= 0 ? Math.round(paid) : null,
    summary: parseSummary(o.summary, ""),
    photos,
    photosMissing: missing != null && missing > 0 ? Math.floor(missing) : 0,
    previewIds: (Array.isArray(o.previewIds) ? o.previewIds : [])
      .filter((v): v is string => typeof v === "string" && ids.has(v))
      .slice(0, AUCTION_ARCHIVE_PREVIEW_MAX),
    marks: sanitizeOperatorMarks(o.marks),
    ...(isAuctionArchiveChoice(o.choice) ? { choice: o.choice } : {}),
    ...opt("choiceAt"),
    ...(o.choiceVia === "link" || o.choiceVia === "manual" ? { choiceVia: o.choiceVia } : {}),
    ...opt("archiveSentAt"),
    ...opt("refundedAt"),
    ...opt("withdrawnAt"),
    ...opt("adminRemindedAt"),
    ...opt("clientRemindedAt"),
    ...(isAuctionArchiveHash(str(o.reminderTokenHash, 64).toLowerCase()) ? { reminderTokenHash: str(o.reminderTokenHash, 64).toLowerCase() } : {}),
    ...(/^[^\s@<>]{1,64}@[^\s@<>]{1,190}$/.test(str(o.sentTo, 254)) ? { sentTo: str(o.sentTo, 254) } : {}),
    ...(o.showPrices === true ? { showPrices: true } : {}),
    history: parseHistory(o.history),
  } as AuctionArchiveOfferDoc;
}

function pushHistory(doc: AuctionArchiveOfferDoc, row: AuctionArchiveHistoryRow): AuctionArchiveHistoryRow[] {
  return [...doc.history, row].slice(-AUCTION_ARCHIVE_HISTORY_MAX);
}

export function isAuctionArchiveLinkActive(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): boolean {
  if (doc.status === "withdrawn") return false;
  const t = Date.parse(doc.expiresAt);
  return Number.isFinite(t) && t > nowMs;
}

export type ChoiceResult =
  | { ok: true; doc: AuctionArchiveOfferDoc; changed: boolean }
  | { ok: false; error: "closed" | "expired" };

/**
 * Klienta (saite) vai Nila (manuāli «1/2») izvēle. Mainīt drīkst, kamēr PDF nav nosūtīts
 * un atmaksa nav veikta. Tā pati izvēle atkārtoti = bez izmaiņām (nav jauna paziņojuma).
 */
export function applyAuctionArchiveChoice(
  doc: AuctionArchiveOfferDoc,
  choice: AuctionArchiveChoice,
  via: AuctionArchiveChoiceVia,
  nowMs = Date.now(),
): ChoiceResult {
  if (!isAuctionArchiveChoiceOpen(doc.status)) return { ok: false, error: "closed" };
  if (via === "link" && !isAuctionArchiveLinkActive(doc, nowMs)) return { ok: false, error: "expired" };
  if (doc.choice === choice && doc.status === statusForChoice(choice)) return { ok: true, doc, changed: false };
  const at = new Date(nowMs).toISOString();
  return {
    ok: true,
    changed: true,
    doc: {
      ...doc,
      status: statusForChoice(choice),
      choice,
      choiceAt: at,
      choiceVia: via,
      history: pushHistory(doc, { at, event: via === "link" ? "choice" : "manual_choice", choice }),
    },
  };
}

/** PDF nosūtīts (PR2: sūtīšanas logs ar situāciju «Izsoļu arhīvs - gatavs»). */
export function markAuctionArchiveSent(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): AuctionArchiveOfferDoc {
  const at = new Date(nowMs).toISOString();
  return { ...doc, status: "archive_sent", archiveSentAt: at, history: pushHistory(doc, { at, event: "archive_sent" }) };
}

/** Atmaksu veic Nils esošajā ceļā; šeit tikai atzīme (vai Stripe atmaksas konstatējums). */
export function markAuctionArchiveRefunded(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): AuctionArchiveOfferDoc {
  const at = new Date(nowMs).toISOString();
  return { ...doc, status: "refunded", refundedAt: at, history: pushHistory(doc, { at, event: "refunded" }) };
}

/** Atsaukt piedāvājumu (saite vairs nedarbojas). 26.10 LAW: ko var izveidot, to var arī noņemt. */
export function withdrawAuctionArchiveOffer(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): AuctionArchiveOfferDoc {
  const at = new Date(nowMs).toISOString();
  return { ...doc, status: "withdrawn", withdrawnAt: at, history: pushHistory(doc, { at, event: "withdrawn" }) };
}

/** Atgādinājums Nilam: piedāvājums nosūtīts ≥3 d. atpakaļ, klients nav izvēlējies, vēl nav atgādināts. */
export function isAuctionArchiveReminderDue(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): boolean {
  if (doc.status !== "pending" || doc.adminRemindedAt) return false;
  const t = Date.parse(doc.createdAt);
  return Number.isFinite(t) && nowMs - t >= AUCTION_ARCHIVE_REMIND_AFTER_MS;
}

export function markAuctionArchiveReminded(
  doc: AuctionArchiveOfferDoc,
  nowMs = Date.now(),
  opts: { reminderTokenHash?: string } = {},
): AuctionArchiveOfferDoc {
  const at = new Date(nowMs).toISOString();
  return {
    ...doc,
    adminRemindedAt: at,
    ...(opts.reminderTokenHash ? { reminderTokenHash: opts.reminderTokenHash } : {}),
    history: pushHistory(doc, { at, event: "admin_reminded" }),
  };
}

/**
 * Klienta atgādinājums (Nils 23.11, lēmums 3 = A+B): vienreiz, tikai e-pasta piedāvājumam, tikai kamēr
 * klients nav izvēlējies, piedāvājums nav atsaukts un saite derīga. WhatsApp - tikai Nilam ar gatavu tekstu.
 */
export function isAuctionArchiveClientReminderAllowed(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): boolean {
  return doc.channel === "email" && doc.status === "pending" && !doc.clientRemindedAt && isAuctionArchiveLinkActive(doc, nowMs);
}

export function markAuctionArchiveClientReminded(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): AuctionArchiveOfferDoc {
  const at = new Date(nowMs).toISOString();
  return { ...doc, clientRemindedAt: at, history: pushHistory(doc, { at, event: "client_reminded", channel: "email" }) };
}

/** Admin skats bez tokena heša. */
export type AuctionArchiveOfferPublic = Omit<AuctionArchiveOfferDoc, "tokenHash" | "reminderTokenHash"> & {
  statusLabel: string;
  tone: AuctionArchiveTone;
  linkActive: boolean;
};

export function auctionArchiveOfferForAdmin(doc: AuctionArchiveOfferDoc, nowMs = Date.now()): AuctionArchiveOfferPublic {
  const { tokenHash: _omit, reminderTokenHash: _omit2, ...rest } = doc;
  void _omit;
  void _omit2;
  return {
    ...rest,
    statusLabel: AUCTION_ARCHIVE_STATUS_LV[doc.status],
    tone: AUCTION_ARCHIVE_STATUS_TONE[doc.status],
    linkActive: isAuctionArchiveLinkActive(doc, nowMs),
  };
}

/* ---------- Admina paziņojums ---------- */

export function auctionArchiveAdminNotice(args: {
  kind: "choice" | "reminder";
  choice?: AuctionArchiveChoice;
  title: string;
  vin: string;
  refundLabel?: string;
  /** Kas notika ar klienta atgādinājumu: e-pasts aizgāja / neizdevās / WhatsApp (tikai Nilam). */
  client?: "email_sent" | "email_failed" | "whatsapp";
}): { title: string; body: string } {
  const car = [args.title, args.vin].filter(Boolean).join(" · ");
  if (args.kind === "reminder") {
    const tail =
      args.client === "email_sent"
        ? "Klientam automātiski nosūtīts atgādinājums e-pastā."
        : args.client === "email_failed"
          ? "Klienta atgādinājums e-pastā NEIZDEVĀS - atgādini pats."
          : args.client === "whatsapp"
            ? "Piedāvājums bija WhatsApp - gatavs teksts e-pastā, nosūti pats."
            : "Atzīmē manuāli vai atgādini.";
    return { title: "Klients 3 dienas nav izvēlējies", body: `${car} - izsoļu arhīvs vai atmaksa? ${tail}` };
  }
  if (args.choice === "refund") {
    return {
      title: "Klients izvēlējās atmaksu",
      body: `${car} - jāatmaksā${args.refundLabel ? ` ${args.refundLabel}` : ""}`,
    };
  }
  return { title: "Klients izvēlējās izsoļu arhīvu", body: `${car} - jāsūta PDF` };
}

/* ---------- Izvēles lapas teksti ---------- */

export type AuctionArchiveCopy = {
  pageTitle: string;
  heading: string;
  optArchive: string;
  optArchiveHint: (auctions: string, photos: string) => string;
  optRefund: (amount: string) => string;
  optRefundHint: string;
  confirm: string;
  contacts: string;
  invalidTitle: string;
  invalidBody: string;
  thanksArchiveTitle: string;
  thanksArchiveBody: string;
  thanksRefundTitle: string;
  thanksRefundBody: (amount: string) => string;
  change: string;
  changeHintArchive: string;
  changeHintRefund: string;
  closedArchive: string;
  closedRefund: string;
  pickOne: string;
  auctions: (n: number) => string;
  photos: (n: number) => string;
  refundFallback: string;
};

export const AUCTION_ARCHIVE_COPY: Record<AppLocale, AuctionArchiveCopy> = {
  lv: {
    pageTitle: "PROVIN - izvēle",
    heading: "Izvēlieties, kā turpināt",
    optArchive: "Nomainīt uz izsoļu arhīvu",
    optArchiveHint: (a, p) => `Bez piemaksas · ${a} · ${p} · PDF 24 h laikā`,
    optRefund: () => "Atgriezt naudu",
    optRefundHint: "uz karti, ar kuru maksājāt",
    confirm: "Apstiprināt",
    contacts: "Jautājumi",
    invalidTitle: "Saite vairs nav derīga",
    invalidBody: "Rakstiet info@provin.lv vai zvaniet +371 29 502 039 - palīdzēsim.",
    thanksArchiveTitle: "Paldies - izvēle saņemta",
    thanksArchiveBody: "Izsoļu arhīvu sagatavosim un nosūtīsim uz Jūsu e-pastu 24 stundu laikā. Piemaksa nav jāveic.",
    thanksRefundTitle: "Atmaksa pieteikta",
    thanksRefundBody: (a) => `${a} atgriezīsim uz karti 1 darba dienas laikā. Bankā nauda parasti parādās 5-10 darba dienās.`,
    change: "Mainīt izvēli",
    changeHintArchive: "Izvēli var mainīt, kamēr PDF nav nosūtīts.",
    changeHintRefund: "Izvēli var mainīt, kamēr atmaksa nav veikta.",
    closedArchive: "Izsoļu arhīvs jau nosūtīts uz Jūsu e-pastu.",
    closedRefund: "Atmaksa jau veikta.",
    pickOne: "Izvēlieties vienu no variantiem.",
    auctions: (n) => lvCount(n, "izsole", "izsoles"),
    photos: (n) => lvCount(n, "bilde", "bildes"),
    refundFallback: "Samaksāto summu",
  },
  en: {
    pageTitle: "PROVIN - your choice",
    heading: "Choose how to continue",
    optArchive: "Switch to the auction archive",
    optArchiveHint: (a, p) => `No extra charge · ${a} · ${p} · PDF within 24 h`,
    optRefund: () => "Refund",
    optRefundHint: "to the card you paid with",
    confirm: "Confirm",
    contacts: "Questions",
    invalidTitle: "This link is no longer valid",
    invalidBody: "Write to info@provin.lv or call +371 29 502 039 - we will help.",
    thanksArchiveTitle: "Thank you - choice received",
    thanksArchiveBody: "We will prepare the auction archive and send it to your e-mail within 24 hours. No extra payment.",
    thanksRefundTitle: "Refund requested",
    thanksRefundBody: (a) => `We will refund ${a} to your card within 1 business day. Banks usually show it in 5-10 business days.`,
    change: "Change choice",
    changeHintArchive: "You can change your choice until the PDF is sent.",
    changeHintRefund: "You can change your choice until the refund is made.",
    closedArchive: "The auction archive has already been sent to your e-mail.",
    closedRefund: "The refund has already been made.",
    pickOne: "Please choose one option.",
    auctions: (n) => `${n} ${n === 1 ? "auction" : "auctions"}`,
    photos: (n) => `${n} ${n === 1 ? "photo" : "photos"}`,
    refundFallback: "The amount paid",
  },
  de: {
    pageTitle: "PROVIN - Ihre Wahl",
    heading: "Wählen Sie, wie es weitergeht",
    optArchive: "Zum Auktionsarchiv wechseln",
    optArchiveHint: (a, p) => `Ohne Aufpreis · ${a} · ${p} · PDF innerhalb von 24 h`,
    optRefund: () => "Geld zurück",
    optRefundHint: "auf die Karte, mit der Sie bezahlt haben",
    confirm: "Bestätigen",
    contacts: "Fragen",
    invalidTitle: "Dieser Link ist nicht mehr gültig",
    invalidBody: "Schreiben Sie an info@provin.lv oder rufen Sie +371 29 502 039 an.",
    thanksArchiveTitle: "Danke - Auswahl erhalten",
    thanksArchiveBody: "Wir senden das Auktionsarchiv innerhalb von 24 Stunden an Ihre E-Mail. Kein Aufpreis.",
    thanksRefundTitle: "Rückerstattung angefordert",
    thanksRefundBody: (a) => `${a} erstatten wir innerhalb von 1 Werktag auf Ihre Karte. Bei der Bank meist nach 5-10 Werktagen sichtbar.`,
    change: "Auswahl ändern",
    changeHintArchive: "Änderung möglich, bis das PDF gesendet ist.",
    changeHintRefund: "Änderung möglich, bis die Rückerstattung erfolgt ist.",
    closedArchive: "Das Auktionsarchiv wurde bereits an Ihre E-Mail gesendet.",
    closedRefund: "Die Rückerstattung ist bereits erfolgt.",
    pickOne: "Bitte wählen Sie eine Option.",
    auctions: (n) => `${n} ${n === 1 ? "Auktion" : "Auktionen"}`,
    photos: (n) => `${n} ${n === 1 ? "Foto" : "Fotos"}`,
    refundFallback: "Den bezahlten Betrag",
  },
  ru: {
    pageTitle: "PROVIN - выбор",
    heading: "Выберите, как продолжить",
    optArchive: "Заменить на архив аукционов",
    optArchiveHint: (a, p) => `Без доплаты · ${a} · ${p} · PDF в течение 24 ч`,
    optRefund: () => "Вернуть деньги",
    optRefundHint: "на карту, которой вы платили",
    confirm: "Подтвердить",
    contacts: "Вопросы",
    invalidTitle: "Ссылка больше не действительна",
    invalidBody: "Напишите на info@provin.lv или позвоните +371 29 502 039 - поможем.",
    thanksArchiveTitle: "Спасибо - выбор получен",
    thanksArchiveBody: "Подготовим архив аукционов и отправим на ваш e-mail в течение 24 часов. Доплата не нужна.",
    thanksRefundTitle: "Возврат оформлен",
    thanksRefundBody: (a) => `${a} вернём на карту в течение 1 рабочего дня. В банке деньги обычно видны через 5-10 рабочих дней.`,
    change: "Изменить выбор",
    changeHintArchive: "Выбор можно изменить, пока PDF не отправлен.",
    changeHintRefund: "Выбор можно изменить, пока возврат не сделан.",
    closedArchive: "Архив аукционов уже отправлен на ваш e-mail.",
    closedRefund: "Возврат уже сделан.",
    pickOne: "Выберите один из вариантов.",
    auctions: (n) => `аукционов: ${n}`,
    photos: (n) => `фото: ${n}`,
    refundFallback: "Оплаченную сумму",
  },
};

/** «24,99 €» no centiem (bez atkarības no order-upsell, lai middleware paliek viegls). */
export function formatEurCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return "";
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}
