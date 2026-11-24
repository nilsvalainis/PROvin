/**
 * Klienta PDF 1. lapas augšdaļa - Nila apstiprinātais makets «6a · Kartītes vienā rindā» (24.11.2026).
 * Atturīgs PROVIN stils: balts, grafīts, plānas līnijas, liela foto; bez krāsu laukiem un čipiem.
 * Sarkans teksts tikai riskam, «Nav datu» pelēkā. Teksti uzreiz atskaites valodā (LV/EN/RU/DE),
 * izņemot avotu kartīšu vērtības, kuras tulko esošais atskaites tulkojums (tāpat kā līdz šim).
 *
 * LIKUMS (Nils 24.11): kartīšu kārtojumā vienmēr simetrija - līdz 5 vienā rindā, vairāk - vienādās rindās
 * (6 = 3 + 3, 8 = 4 + 4, 9 = 3 + 3 + 3); ja vienādas rindas nav iespējamas, īsākā rinda pielīdzināta
 * kreisajai malai ar to pašu kartītes izmēru (Nils 24.11: necentrēt). Teksts kartītēs nelūst - burtu izmērs pielāgojas.
 */

import type { ClientReportLang } from "@/lib/client-report-i18n";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import { ccVinSaleRowHasData } from "@/lib/cc-vin-report";
import { PDF_DEALER_LOGO_DATA_URI } from "@/lib/pdf-source-brand-logo-data";
import { pdfDealerBrandFileKey } from "@/lib/pdf-source-brand-logos";
import { PDF_SOURCE_LOGO_SVG, type PdfSourceLogoKey } from "@/lib/pdf-source-logo-svgs";
import type { PdfSummaryTile } from "@/lib/pdf-report-summary";

/**
 * Avotu logo tonis. `null` - oriģinālās zīmolu krāsas (Nila izvēle 24.11, noklusējums);
 * piem. `"#48484a"` - visi logo vienā pelēkā tonī. Vienīgā vieta, kur to pārslēgt.
 */
export const PDF_SOURCE_LOGO_TONE: string | null = null;

/** Lapas satura platums px (A4 ar atskaites malām) - burtu izmēra pielāgošanai. */
const CONTENT_W = 700;
const CARD_GAP = 10;
const CARD_PAD_X = 14;

// ---------------------------------------------------------------------------------------------
// Teksti

type Lang = ClientReportLang;
type T4 = Record<Lang, string>;

const TXT = {
  vehicle: { lv: "Transportlīdzeklis", en: "Vehicle", ru: "Транспортное средство", de: "Fahrzeug" },
  odometer: { lv: "Pēdējais odometra rādījums", en: "Latest odometer reading", ru: "Последние показания одометра", de: "Letzter Kilometerstand" },
  age: { lv: "Vecums", en: "Age", ru: "Возраст", de: "Alter" },
  firstReg: { lv: "Pirmā reģistrācija", en: "First registration", ru: "Первая регистрация", de: "Erstzulassung" },
  keyInfo: { lv: "Galvenā informācija", en: "Key information", ru: "Основная информация", de: "Wichtigste Informationen" },
  incidents: { lv: "Bojājumi", en: "Damage", ru: "Повреждения", de: "Schäden" },
  mileage: { lv: "Odometrs", en: "Odometer", ru: "Одометр", de: "Kilometerstand" },
  owners: { lv: "Īpašnieki", en: "Owners", ru: "Владельцы", de: "Halter" },
  auctions: { lv: "Izsoles", en: "Auctions", ru: "Аукционы", de: "Auktionen" },
  service: { lv: "Serviss", en: "Service", ru: "Сервис", de: "Service" },
  mileageOk: { lv: "Bez neatbilstībām", en: "No discrepancies", ru: "Без расхождений", de: "Ohne Abweichungen" },
  mileageRollback: { lv: "Nobraukuma kritums", en: "Mileage decrease", ru: "Снижение пробега", de: "Rückgang km-Stand" },
  mileageListingBelow: { lv: "Sludinājumā mazāk", en: "Lower in listing", ru: "В объявлении меньше", de: "Im Inserat weniger" },
  noData: { lv: "Nav datu", en: "No data", ru: "Нет данных", de: "Keine Daten" },
  auctionsNone: { lv: "Nav atrastas", en: "None found", ru: "Не найдены", de: "Keine gefunden" },
  auctionsNoneNote: { lv: "Izsoļu arhīvos nav ierakstu", en: "No auction archive records", ru: "Записей в архивах аукционов нет", de: "Keine Einträge in Auktionsarchiven" },
  serviceLatest: { lv: "Pēdējais", en: "Latest", ru: "Последний", de: "Letzter" },
  photoAuction: { lv: "Izsoles foto", en: "Auction photo", ru: "Фото с аукциона", de: "Auktionsfoto" },
  photoListing: { lv: "Sludinājuma foto", en: "Listing photo", ru: "Фото из объявления", de: "Inseratsfoto" },
  photoNone: { lv: "Foto nav pieejams", en: "No photo available", ru: "Фото недоступно", de: "Kein Foto verfügbar" },
  auctionAt: { lv: "{v} izsole", en: "{v} auction", ru: "аукцион {v}", de: "Auktion {v}" },
  srcPaid: { lv: "Maksas vēstures atskaites", en: "Paid history reports", ru: "Платные отчёты об истории", de: "Kostenpflichtige Historienberichte" },
  srcPublic: { lv: "Publiskas Eiropas datubāzes", en: "Public European databases", ru: "Публичные европейские базы данных", de: "Öffentliche europäische Datenbanken" },
  srcOther: { lv: "Citi avoti", en: "Other sources", ru: "Другие источники", de: "Weitere Quellen" },
  srcTotal: { lv: "Kopā", en: "Total", ru: "Всего", de: "Gesamt" },
  srcChecked: { lv: "Pārbaudīts", en: "Checked", ru: "Проверено", de: "Geprüft" },
  catRegistry: { lv: "Valsts reģistrs", en: "National registry", ru: "Государственный регистр", de: "Staatliches Register" },
  catHistory: { lv: "Vēstures atskaite", en: "History report", ru: "Отчёт об истории", de: "Historienbericht" },
  catDealer: { lv: "Oficiālā dīlera dati", en: "Official dealer data", ru: "Официальные данные дилера", de: "Offizielle Händlerdaten" },
  catAuctions: { lv: "Izsoļu arhīvs", en: "Auction archive", ru: "Архив аукционов", de: "Auktionsarchiv" },
  catInsurance: { lv: "Apdrošināšanas dati", en: "Insurance data", ru: "Данные страховщиков", de: "Versicherungsdaten" },
  catOther: { lv: "Cits avots", en: "Other source", ru: "Другой источник", de: "Weitere Quelle" },
  kindFull: { lv: "Transportlīdzekļa audits", en: "Vehicle audit", ru: "Аудит транспортного средства", de: "Fahrzeug-Audit" },
  kindBusinessSub: { lv: "Datu atskaite", en: "Data report", ru: "Отчёт по данным", de: "Datenbericht" },
  kindDealer: { lv: "Oficiālā dīlera dati", en: "Official dealer data", ru: "Официальные данные дилера", de: "Offizielle Händlerdaten" },
  kindAsv: { lv: "ASV vēsture", en: "US history", ru: "История в США", de: "US-Historie" },
} satisfies Record<string, T4>;

export type PdfTopTextKey = keyof typeof TXT;

export function isPdfTopTextKey(key: string): key is PdfTopTextKey {
  return Object.prototype.hasOwnProperty.call(TXT, key);
}

export function pdfTopText(key: PdfTopTextKey, lang: Lang): string {
  return TXT[key][lang] ?? TXT[key].lv;
}

/** «PROVIN atskaites ģenerēšanā izmantotie avoti» - zīmols vārda vietā katrā valodā. */
function sourcesHeadingHtml(lang: Lang, wordmark: string): string {
  if (lang === "en") return `Sources used for the ${wordmark} report`;
  if (lang === "ru") return `Источники, использованные в отчёте ${wordmark}`;
  if (lang === "de") return `Für den ${wordmark}-Bericht verwendete Quellen`;
  return `${wordmark} atskaites ģenerēšanā izmantotie avoti`;
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function lvOne(n: number): boolean {
  return n % 10 === 1 && n % 100 !== 11;
}

/** «18 rādījumi» */
export function pdfTopReadingsLabel(n: number, lang: Lang): string {
  if (lang === "en") return `${n} ${n === 1 ? "reading" : "readings"}`;
  if (lang === "ru") return `${n} ${pluralRu(n, "показание", "показания", "показаний")}`;
  if (lang === "de") return `${n} ${n === 1 ? "Messwert" : "Messwerte"}`;
  return `${n} ${lvOne(n) ? "rādījums" : "rādījumi"}`;
}

/** «1 izsole» */
export function pdfTopAuctionsLabel(n: number, lang: Lang): string {
  if (lang === "en") return `${n} ${n === 1 ? "auction" : "auctions"}`;
  if (lang === "ru") return `${n} ${pluralRu(n, "аукцион", "аукциона", "аукционов")}`;
  if (lang === "de") return `${n} ${n === 1 ? "Auktion" : "Auktionen"}`;
  return `${n} ${lvOne(n) ? "izsole" : "izsoles"}`;
}

/** «6 ieraksti»; 0 - «Pārbaudīts». */
export function pdfTopRecordsLabel(n: number, lang: Lang): string {
  if (n <= 0) return pdfTopText("srcChecked", lang);
  if (lang === "en") return `${n} ${n === 1 ? "record" : "records"}`;
  if (lang === "ru") return `${n} ${pluralRu(n, "запись", "записи", "записей")}`;
  if (lang === "de") return `${n} ${n === 1 ? "Eintrag" : "Einträge"}`;
  return `${n} ${lvOne(n) ? "ieraksts" : "ieraksti"}`;
}

/** «5 g. 11 mēn.» */
export function pdfTopAgeLabel(firstRegMs: number, nowMs: number, lang: Lang): string {
  if (!(firstRegMs > 0) || nowMs < firstRegMs) return "";
  const a = new Date(firstRegMs);
  const b = new Date(nowMs);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  if (months < 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const U: Record<Lang, [string, string]> = {
    lv: ["g.", "mēn."],
    en: ["yrs", "mos"],
    ru: ["г.", "мес."],
    de: ["J.", "Mon."],
  };
  const [yu, mu] = U[lang] ?? U.lv;
  if (y === 0) return `${m} ${mu}`;
  if (m === 0) return `${y} ${yu}`;
  return `${y} ${yu} ${m} ${mu}`;
}

/** DD.MM.YYYY no `YYYY-MM-DD…` vai jau formatēta datuma. */
export function pdfTopDay(raw: string): string {
  const t = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return t;
}

function dayMs(raw: string): number {
  const t = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);
  if (m) return Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!);
  m = /^(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return Date.UTC(+m[2]!, +m[1]! - 1, 1);
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Simetriskais režģis

/**
 * Rindu garumi kartīšu skaitam: līdz 5 - viena rinda; vairāk - vienādas rindas pa 3, 4 vai 5;
 * ja vienādas nav iespējamas - pēc iespējas vienādas (7 = 4 + 3, 11 = 4 + 4 + 3).
 */
export function pdfSymmetricGridRows(n: number): number[] {
  if (!(n > 0)) return [];
  if (n <= 5) return [n];
  for (const c of [3, 4, 5]) if (n % c === 0) return Array.from({ length: n / c }, () => c);
  const rows = Math.ceil(n / 4);
  const base = Math.floor(n / rows);
  const extra = n % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Katrai kartītei rinda un sākuma kolonna režģī ar `2 × kolonnas` pusšūnām (īsākā rinda pie kreisās malas). */
export function pdfSymmetricGridPlacement(n: number): { cols: number; cells: { row: number; col: number }[] } {
  const rows = pdfSymmetricGridRows(n);
  const cols = Math.max(0, ...rows);
  const cells: { row: number; col: number }[] = [];
  rows.forEach((k, r) => {
    for (let i = 0; i < k; i++) cells.push({ row: r + 1, col: 1 + i * 2 });
  });
  return { cols, cells };
}

// ---------------------------------------------------------------------------------------------
// Teksta platuma novērtējums (Inter) - lai kartītēs teksts nelūst

const NARROW = new Set("iljtfrIJ.,:;!|'·()[]/ īļ");
const WIDE = new Set("mwMWŠšЖжШшЩщМмЮю");

/** Aptuvenais teksta platums em vienībās (Inter 600-800). */
export function pdfTopTextEm(text: string, opts: { upper?: boolean; tracking?: number } = {}): number {
  const s = opts.upper ? text.toLocaleUpperCase("lv") : text;
  let em = 0;
  for (const ch of s) {
    if (ch === " ") em += 0.27;
    else if (NARROW.has(ch)) em += 0.31;
    else if (WIDE.has(ch)) em += 0.86;
    else if (/\d/.test(ch)) em += 0.62;
    else if (ch !== ch.toLocaleLowerCase("lv")) em += 0.7;
    else em += 0.57;
    em += opts.tracking ?? 0;
  }
  return em;
}

/** Lielākais burtu izmērs (px, solis 0,25) ≤ `max`, ar kuru teksts ietilpst platumā; `null` - neietilpst pat `min`. */
export function pdfTopFitPx(
  text: string,
  widthPx: number,
  max: number,
  min: number,
  opts: { upper?: boolean; tracking?: number } = {},
): number | null {
  const em = pdfTopTextEm(text, opts);
  if (em <= 0) return max;
  const fit = Math.floor((widthPx / em) * 4) / 4;
  if (fit >= max) return max;
  return fit >= min ? fit : null;
}

// ---------------------------------------------------------------------------------------------
// Logo

function toBase64(s: string): string {
  const g = globalThis as unknown as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } };
  if (g.Buffer) return g.Buffer.from(s, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(s)));
}

function fromBase64(b64: string): string {
  const g = globalThis as unknown as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } };
  if (g.Buffer) return g.Buffer.from(b64, "base64").toString("utf8");
  return decodeURIComponent(escape(atob(b64)));
}

function hexLuminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return 0;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Visas krāsas (izņemot baltu - tā ir zīmes «caurums») → vienā tonī. */
export function recolorSvgToTone(svg: string, tone: string): string {
  const swap = (c: string): string => {
    if (/^#[0-9a-f]{3,8}$/i.test(c)) return hexLuminance(c) > 0.85 ? c : tone;
    if (/^(black|rgb\()/i.test(c)) return tone;
    return c;
  };
  return svg
    .replace(/((?:fill|stroke|stop-color)\s*:\s*)(#[0-9a-fA-F]{3,8}|black|rgb\([^)]*\))/g, (_m, a: string, c: string) => a + swap(c))
    .replace(/((?:fill|stroke|stop-color)=")(#[0-9a-fA-F]{3,8}|black|rgb\([^)]*\))(")/g, (_m, a: string, c: string, z: string) => a + swap(c) + z);
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

function sourceLogoUri(key: PdfSourceLogoKey): string {
  const svg = PDF_SOURCE_LOGO_SVG[key];
  return svgDataUri(PDF_SOURCE_LOGO_TONE ? recolorSvgToTone(svg, PDF_SOURCE_LOGO_TONE) : svg);
}

/**
 * Markas logo (public/brand-logos, iegults kā data URI) bez caurspīdīgās malas: ārējais 256×256 kvadrāts
 * apgriezts līdz iekšējai zīmei, lai to var izlīdzināt ar citiem avotu logo.
 */
export function pdfTopMakeLogoUri(makeModel: string): string | null {
  const key = pdfDealerBrandFileKey(makeModel);
  const uri = key ? PDF_DEALER_LOGO_DATA_URI[key] : undefined;
  if (!uri) return null;
  const b64 = /^data:image\/svg\+xml;base64,(.+)$/.exec(uri)?.[1];
  if (!b64) return null;
  let svg = fromBase64(b64);
  const inner = /^<svg\b[^>]*>\s*<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"/.exec(svg);
  if (inner) {
    const [, w, h, x, y] = inner;
    svg = svg.replace(/^<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`);
  }
  if (PDF_SOURCE_LOGO_TONE) svg = recolorSvgToTone(svg, PDF_SOURCE_LOGO_TONE);
  return svgDataUri(svg);
}

/** Izsoles vieta → logo atslēga. */
export function pdfTopAuctionLogoKey(venue: string): PdfSourceLogoKey | null {
  const v = venue.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!v) return null;
  if (v.includes("openlane") || v.includes("adesa")) return "openlane";
  if (v.includes("autobid")) return "autobid";
  if (v.includes("auto1")) return "auto1";
  if (v.includes("ecarstrade")) return "ecarstrade";
  if (v.includes("mobilede") || v === "mobile") return "mobile";
  return null;
}

// ---------------------------------------------------------------------------------------------
// Izsoles

type ThecarapiLike = {
  date: string;
  venue: string;
  photoDate?: string;
  photoUrls?: string[];
  photos?: { id: string; sourceUrl?: string; contentHash?: string }[];
  fields?: { value: string }[];
};

/** Izsoles (vieta + diena) no pārdošanas rindām un TheCarApi ierakstiem; jaunākā pirmā. */
export function collectPdfTopAuctions(cc: CcVinBlockState | null | undefined): { venue: string; date: string; ms: number }[] {
  if (!cc) return [];
  const seen = new Map<string, { venue: string; date: string; ms: number }>();
  const add = (venueRaw: string, dateRaw: string) => {
    const venue = venueRaw.trim();
    const date = pdfTopDay(dateRaw);
    if (!venue && !date) return;
    const key = `${venue.toLowerCase()}|${date}`;
    if (!seen.has(key)) seen.set(key, { venue, date, ms: dayMs(date) });
  };
  for (const r of (cc.sales ?? []).filter(ccVinSaleRowHasData)) add(r.venue, r.date);
  for (const r of (cc.thecarapiRecords ?? []) as ThecarapiLike[]) {
    const hasData = (r.fields ?? []).some((f) => f.value.trim()) || (r.photos ?? []).length > 0 || (r.photoUrls ?? []).length > 0;
    if (hasData) add(r.venue, r.date);
  }
  return [...seen.values()].sort((a, b) => b.ms - a.ms);
}

// ---------------------------------------------------------------------------------------------
// Foto

export type PdfTopPhoto = {
  src: string;
  kind: "auction" | "listing" | "listingHistory";
  /** Izsoles vieta vai sludinājuma portāls. */
  where: string;
  date: string;
  /** Sludinājuma analīzes titulbildes id (lai to neliek otrreiz zem augšdaļas). */
  listingCoverId?: string;
};

type PhotoGroupLike = { title?: string; photos?: { id: string; sourceUrl?: string; contentHash?: string }[] };

function listingPortal(listingUrl: string | null | undefined): string {
  const t = (listingUrl ?? "").trim();
  if (!t) return "";
  try {
    return new URL(t).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/**
 * Foto prioritāte (Nils 24.11): 1) jaunākās izsoles pirmā bilde (TheCarApi / izsoļu arhīvs);
 * 2) sludinājuma analīzes foto; 3) sludinājuma vēstures titulbilde; citādi nav.
 */
export function resolvePdfTopPhoto(args: {
  ccVinBlock?: CcVinBlockState | null;
  ccVinPhotoDataUrls?: Map<string, string>;
  listingAnalysis?: { coverPhoto?: { id: string } | null; photos?: { id: string }[] | null } | null;
  listingAnalysisPhotoDataUrls?: Map<string, string>;
  tirgusForm?: { photoGroups?: PhotoGroupLike[] | null } | null;
  sourceBlockPhotoDataUrls?: Map<string, string>;
  listingUrl?: string | null;
}): PdfTopPhoto | null {
  const img = (m: Map<string, string> | undefined, id: string | undefined): string => {
    const src = id ? (m?.get(id) ?? "") : "";
    return src.startsWith("data:image/") ? src : "";
  };

  const cc = args.ccVinBlock;
  if (cc) {
    const groups = (cc.photoGroups ?? []) as PhotoGroupLike[];
    const stored = groups.flatMap((g) => g.photos ?? []);
    const records = [...((cc.thecarapiRecords ?? []) as ThecarapiLike[])].sort((a, b) => dayMs(b.date) - dayMs(a.date));
    for (const r of records) {
      const wanted = [
        ...(r.photos ?? []).map((p) => ({ url: p.sourceUrl ?? "", hash: p.contentHash ?? "" })),
        ...(r.photoUrls ?? []).map((u) => ({ url: u, hash: "" })),
      ];
      for (const w of wanted) {
        const hit = stored.find(
          (p) => ((w.url && p.sourceUrl === w.url) || (w.hash && p.contentHash === w.hash)) && img(args.ccVinPhotoDataUrls, p.id),
        );
        if (hit) {
          return { src: img(args.ccVinPhotoDataUrls, hit.id), kind: "auction", where: r.venue.trim(), date: pdfTopDay(r.photoDate || r.date) };
        }
      }
    }
    // Rezerve: izsoles grupa «Openlane · 2026-10-01» (arī ar «TheCarApi · » priekšā) - jaunākā.
    const dated = groups
      .map((g) => {
        const m = /^(?:TheCarApi\s*·\s*)?(.+?)\s*·\s*(\d{4}-\d{2}-\d{2})\s*$/.exec((g.title ?? "").trim());
        return m ? { g, venue: m[1]!.trim(), date: m[2]!, ms: dayMs(m[2]!) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => b.ms - a.ms);
    for (const d of dated) {
      const p = (d.g.photos ?? []).find((ph) => img(args.ccVinPhotoDataUrls, ph.id));
      if (p) return { src: img(args.ccVinPhotoDataUrls, p.id), kind: "auction", where: d.venue, date: pdfTopDay(d.date) };
    }
  }

  const la = args.listingAnalysis;
  if (la) {
    const coverId = la.coverPhoto?.id?.trim() ?? "";
    const cover = img(args.listingAnalysisPhotoDataUrls, coverId);
    if (cover) return { src: cover, kind: "listing", where: listingPortal(args.listingUrl), date: "", listingCoverId: coverId };
    const first = (la.photos ?? []).find((p) => img(args.listingAnalysisPhotoDataUrls, p.id));
    if (first) return { src: img(args.listingAnalysisPhotoDataUrls, first.id), kind: "listing", where: listingPortal(args.listingUrl), date: "" };
  }

  for (const g of (args.tirgusForm?.photoGroups ?? []) as PhotoGroupLike[]) {
    const p = (g.photos ?? []).find((ph) => img(args.sourceBlockPhotoDataUrls, ph.id));
    if (p) {
      return {
        src: img(args.sourceBlockPhotoDataUrls, p.id),
        kind: "listingHistory",
        where: (g.title ?? "").trim() || listingPortal(args.listingUrl),
        date: "",
      };
    }
  }
  return null;
}

export function pdfTopPhotoCaption(photo: PdfTopPhoto, lang: Lang): string {
  const head = pdfTopText(photo.kind === "auction" ? "photoAuction" : "photoListing", lang);
  return [head, photo.where, photo.date].filter((x) => x.trim()).join(" · ");
}

// ---------------------------------------------------------------------------------------------
// Kartītes

export type PdfTopCardTone = "risk" | "none" | "plain";
export type PdfTopCard = { id: string; label: string; value: string; note: string; tone: PdfTopCardTone };

const DEFAULT_TILE_LABEL: Record<string, string> = {
  incidents: "Negadījumi un bojājumi",
  mileage: "Nobraukums",
  owners: "Īpašnieku skaits",
  service: "Servisa vēsture",
};

function tileNote(t: PdfSummaryTile): string {
  if (t.noteSegments?.length) return t.noteSegments.join(" · ");
  return [t.noteLead, t.note].filter((x) => x?.trim()).join(" · ");
}

function toneOf(t: PdfSummaryTile, emptyIsNone: boolean): PdfTopCardTone {
  if (t.tone === "alert" || t.tone === "warn") return "risk";
  if (emptyIsNone && t.tone === "neutral") return "none";
  return "plain";
}

/**
 * «Galvenā informācija»: negadījumi/bojājumi, odometrs, īpašnieki, izsoles, serviss (dati no esošajām
 * kopsavilkuma kartītēm; operatora paslēptās kartītes nerāda, operatora labojumus rāda kā ir).
 */
export function buildPdfTopKeyCards(args: {
  baseTiles: PdfSummaryTile[];
  /** Kartītes, kurām operators adminā ievadījis savu tekstu. */
  overriddenIds?: ReadonlySet<string>;
  ccVinBlock?: CcVinBlockState | null;
  /** Izsoļu portālu arhīvs iekļauts PDF (citādi kartītes «Izsoles» nav). */
  auctionsVisible: boolean;
  auctionsHaveData: boolean;
  lang: Lang;
}): PdfTopCard[] {
  const { lang } = args;
  const byId = new Map(args.baseTiles.map((t) => [t.id, t]));
  const ov = args.overriddenIds ?? new Set<string>();
  const label = (t: PdfSummaryTile, key: PdfTopTextKey) =>
    t.label !== DEFAULT_TILE_LABEL[t.id] ? t.label : pdfTopText(key, lang);
  const out: PdfTopCard[] = [];

  const inc = byId.get("incidents");
  if (inc) out.push({ id: "incidents", label: label(inc, "incidents"), value: inc.value, note: tileNote(inc), tone: toneOf(inc, false) });

  const mil = byId.get("mileage");
  if (mil) {
    if (ov.has("mileage")) {
      out.push({ id: "mileage", label: label(mil, "mileage"), value: mil.value, note: tileNote(mil), tone: toneOf(mil, true) });
    } else if (mil.tone === "neutral") {
      out.push({ id: "mileage", label: label(mil, "mileage"), value: pdfTopText("noData", lang), note: "", tone: "none" });
    } else {
      const readings = mil.readings != null && mil.readings > 0 ? pdfTopReadingsLabel(mil.readings, lang) : "";
      const value =
        mil.tone === "alert" ? pdfTopText("mileageRollback", lang) : mil.tone === "warn" ? pdfTopText("mileageListingBelow", lang) : pdfTopText("mileageOk", lang);
      const note =
        mil.tone === "warn"
          ? [mil.noteLead, mil.note].filter((x) => x?.trim()).join(" · ")
          : [readings, ...(mil.noteSegments ?? [])].filter((x) => x.trim()).join(" · ");
      out.push({ id: "mileage", label: label(mil, "mileage"), value, note, tone: mil.tone === "ok" ? "plain" : "risk" });
    }
  }

  const own = byId.get("owners");
  if (own) out.push({ id: "owners", label: label(own, "owners"), value: own.value, note: tileNote(own), tone: toneOf(own, true) });

  if (args.auctionsVisible) {
    const auctions = collectPdfTopAuctions(args.ccVinBlock);
    if (auctions.length > 0) {
      const a = auctions[0]!;
      out.push({
        id: "auctions",
        label: pdfTopText("auctions", lang),
        value: pdfTopAuctionsLabel(auctions.length, lang),
        note: [a.venue, a.date].filter((x) => x.trim()).join(" · "),
        tone: "plain",
      });
    } else if (args.auctionsHaveData) {
      out.push({ id: "auctions", label: pdfTopText("auctions", lang), value: pdfTopText("auctionsNone", lang), note: pdfTopText("auctionsNoneNote", lang), tone: "plain" });
    } else {
      out.push({ id: "auctions", label: pdfTopText("auctions", lang), value: pdfTopText("noData", lang), note: "", tone: "none" });
    }
  }

  const svc = byId.get("service");
  if (svc) {
    const note = !ov.has("service") && svc.latestDate ? `${pdfTopText("serviceLatest", lang)} ${svc.latestDate}` : tileNote(svc);
    out.push({ id: "service", label: label(svc, "service"), value: svc.value, note, tone: toneOf(svc, true) });
  }
  return out;
}

/** Papildu kartītes (brīdinājumi, sludinājums, manuālās) tajā pašā formātā. */
export function pdfTopExtraCards(tiles: PdfSummaryTile[]): PdfTopCard[] {
  return tiles.map((t) => ({ id: t.id, label: t.label, value: t.value, note: tileNote(t), tone: toneOf(t, false) }));
}

// ---------------------------------------------------------------------------------------------
// Avoti

export type PdfTopSource = {
  /** Logo atslēga vai markas logo URI; bez logo - nosaukums tekstā. */
  logo?: { key: PdfSourceLogoKey } | { uri: string; make: true };
  name: string;
  category: string;
  count: number;
};

const LOGO_HEIGHT: Partial<Record<PdfSourceLogoKey, number>> = {
  csdd: 14,
  autodna: 14,
  carvertical: 15.5,
  openlane: 12.5,
  autobid: 20,
  auto1: 13,
  ecarstrade: 15,
  mobile: 13,
};

// ---------------------------------------------------------------------------------------------
// HTML

export type PdfTopModel = {
  lang: Lang;
  /** PROVIN.LV / PROVIN logo SVG (kā līdz šim galvenē). */
  logoSvg: string;
  /** Atskaites veids, piem. «Business» + «Datu atskaite». */
  kindTitle: string;
  kindSub?: string;
  dateLabel: string;
  makeModel: string;
  vin: string;
  specLine: string;
  photo: PdfTopPhoto | null;
  odometer: { value: string; sub: string } | null;
  age: string;
  firstReg: { date: string; sub: string } | null;
  cards: PdfTopCard[];
  sources: PdfTopSource[];
  totals: { paid: number; pub: number; other: number };
  /** PROVIN vārdzīme virsrakstā. */
  wordmarkHtml: string;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CAR_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';

/** «330 000 km» nelūst pa vidu: atstarpes skaitļos un pirms mērvienības - nedalāmas. */
function keepNumbers(html: string): string {
  return html.replace(/(\d) (?=\d{3}(?!\d))/g, "$1\u00a0").replace(/(\d) (km|€|EUR)/g, "$1\u00a0$2");
}

function fitStyle(px: number | null, fallbackPx: number): string {
  return px == null ? `font-size:${fallbackPx}px;white-space:normal` : `font-size:${px}px`;
}

/** Augšējā josla: logo kreisajā pusē, atskaites veids un datums labajā. */
export function buildPdfTopBarHtml(m: Pick<PdfTopModel, "logoSvg" | "kindTitle" | "kindSub" | "dateLabel">): string {
  const right = [`<b>${esc(m.kindTitle)}</b>`, m.kindSub ? esc(m.kindSub) : "", esc(m.dateLabel)].filter(Boolean).join(" · ");
  return `<div class="pdf-top6__bar"><span class="pdf-top6__logo">${m.logoSvg}</span><span class="pdf-top6__kind">${right}</span></div>`;
}

function cardsHtml(cards: PdfTopCard[], lang: Lang): string {
  if (cards.length === 0) return "";
  const { cols, cells } = pdfSymmetricGridPlacement(cards.length);
  const cardW = (CONTENT_W - CARD_GAP * (cols - 1)) / cols;
  const inner = cardW - CARD_PAD_X * 2 - 2;
  const maxV = cols >= 5 ? 12 : cols === 4 ? 13 : 14;
  // Viens vērtību izmērs visām kartītēm (vienots izskats); ja kāda neietilpst pat 8,5 px - tā drīkst lūzt.
  const fits = cards.map((c) => (c.value ? pdfTopFitPx(c.value, inner, maxV, 8.5) : maxV));
  const shared = Math.min(...fits.map((f) => f ?? 8.5));
  const items = cards
    .map((c, i) => {
      const cell = cells[i]!;
      const labPx = pdfTopFitPx(c.label, inner, 7.5, 6.25, { upper: true, tracking: 0.14 });
      const vCls = c.tone === "risk" ? " s-alert" : c.tone === "none" ? " s-none" : "";
      const valueHtml = c.value
        ? `<p class="pdf-top6-card__v${vCls}" style="${fitStyle(fits[i] == null ? null : shared, 8.5)}">${esc(c.value)}</p>`
        : "";
      const noteHtml = c.note ? `<p class="pdf-top6-card__sub">${keepNumbers(esc(c.note))}</p>` : "";
      return `<div class="pdf-top6-card pdf-top6-card--${esc(c.id.replace(/[^a-z0-9-]/gi, "-"))}" style="grid-row:${cell.row};grid-column:${cell.col} / span 2"><p class="pdf-top6__lab" style="${fitStyle(labPx, 6.25)}">${esc(c.label)}</p>${valueHtml}${noteHtml}</div>`;
    })
    .join("");
  return `<div class="pdf-top6__kc"><p class="pdf-top6__hd">${esc(pdfTopText("keyInfo", lang))}</p><div class="pdf-top6__grid" style="grid-template-columns:repeat(${cols * 2},minmax(0,1fr))">${items}</div></div>`;
}

function sourcesHtml(m: PdfTopModel): string {
  if (m.sources.length === 0) return "";
  const { lang } = m;
  const { cols, cells } = pdfSymmetricGridPlacement(m.sources.length);
  const cellW = CONTENT_W / cols - 18;
  const parts = [
    m.totals.paid > 0 ? `${esc(pdfTopText("srcPaid", lang))} <b>${m.totals.paid}</b>` : "",
    m.totals.pub > 0 ? `${esc(pdfTopText("srcPublic", lang))} <b>${m.totals.pub}</b>` : "",
    m.totals.other > 0 ? `${esc(pdfTopText("srcOther", lang))} <b>${m.totals.other}</b>` : "",
  ].filter(Boolean);
  const total = m.totals.paid + m.totals.pub + m.totals.other;
  if (total > 0) parts.push(`${esc(pdfTopText("srcTotal", lang))} <b>${total}</b>`);
  const items = m.sources
    .map((s, i) => {
      const cell = cells[i]!;
      let nm: string;
      if (s.logo && "key" in s.logo) {
        const h = LOGO_HEIGHT[s.logo.key] ?? 13;
        nm = `<img class="pdf-top6-src__logo" style="height:${h}px" src="${sourceLogoUri(s.logo.key)}" alt="${esc(s.name)}"/>`;
      } else if (s.logo && "uri" in s.logo) {
        nm = `<img class="pdf-top6-src__logo pdf-top6-src__logo--make" src="${s.logo.uri}" alt="${esc(s.name)}"/>`;
      } else {
        nm = `<span style="${fitStyle(pdfTopFitPx(s.name, cellW, 11.5, 8), 8)}">${esc(s.name)}</span>`;
      }
      const catPx = pdfTopFitPx(s.category, cellW, 7.5, 6.25, { upper: true, tracking: 0.14 });
      return `<div class="pdf-top6-src" style="grid-row:${cell.row};grid-column:${cell.col} / span 2"><div class="pdf-top6-src__nm">${nm}</div><p class="pdf-top6__lab pdf-top6-src__cat" style="${fitStyle(catPx, 6.25)}">${esc(s.category)}</p><p class="pdf-top6-src__cnt${s.count > 0 ? "" : " s-none"}">${esc(pdfTopRecordsLabel(s.count, lang))}</p></div>`;
    })
    .join("");
  return `<div class="pdf-top6__src"><div class="pdf-top6__shead"><p class="pdf-top6__hd">${sourcesHeadingHtml(lang, m.wordmarkHtml)}</p>${parts.length ? `<p class="pdf-top6__tot">${parts.join(" · ")}</p>` : ""}</div><div class="pdf-top6__scan"></div><div class="pdf-top6__cells" style="grid-template-columns:repeat(${cols * 2},minmax(0,1fr))">${items}</div></div>`;
}

/** Visa 1. lapas augšdaļa vienā blokā, kas lapu pārrāvumā nepārtrūkst. */
export function buildPdfTopSectionHtml(m: PdfTopModel): string {
  const { lang } = m;
  const photo = m.photo
    ? `<div class="pdf-top6__ph"><img src="${m.photo.src}" alt=""/></div><p class="pdf-top6__cap">${esc(pdfTopPhotoCaption(m.photo, lang))}</p>`
    : `<div class="pdf-top6__ph pdf-top6__ph--empty">${CAR_SVG}<span>${esc(pdfTopText("photoNone", lang))}</span></div><p class="pdf-top6__cap">&nbsp;</p>`;
  const model = m.makeModel.trim();
  const one = model ? pdfTopFitPx(model, 246, 32, 22) : 32;
  const titleStyle = one != null ? `font-size:${one}px;white-space:nowrap` : `font-size:${Math.max(18, Math.min(26, Math.floor((2 * 246) / Math.max(1, pdfTopTextEm(model)))))}px`;
  const vin = m.vin.trim() ? `<p class="pdf-top6__vin"><b>VIN</b>${esc(m.vin.trim())}</p>` : "";
  const spec = m.specLine.trim()
    ? `<p class="pdf-top6__spec" style="${fitStyle(pdfTopFitPx(m.specLine, 246, 9, 7), 7)}">${esc(m.specLine)}</p>`
    : "";
  let odo = "";
  if (m.odometer) {
    const mm = /^(.*?)\s*(km|mi|км)$/i.exec(m.odometer.value.trim());
    const num = mm ? mm[1]! : m.odometer.value.trim();
    const unit = mm ? mm[2]! : "";
    const px = pdfTopFitPx(num, 246 - (unit ? 34 : 0), 46, 24) ?? 24;
    odo = `<div class="pdf-top6__odo"><p class="pdf-top6__lab">${esc(pdfTopText("odometer", lang))}</p><p class="pdf-top6__big" style="font-size:${px}px">${esc(num)}${unit ? `<small>${esc(unit)}</small>` : ""}</p>${m.odometer.sub ? `<p class="pdf-top6__sub">${esc(m.odometer.sub)}</p>` : ""}</div>`;
  }
  const pair = [
    m.age ? `<div><p class="pdf-top6__lab">${esc(pdfTopText("age", lang))}</p><p class="pdf-top6__pv">${esc(m.age)}</p></div>` : "",
    m.firstReg
      ? `<div><p class="pdf-top6__lab">${esc(pdfTopText("firstReg", lang))}</p><p class="pdf-top6__pv">${esc(m.firstReg.date)}</p>${m.firstReg.sub ? `<p class="pdf-top6__sub">${esc(m.firstReg.sub)}</p>` : ""}</div>`
      : "",
  ].filter(Boolean);
  const pairHtml = pair.length ? `<div class="pdf-top6__pair">${pair.join("")}</div>` : "";
  return `<section class="pdf-top6" role="region" aria-label="${esc(pdfTopText("keyInfo", lang))}">${buildPdfTopBarHtml(m)}<div class="pdf-top6__hero"><div class="pdf-top6__photo">${photo}</div><div class="pdf-top6__id"><p class="pdf-top6__lab">${esc(pdfTopText("vehicle", lang))}</p>${model ? `<h1 class="pdf-top6__model" style="${titleStyle}">${esc(model)}</h1>` : ""}${vin}${spec}${odo}${pairHtml}</div></div>${cardsHtml(m.cards, lang)}${sourcesHtml(m)}</section>`;
}

/** Atsevišķa josla dīlera atskaitei (tai nav 1. lapas kopsavilkuma). */
export function buildPdfTopBarOnlyHtml(m: Pick<PdfTopModel, "logoSvg" | "kindTitle" | "kindSub" | "dateLabel">): string {
  return `<section class="pdf-top6 pdf-top6--bar-only" role="region">${buildPdfTopBarHtml(m)}</section>`;
}

/** Bloka stils (A4, px kā maketā; drukā melnbaltā lasāms - risks treknāks). */
export const PDF_TOP6_CSS = `
.pdf-top6{--t6-ink:#1d1d1f;--t6-ink2:#424245;--t6-mute:#86868b;--t6-hair:#c9c9ce;--t6-blue:#0061D2;--t6-risk:#B3261E;--t6-soft:#F5F5F7;
  color:var(--t6-ink);font-family:Inter,sans-serif;font-size:10px;line-height:1.5;margin:0 0 28px;padding-right:2px;font-variant-numeric:tabular-nums;
  break-inside:avoid;page-break-inside:avoid;}
.pdf-top6 p,.pdf-top6 h1{margin:0;}
.pdf-top6--bar-only{margin-bottom:18px;}
.pdf-top6__bar{display:flex;justify-content:space-between;align-items:center;gap:16px;}
.pdf-top6__logo{display:inline-flex;align-items:center;}
.pdf-top6__logo svg{height:19px;width:auto;display:block;}
.pdf-top6__kind{font-size:9px;color:var(--t6-mute);white-space:nowrap;}
.pdf-top6__kind b{color:var(--t6-ink);font-weight:600;}
.pdf-top6__lab{font-size:7.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--t6-mute);line-height:1.3;white-space:nowrap;}
.pdf-top6__hd{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t6-ink);}
.pdf-top6__hero{display:grid;grid-template-columns:420px minmax(0,1fr);gap:32px;margin-top:26px;}
.pdf-top6__ph{position:relative;overflow:hidden;background:var(--t6-soft);height:272px;}
.pdf-top6__ph img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 100%;transform:scale(1.06);transform-origin:50% 100%;}
.pdf-top6__ph--empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;}
.pdf-top6__ph--empty svg{width:64px;height:64px;color:#c7c7cc;}
.pdf-top6__ph--empty span{font-size:8.5px;font-weight:500;letter-spacing:.06em;color:var(--t6-mute);}
.pdf-top6__cap{margin-top:7px!important;font-size:8px;color:var(--t6-mute);letter-spacing:.02em;}
.pdf-top6__model{margin-top:6px!important;font-weight:800;letter-spacing:-0.035em;line-height:1.02;color:var(--t6-ink);}
.pdf-top6__vin{margin-top:10px!important;font-size:11px;font-weight:600;letter-spacing:.14em;color:var(--t6-ink);white-space:nowrap;}
.pdf-top6__vin b{font-weight:800;letter-spacing:-0.01em;color:var(--t6-blue);margin-right:8px;}
.pdf-top6__spec{margin-top:10px!important;color:var(--t6-mute);letter-spacing:.02em;white-space:nowrap;}
.pdf-top6__odo{margin-top:30px;}
.pdf-top6__big{margin-top:6px!important;font-weight:800;letter-spacing:-0.035em;line-height:1;color:var(--t6-ink);white-space:nowrap;}
.pdf-top6__big small{font-size:.42em;font-weight:500;letter-spacing:0;color:var(--t6-mute);margin-left:4px;}
.pdf-top6__sub{margin-top:6px!important;font-size:8.5px;color:var(--t6-mute);}
.pdf-top6__pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;padding-top:12px;border-top:.5px solid var(--t6-hair);}
.pdf-top6__pv{margin-top:4px!important;font-size:13px;font-weight:700;letter-spacing:-0.01em;white-space:nowrap;}
.pdf-top6__pair .pdf-top6__sub{margin-top:2px!important;}
.pdf-top6__kc{margin-top:28px;}
.pdf-top6__kc>.pdf-top6__hd{margin-bottom:12px;}
.pdf-top6__grid{display:grid;gap:10px;grid-auto-rows:1fr;}
.pdf-top6-card{border:1px solid #E5E7EB;border-radius:6px;padding:13px 14px 12px;background:#fff;min-width:0;min-height:82px;display:flex;flex-direction:column;}
.pdf-top6-card__v{margin-top:7px!important;font-weight:700;letter-spacing:-0.015em;line-height:1.15;color:var(--t6-ink);white-space:nowrap;}
.pdf-top6-card__sub{margin-top:auto!important;padding-top:6px;font-size:8.5px;color:var(--t6-mute);line-height:1.35;}
.pdf-top6 .s-alert{color:var(--t6-risk)!important;font-weight:800!important;}
.pdf-top6 .s-none{color:var(--t6-mute)!important;}
.pdf-top6__src{margin-top:30px;}
.pdf-top6__shead{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;column-gap:16px;row-gap:4px;margin-bottom:8px;}
.pdf-top6__shead .pdf-provin-wordmark{font-weight:800;letter-spacing:-0.01em;}
.pdf-top6__tot{font-size:8.5px;color:var(--t6-mute);white-space:nowrap;margin-left:auto!important;}
.pdf-top6__tot b{color:var(--t6-ink);font-weight:600;}
.pdf-top6__scan{position:relative;height:0;border-top:.5px solid var(--t6-hair);}
.pdf-top6__scan::before{content:"";position:absolute;left:0;top:-1px;width:26px;height:1.5px;background:var(--t6-blue);}
.pdf-top6__cells{display:grid;column-gap:0;}
.pdf-top6-src{padding:10px 18px 0 0;border-top:.5px solid var(--t6-hair);min-width:0;}
.pdf-top6__cells .pdf-top6-src{border-top:0;}
.pdf-top6-src__nm{height:22px;display:flex;align-items:center;font-size:11.5px;font-weight:650;letter-spacing:-0.01em;color:var(--t6-ink);white-space:nowrap;}
.pdf-top6-src__logo{display:block;height:13px;width:auto;max-width:100%;}
.pdf-top6-src__logo--make{height:22px;margin-left:-1px;}
.pdf-top6-src__cat{margin-top:7px!important;}
.pdf-top6-src__cnt{margin-top:3px!important;font-size:10.5px;font-weight:500;color:var(--t6-ink);}
`;
