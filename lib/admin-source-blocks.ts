/**
 * Strukturēti avotu bloki admin portfelī → sintēze uz PDF / km / VIN heuristiku.
 */

import {
  CARVERTICAL_TIMELINE_TITLE,
  type CarVerticalDamageDetailRow,
  type CarVerticalTimelineRow,
} from "@/lib/carvertical-pdf-parse";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { deepSanitizeDraftStrings } from "@/lib/admin-draft-sanitize";
import { mergePdfVisibility, type PdfVisibilitySettings } from "@/lib/pdf-visibility";
import {
  mergeProvinBannerPdfInclude,
  mergeProvinManualBanners,
  type ProvinBannerPdfInclude,
  type ProvinManualBanner,
} from "@/lib/provin-alert-banners";
import { appendGeminiContextRawSection, clipGeminiContextRaw } from "@/lib/admin-gemini-context-raw";
import {
  countListingAnalysisPhotos,
  normalizeListingAnalysisPhotoGroups,
  normalizeListingAnalysisPhotos,
  syncListingAnalysisPhotoGroupsAndFlat,
} from "@/lib/listing-analysis-photo-types";
import type { ListingAnalysisPhotoGroup, ListingAnalysisPhotoMeta } from "@/lib/listing-analysis-photo-types";
import { parseVehicleAiFromWorkspaceRecord } from "@/lib/vehicle-ai-extraction-parse";
import type { VehicleAIExtraction, VehicleAiExtractionMeta } from "@/lib/vehicle-ai-extraction-types";
import type { AutoRecordsServiceRow } from "./auto-records-paste-parse";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "./auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { normalizeLossAmountEurDisplay, normalizeLtabIncidentRow } from "@/lib/loss-amount-format";
import {
  emptyOutvinDealerReport,
  outvinDealerReportHasContent,
  outvinDealerReportToPlainText,
  type OutvinDealerReport,
} from "@/lib/outvin-dealer-types";
import {
  outvinBundleHasStructuredContent,
  outvinDealerServiceRowHasData,
  parseOutvinDataBundleRaw,
  type OutvinDataBundle,
} from "@/lib/outvin-data-bundle";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { outvinBundleToDealerReport } from "@/lib/outvin-purchase-map";
import { backfillCsddExtendedFromRaw } from "@/lib/csdd-paste-parse";
import type {
  CsddOwnerChangeRow,
  CsddPreviousInspectionBlock,
  CsddTechnicalInspectionRow,
  CsddInspectionDefectRow,
} from "@/lib/csdd-extended-parse";
import { emptyCsddPreviousInspectionBlock, previousInspectionBlockHasData } from "@/lib/csdd-extended-parse";

export { type OutvinDealerReport } from "@/lib/outvin-dealer-types";
export type { AutoRecordsServiceRow } from "./auto-records-paste-parse";

export const SOURCE_BLOCK_KEYS = [
  "csdd",
  "autodna",
  "carvertical",
  "auto_records",
  "ltab",
  "tirgus",
  "citi_avoti",
  "listing_analysis",
] as const;

export type SourceBlockKey = (typeof SOURCE_BLOCK_KEYS)[number];

/** Režģa standarta bloki (rindas + komentāri; bez CSDD, citi_avoti, Sludinājuma analīzes). */
export type StandardSourceBlockKey = Exclude<SourceBlockKey, "csdd" | "listing_analysis" | "citi_avoti">;

export const STANDARD_SOURCE_BLOCK_KEYS: StandardSourceBlockKey[] = [
  "tirgus",
  "autodna",
  "carvertical",
  "auto_records",
  "ltab",
];

export const SOURCE_BLOCK_LABELS: Record<SourceBlockKey, string> = {
  csdd: "CSDD",
  tirgus: "Tirgus dati",
  autodna: "AutoDNA",
  carvertical: "CarVertical",
  auto_records: "OFICIĀLĀ DĪLERA DATI",
  ltab: "LTAB",
  citi_avoti: "CITI AVOTI",
  listing_analysis: "Sludinājuma analīze",
};

/** Ātrās saites avotiem — tikai admin panelis (ne PDF). */
export const SOURCE_BLOCK_EXTERNAL_URL: Record<SourceBlockKey, string> = {
  csdd: "https://e.csdd.lv/tadati/",
  ltab: "https://services.ltab.lv/lv/VehicleInsAndAcc",
  tirgus: "https://tirgusdati.lv/app/listings/history",
  autodna: "https://www.autodna.com",
  carvertical: "https://www.carvertical.lv",
  auto_records: "https://www.auto-records.com",
  citi_avoti: "https://www.provin.lv",
  listing_analysis: "https://www.ss.lv",
};

/** Virsraksta krāsa admin UI (Tailwind). */
export const SOURCE_BLOCK_ADMIN_TITLE_COLOR: Record<SourceBlockKey, string> = {
  csdd: "text-emerald-900",
  ltab: "text-red-900",
  tirgus: "text-blue-900",
  autodna: "text-sky-700",
  carvertical: "text-yellow-600",
  auto_records: "text-orange-500",
  citi_avoti: "text-stone-700",
  listing_analysis: "text-green-700",
};

/** Avotu virsraksta teksta izmērs admin UI (11px, saskaņots ar laukiem). */
export const SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS = "text-[11px]";

/** PDF „Komentāri” — strukturēti apstiprinājumi (CSDD, AutoDNA, CarVertical, AUTO RECORDS). */
export type SourcePdfChecklist = {
  incidents: boolean;
  mileageHistory: boolean;
  mileageLine: boolean;
};

export const SOURCE_PDF_CHECKLIST_KEYS = ["incidents", "mileageHistory", "mileageLine"] as const;
export type SourcePdfChecklistKey = (typeof SOURCE_PDF_CHECKLIST_KEYS)[number];

export const SOURCE_PDF_CHECKLIST_META: Record<
  SourcePdfChecklistKey,
  { label: string; pdfSuffix: string }
> = {
  incidents: { label: "Ieraksti par negadījumiem", pdfSuffix: "nav" },
  mileageHistory: { label: "Informācija par nobraukuma vēsturi", pdfSuffix: "nav" },
  mileageLine: { label: "Nobraukuma līkne", pdfSuffix: "korekta" },
};

export function emptySourcePdfChecklist(): SourcePdfChecklist {
  return { incidents: false, mileageHistory: false, mileageLine: false };
}

export function normalizeSourcePdfChecklist(raw: unknown): SourcePdfChecklist {
  if (!raw || typeof raw !== "object") return emptySourcePdfChecklist();
  const o = raw as Record<string, unknown>;
  return {
    incidents: o.incidents === true,
    mileageHistory: o.mileageHistory === true,
    mileageLine: o.mileageLine === true,
  };
}

export function sourcePdfChecklistHasAny(c: SourcePdfChecklist | undefined): boolean {
  if (!c) return false;
  return c.incidents || c.mileageHistory || c.mileageLine;
}

/** Rindas PDF „Komentāri” tekstam (ar atstarpi ap defisu, kā klienta piemērā). */
export function formatSourcePdfChecklistForPdf(c: SourcePdfChecklist | undefined): string {
  if (!sourcePdfChecklistHasAny(c) || !c) return "";
  const lines: string[] = [];
  for (const key of SOURCE_PDF_CHECKLIST_KEYS) {
    if (!c[key]) continue;
    const m = SOURCE_PDF_CHECKLIST_META[key];
    lines.push(`${m.label} - ${m.pdfSuffix}`);
  }
  return lines.join("\n");
}

export function mergePdfChecklistAndComments(
  checklist: SourcePdfChecklist | undefined,
  comments: string,
): string {
  const c = formatSourcePdfChecklistForPdf(checklist);
  const t = comments.trim();
  if (!c) return t;
  if (!t) return c;
  return `${c}\n\n${t}`;
}

/** Vienota nobraukuma rinda: LV ierakstiem valsts = „Latvija”. */
export type CsddMileageRow = {
  date: string;
  odometer: string;
  country: string;
};

/** Nobraukuma vēsture LV — Datums | Odometrs (migrācijai no vecā JSON). */
export type CsddMileageHistoryRow = {
  date: string;
  odometer: string;
};

/** Nobraukums ārvalstīs — migrācijai. */
export type CsddMileageAbroadRow = {
  date: string;
  odometer: string;
};

/**
 * CSDD forma: neapstrādātais teksts (tikai admin) + tehniskie pamatdati + nobraukuma tabula.
 * PDF atspoguļo tikai strukturētos laukus (ne raw).
 */
/** CSDD raw — max garums (kā citi_avoti). */
export const CSDD_RAW_UNPROCESSED_MAX_LEN = 500_000;

export type CsddFormFields = {
  /** Tikai admin — ielīmētais teksts; netiek drukāts PDF. */
  rawUnprocessedData: string;
  makeModel: string;
  registrationNumber: string;
  /** HTML date (YYYY-MM-DD) vai teksts no CSDD. */
  firstRegistration: string;
  nextInspectionDate: string;
  prevInspectionDate: string;
  engineDisplacementCm3: string;
  enginePowerKw: string;
  fuelType: string;
  emissionStandard: string;
  grossMassKg: string;
  curbMassKg: string;
  roadTaxEur: string;
  registrationStatus: string;
  opacityCoefficient: string;
  particulateMatter: string;
  /** No CSDD raw — iepriekšējā reģistrācijas valsts. */
  previousRegistrationCountry: string;
  /** Īpašnieku skaits Latvijā (skaitlis no reģistrācijas sadaļas). */
  ownerCountLatvia: string;
  /** Tehnisko apskašu vēsture — parsēts no raw. */
  technicalInspectionHistory: CsddTechnicalInspectionRow[];
  /** Īpašnieku maiņu notikumi Latvijā. */
  ownerRegistrationEvents: CsddOwnerChangeRow[];
  /** „Iepriekšējās apskates dati” admin blokā — avots: „Detalizētais vērtējums” + tehniskie dati. */
  prevInspectionBlock: CsddPreviousInspectionBlock;
  /** Manuālas brīdinājumu rindas — „Iepriekšējās apskates dati”. */
  prevInspectionWarnings: CsddInspectionWarningRow[];
  /** Manuālas brīdinājumu rindas — „Tehnisko apskašu vēsture”. */
  technicalInspectionWarnings: CsddInspectionWarningRow[];
  /** Hronoloģiski sakārtots (jaunākais augšā): Datums | Odometrs | Valsts. */
  mileageHistory: CsddMileageRow[];
  /** Eksperta piezīmes — PDF CSDD apakšsadaļā (kā citiem avotiem). */
  comments: string;
  /** Papildu konteksts tikai Gemini AI — nav PDF. */
  geminiContextRaw: string;
  /** PDF apstiprinājumi — drukājas kopā ar komentāriem. */
  pdfChecklist?: SourcePdfChecklist;
};

/** Tehniskie + apskates lauki (secība = Admin / PDF). */
export const CSDD_FORM_STRUCTURED_FIELDS: {
  key: keyof CsddFormFields;
  label: string;
}[] = [
  { key: "makeModel", label: "Marka, modelis:" },
  { key: "registrationNumber", label: "Reģistrācijas numurs:" },
  { key: "firstRegistration", label: "Pirmā reģistrācija:" },
  { key: "nextInspectionDate", label: "Nākamās apskates datums:" },
  { key: "prevInspectionDate", label: "Iepriekšējās apskates datums:" },
  { key: "engineDisplacementCm3", label: "Motora tilpums (cm³):" },
  { key: "enginePowerKw", label: "Motora maksimālā jauda (kW):" },
  { key: "fuelType", label: "Degvielas veids:" },
  { key: "emissionStandard", label: "Emisiju standarts:" },
  { key: "grossMassKg", label: "Pilna masa (kg):" },
  { key: "curbMassKg", label: "Pašmasa (kg):" },
  { key: "roadTaxEur", label: "Ekspluatācijas nodoklis (EUR):" },
  { key: "registrationStatus", label: "Reģistrācijas statuss:" },
  { key: "opacityCoefficient", label: "Dūmainības koeficients (m⁻¹):" },
  { key: "particulateMatter", label: "Atgāzu cietās daļiņas:" },
  { key: "previousRegistrationCountry", label: "Iepriekšējās reģistrācijas valsts:" },
  { key: "ownerCountLatvia", label: "Īpašnieku skaits Latvijā:" },
];

/** CSDD tehnisko apskašu vēstures bloka virsraksts (admin + PDF). */
export const CSDD_TECHNICAL_INSPECTION_HISTORY_TITLE = "Tehnisko apskašu vēsture";

/** CSDD „Iepriekšējās apskates dati” (admin + PDF). */
export const CSDD_PREVIOUS_INSPECTION_TITLE = "Iepriekšējās apskates dati";

export type CsddInspectionWarningSeverity = "gray" | "yellow" | "red";

export type CsddInspectionWarningRow = {
  text: string;
  severity: CsddInspectionWarningSeverity;
};

export function emptyCsddInspectionWarningRow(): CsddInspectionWarningRow {
  return { text: "", severity: "yellow" };
}

export function csddInspectionWarningRowHasData(r: CsddInspectionWarningRow): boolean {
  return Boolean(r.text.trim());
}

export function filterCsddInspectionWarnings(rows: CsddInspectionWarningRow[] | undefined): CsddInspectionWarningRow[] {
  return (rows ?? []).filter(csddInspectionWarningRowHasData);
}

/** @deprecated Lietot CSDD_FORM_STRUCTURED_FIELDS */
export const CSDD_FORM_SHORT_FIELDS = CSDD_FORM_STRUCTURED_FIELDS;

/** Tirgus dati — admin un PDF etiķetes (precīzi). */
export type TirgusFormFields = {
  listedForSale: string;
  listingCreated: string;
  priceDrop: string;
  comments: string;
  /** Papildu konteksts tikai Gemini AI — nav PDF. */
  geminiContextRaw: string;
};

export const TIRGUS_LABEL_LISTED = "Auto pārdošanā (dienas):";
export const TIRGUS_LABEL_CREATED = "Izveidots:";
export const TIRGUS_LABEL_PRICE_DROP = "Cenas izmaiņas (eiro):";
/** Senā atsauce; jaunajā UI izmanto LISTING_ANALYSIS_COMMENT_LABEL. */
export const TIRGUS_LABEL_COMMENTS = "Komentāri:";

export function emptyTirgusFields(): TirgusFormFields {
  return { listedForSale: "", listingCreated: "", priceDrop: "", comments: "", geminiContextRaw: "" };
}

export function tirgusFormHasContent(f: TirgusFormFields | null | undefined): boolean {
  if (!f) return false;
  return (
    wsStr(f.listedForSale).trim().length > 0 ||
    wsStr(f.listingCreated).trim().length > 0 ||
    wsStr(f.priceDrop).trim().length > 0 ||
    wsStr(f.comments).trim().length > 0
  );
}

export function tirgusFormToPlainText(f: TirgusFormFields): string {
  const lines: string[] = [];
  if (f.listedForSale.trim()) lines.push(`${TIRGUS_LABEL_LISTED} ${f.listedForSale.trim()}`);
  if (f.listingCreated.trim()) lines.push(`${TIRGUS_LABEL_CREATED} ${f.listingCreated.trim()}`);
  if (f.priceDrop.trim()) lines.push(`${TIRGUS_LABEL_PRICE_DROP} ${f.priceDrop.trim()}`);
  if (f.comments.trim()) {
    lines.push(`${LISTING_ANALYSIS_COMMENT_LABEL}\n${f.comments.trim()}`);
  }
  return lines.join("\n");
}

export function emptyCsddFields(): CsddFormFields {
  return {
    rawUnprocessedData: "",
    makeModel: "",
    registrationNumber: "",
    firstRegistration: "",
    nextInspectionDate: "",
    prevInspectionDate: "",
    engineDisplacementCm3: "",
    enginePowerKw: "",
    fuelType: "",
    emissionStandard: "",
    grossMassKg: "",
    curbMassKg: "",
    roadTaxEur: "",
    registrationStatus: "",
    opacityCoefficient: "",
    particulateMatter: "",
    previousRegistrationCountry: "",
    ownerCountLatvia: "",
    technicalInspectionHistory: [],
    ownerRegistrationEvents: [],
    prevInspectionBlock: emptyCsddPreviousInspectionBlock(),
    prevInspectionWarnings: [],
    technicalInspectionWarnings: [],
    mileageHistory: [],
    comments: "",
    geminiContextRaw: "",
    pdfChecklist: undefined,
  };
}

/** Automātiski piešķirama tikai no „Nobraukuma vēsture LV” parsera — nav noklusējuma tukšiem laukiem. */
export const CSDD_MILEAGE_COUNTRY_LV = "Latvija";

/** Tukšai valstij PDF/admin lasītajā skatā (datu laukā glabājas ""). */
export const CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL = "Nezināmā";

/** Vienotās tabulas virsraksts (admin + PDF). */
export const CSDD_MILEAGE_UNIFIED_TITLE = "NOBRAUKUMA VĒSTURE";

/** AutoDNA / CarVertical — negadījumu apakšsekcija (saskaņots ar LTAB loģiku). */
export const NEGADIJUMU_VESTURE_TITLE = "NEGADĪJUMU VĒSTURE";

/**
 * Nobraukuma tabulu kolonnu semantika: «Datums», «Odometrs (km)», «Valsts».
 * Vienoti visiem avotu blokiem ar šo tabulu (CSDD, AUTO RECORDS, AutoDNA, CarVertical).
 * Lieto `data-provin-field` + `data-provin-block` + `data-row-index` (un zem `data-provin-mileage-table`).
 */
export const PROVIN_MILEAGE_TABLE_FIELD = {
  datums: "nobraukuma_vesture_datums",
  odometrsKm: "nobraukuma_vesture_odometrs",
  valsts: "nobraukuma_vesture_valsts",
} as const;

/** Nobraukuma tabulas konteinera `data-provin-mileage-table` vērtība (DOM atlasei). */
export const PROVIN_MILEAGE_TABLE_DOM_KIND = "nobraukuma_vesture";

/** AutoDNA / CarVertical — visi lauki (ieskaitot nobraukumu un negadījumus). */
export const PROVIN_VENDOR_FIELD = {
  nobraukumaDatums: PROVIN_MILEAGE_TABLE_FIELD.datums,
  nobraukumaOdometrs: PROVIN_MILEAGE_TABLE_FIELD.odometrsKm,
  nobraukumaValsts: PROVIN_MILEAGE_TABLE_FIELD.valsts,
  negadijumuSkaits: "negadijumu_skaits",
  csngDatums: "csng_datums",
  zaudejumuSumma: "zaudejumu_summa",
} as const;

export function emptyCsddMileageRow(): CsddMileageRow {
  return { date: "", odometer: "", country: "" };
}

export function csddMileageRowHasData(r: CsddMileageRow): boolean {
  return Boolean(r.date.trim() || r.odometer.trim());
}

/** Odometrs no ielīmēta teksta — noņem atstarpes, „km”, atstāj ciparus. */
export function normalizeOdometerFromPaste(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim().replace(/\s*km\s*$/i, "").trim();
  const digits = t.replace(/[^\d]/g, "");
  return digits || t;
}

/** Jaunākie augšā (dilstošā secībā pēc datuma). */
export function sortMileageHistoryDescending(rows: CsddMileageRow[]): CsddMileageRow[] {
  return [...rows].sort((a, b) => mileageDateSortKey(b.date) - mileageDateSortKey(a.date));
}

/** No masīva gala saglabā tukšas melnraksta rindas (admin „+ Rinda”; `mergeSourceBlocksWithDefaults`). */
function splitTrailingEmptyBy<T>(rows: T[], hasData: (r: T) => boolean): { head: T[]; trailing: T[] } {
  let end = rows.length;
  while (end > 0 && !hasData(rows[end - 1]!)) end--;
  return { head: rows.slice(0, end), trailing: rows.slice(end) };
}

/**
 * Viena hronoloģiska vēsture: apvieno LV + ārvalstu masīvus.
 * 1) Ja vienāds datums+odometrs vairākos ierakstos → saglabā to ar **konkrētu valsti**, nevis „Latvija”, ja tāda ir.
 * 2) Pēc tam precīzi dublikāti (datums+odometrs+valsts) tiek noņemti.
 * 3) Vienmērīgi tukšās rindas masīva **galā** paliek (rediģēšanai), nevis tiek atmestas.
 */
export function finalizeMileageHistory(rows: CsddMileageRow[]): CsddMileageRow[] {
  const { head, trailing } = splitTrailingEmptyBy(rows, csddMileageRowHasData);
  const withData = head.filter(csddMileageRowHasData);
  if (withData.length === 0) return trailing;
  const merged = mergeDuplicateDateKmPreferNonLv(withData);
  const seen = new Set<string>();
  const deduped: CsddMileageRow[] = [];
  for (const r of merged) {
    const k = mileageDedupKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }
  return [...sortMileageHistoryDescending(deduped), ...trailing];
}

/** Atslēga: datums + odometrs (bez valsts) — saplūdināšanai, ja abi bloki dod vienu un to pašu dienu/km. */
function mileageDedupKeyDateKm(r: CsddMileageRow): string {
  const ts = mileageDateSortKey(r.date);
  const km = normalizeOdometerFromPaste(r.odometer);
  if (ts !== 0) return `${ts}|${km}`;
  return `0|${r.date.trim().replace(/\s+/g, "")}|${km}`;
}

function mergeDuplicateDateKmPreferNonLv(rows: CsddMileageRow[]): CsddMileageRow[] {
  const map = new Map<string, CsddMileageRow[]>();
  for (const r of rows) {
    const k = mileageDedupKeyDateKm(r);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  const out: CsddMileageRow[] = [];
  for (const group of map.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    const specific = group.find(
      (r) => r.country.trim() && r.country.trim() !== CSDD_MILEAGE_COUNTRY_LV,
    );
    if (specific) out.push(specific);
    else out.push(group[0]!);
  }
  return out;
}

/** Unikālā atslēga: datums + odometrs + valsts. */
function mileageDedupKey(r: CsddMileageRow): string {
  const ts = mileageDateSortKey(r.date);
  const km = normalizeOdometerFromPaste(r.odometer);
  const c = r.country.trim();
  if (ts !== 0) return `${ts}|${km}|${c}`;
  return `0|${r.date.trim().replace(/\s+/g, "")}|${km}|${c}`;
}

function mileageDateSortKey(s: string): number {
  return parseDotOrIsoDateToMs(s);
}

/** Strukturētie lauki PDF atskaitei (bez raw). */
export function csddFormHasContent(f: CsddFormFields): boolean {
  return (
    CSDD_FORM_STRUCTURED_FIELDS.some(({ key }) => wsStr(f[key]).trim().length > 0) ||
    (f.mileageHistory ?? []).some(csddMileageRowHasData) ||
    (f.technicalInspectionHistory ?? []).some((r) => r.date.trim()) ||
    (f.ownerRegistrationEvents ?? []).some((r) => r.date.trim() || r.label.trim()) ||
    previousInspectionBlockHasData(f.prevInspectionBlock) ||
    wsStr(f.comments).trim().length > 0 ||
    sourcePdfChecklistHasAny(f.pdfChecklist)
  );
}

/** Teksts km/VIN heuristiku (`extractKmCandidates`, u.c.) — ietver arī raw. */
export function csddFormToPlainText(f: CsddFormFields): string {
  const lines: string[] = [];
  for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
    const v = String((f[key] as string | undefined) ?? "").trim();
    if (v) lines.push(`${label} ${v}`);
  }
  const mh = (f.mileageHistory ?? []).filter(csddMileageRowHasData);
  if (mh.length > 0) {
    lines.push(CSDD_MILEAGE_UNIFIED_TITLE);
    for (const row of mh) {
      lines.push(
        [row.date, row.odometer, row.country]
          .map((c) => c.replace(/\s+/g, " ").trim())
          .join("\t"),
      );
    }
  }
  const prev = f.prevInspectionBlock;
  if (previousInspectionBlockHasData(prev)) {
    lines.push(CSDD_PREVIOUS_INSPECTION_TITLE);
    if (prev.inspectionType.trim()) lines.push(`Pārbaudes veids: ${prev.inspectionType.trim()}`);
    if (prev.odometer.trim()) lines.push(`Odometra rādījums: ${prev.odometer.trim()}`);
    if (prev.ratingLabel.trim()) lines.push(`Novērtējums: ${prev.ratingLabel.trim()}`);
    if (prev.smokeCoefficient.trim()) lines.push(`Dūmainības koeficients: ${prev.smokeCoefficient.trim()}`);
    if (prev.notes.trim()) lines.push(`Piezīmes: ${prev.notes.trim()}`);
    for (const d of prev.defects ?? []) {
      if (!d.code.trim() && !d.description.trim()) continue;
      lines.push(`${d.code}\t${d.rating}\t${d.description}`.trim());
    }
  }
  const ta = (f.technicalInspectionHistory ?? []).filter((r) => r.date.trim());
  if (ta.length > 0) {
    lines.push(CSDD_TECHNICAL_INSPECTION_HISTORY_TITLE);
    for (const row of ta) {
      lines.push(
        [row.date, row.inspectionType, row.ratingLabel ? `Novērtējums ${row.ratingLabel}` : ""]
          .filter(Boolean)
          .join(" · "),
      );
      if (row.smokeCoefficient.trim()) lines.push(`Dūmainības koeficients: ${row.smokeCoefficient.trim()}`);
      if (row.notes.trim()) lines.push(`Piezīmes: ${row.notes.trim()}`);
      for (const d of row.defects ?? []) {
        if (!d.code.trim() && !d.description.trim()) continue;
        lines.push(`${d.code}\t${d.rating}\t${d.description}`.trim());
      }
    }
  }
  const owners = (f.ownerRegistrationEvents ?? []).filter((r) => r.date.trim() || r.label.trim());
  if (owners.length > 0) {
    lines.push("Īpašnieku maiņas Latvijā:");
    for (const row of owners) {
      lines.push(`${row.date} — ${row.label}`);
    }
  }
  const checklistTxt = formatSourcePdfChecklistForPdf(f.pdfChecklist);
  if (checklistTxt) lines.push(checklistTxt);
  if ((f.comments ?? "").trim()) {
    lines.push(`${LISTING_ANALYSIS_COMMENT_LABEL}\n${(f.comments ?? "").trim()}`);
  }
  if ((f.rawUnprocessedData ?? "").trim()) lines.push((f.rawUnprocessedData ?? "").trim());
  return lines.join("\n");
}

/** PROVIN SELECT PDF — strukturētie CSDD lauki bez `rawUnprocessedData`. */
export function csddFormToConsultationPdfStructuredText(f: CsddFormFields): string {
  const lines: string[] = [];
  for (const { key, label } of CSDD_FORM_STRUCTURED_FIELDS) {
    const v = (f[key] as string).trim();
    if (v) lines.push(`${label} ${v}`);
  }
  const mh = f.mileageHistory.filter(csddMileageRowHasData);
  if (mh.length > 0) {
    lines.push(CSDD_MILEAGE_UNIFIED_TITLE);
    for (const row of mh) {
      lines.push(
        [row.date, row.odometer, row.country]
          .map((c) => c.replace(/\s+/g, " ").trim())
          .join("\t"),
      );
    }
  }
  const checklistTxt = formatSourcePdfChecklistForPdf(f.pdfChecklist);
  if (checklistTxt) lines.push(checklistTxt);
  return lines.join("\n");
}

export type SourceDataRow = {
  date: string;
  km: string;
  amount: string;
};

export type StandardSourceBlockState = {
  rows: SourceDataRow[];
  comments: string;
};

/** AUTO RECORDS — ielīmēts RAW + parsētā servisa vēsture (PDF: tabula bez raw). */
export type AutoRecordsBlockState = {
  rawUnprocessedData: string;
  serviceHistory: AutoRecordsServiceRow[];
  /** Outvin Check & Buy — strukturētie dati + raw cache. */
  outvin?: OutvinDataBundle;
  /** Outvin dīlera atskaite — transporta info, negadījumi, nozagts, komplektācija (PDF bez km tabulas). */
  outvinReport?: OutvinDealerReport;
  /** Kā citiem avotiem — piezīmes zem tabulas. */
  comments: string;
  /** Papildu konteksts tikai Gemini AI — nav PDF. */
  geminiContextRaw: string;
  pdfChecklist?: SourcePdfChecklist;
};

export type { OutvinDataBundle } from "@/lib/outvin-data-bundle";

/** LTAB / OCTA — viena negadījuma rinda (horizontāli). */
export type LtabIncidentRow = {
  incidentNo: string;
  csngDate: string;
  lossAmount: string;
};

export type LtabBlockState = {
  rows: LtabIncidentRow[];
  comments: string;
  /** PDF importa RAW (tikai admin; nav obligāti klienta PDF). */
  pdfImportRaw?: string;
  /** Papildu konteksts tikai Gemini AI — nav PDF. */
  geminiContextRaw: string;
};

/** AutoDNA / CarVertical — nobraukums (kā AUTO RECORDS) + negadījumi (kā LTAB). */
export type VendorAvotuBlockState = {
  serviceHistory: AutoRecordsServiceRow[];
  incidents: LtabIncidentRow[];
  comments: string;
  /** CarVertical odometra žurnāla RAW (tikai admin; nav obligāti PDF). */
  mileagePasteRaw?: string;
  /** CarVertical — transportlīdzekļa ierakstu laikposms. */
  vehicleHistoryTimeline?: CarVerticalTimelineRow[];
  /** CarVertical — bojājumu detaļas (PDF grafiks + admin). */
  damageDetails?: CarVerticalDamageDetailRow[];
  pdfChecklist?: SourcePdfChecklist;
  /** Papildu konteksts tikai Gemini AI — nav PDF. */
  geminiContextRaw: string;
};

/** Viens papildu avots „Citi avoti” — struktūra kā AutoDNA / CarVertical + RAW žurnāls. */
export type CitiAvotiSectionState = VendorAvotuBlockState & {
  /** Neapstrādātie / iekopētie dati no avota (admin žurnāls). */
  rawUnprocessedData?: string;
  /** Opc. nosaukums (PDF / tabulas avota kolonnā). */
  label?: string;
};

/** Citi avoti — vairākas identiskas avotu sekcijas. */
export type CitiAvotiBlockState = {
  sections: CitiAvotiSectionState[];
};

/** Sludinājuma analīze — brīvā teksta lauki; iekopētais apraksts netiek drukāts PDF (tikai pārdošanas konteksts). */
export type ListingAnalysisBlockState = {
  sellerPortrait: string;
  photoAnalysis: string;
  /** Fotogrāfiju vizuālie pierādījumi — PDF režģī zem „Fotogrāfiju analīze”. */
  photos: ListingAnalysisPhotoMeta[];
  /** Fotogrāfiju grupas ar manuāli ievadāmiem virsrakstiem (datums, avots u.c.). */
  photoGroups: ListingAnalysisPhotoGroup[];
  /** Papildus pārdevēja / uzņēmuma nosaukums — admin + Gemini meklēšanai; nav PDF. */
  extraSellerName: string;
  /** Iekopēts neapstrādāts sludinājuma teksts — tikai adminā, nav PDF. */
  listingPasteRaw: string;
  /** Eksperta / AI sagatavots konteksts — PDF. */
  listingSalesContext: string;
  /** Papildu konteksts tikai Gemini AI — nav PDF. */
  geminiContextRaw: string;
};

export type WorkspaceSourceBlocks = {
  csdd: CsddFormFields;
  tirgus: TirgusFormFields;
  autodna: VendorAvotuBlockState;
  carvertical: VendorAvotuBlockState;
  auto_records: AutoRecordsBlockState;
  ltab: LtabBlockState;
  citi_avoti: CitiAvotiBlockState;
  listing_analysis: ListingAnalysisBlockState;
};

export function emptyDataRow(): SourceDataRow {
  return { date: "", km: "", amount: "" };
}

export function emptyStandardBlock(): StandardSourceBlockState {
  return { rows: [emptyDataRow()], comments: "" };
}

export function emptyAutoRecordsServiceRow(): AutoRecordsServiceRow {
  return { date: "", odometer: "", country: "" };
}

export function emptyAutoRecordsBlock(): AutoRecordsBlockState {
  return {
    rawUnprocessedData: "",
    serviceHistory: [emptyAutoRecordsServiceRow()],
    comments: "",
    geminiContextRaw: "",
  };
}

export function emptyLtabRow(): LtabIncidentRow {
  return { incidentNo: "", csngDate: "", lossAmount: "" };
}

export function emptyLtabBlock(): LtabBlockState {
  return { rows: [emptyLtabRow()], comments: "", pdfImportRaw: "", geminiContextRaw: "" };
}

export function emptyVendorAvotuBlock(): VendorAvotuBlockState {
  return {
    serviceHistory: [emptyAutoRecordsServiceRow()],
    incidents: [emptyLtabRow()],
    comments: "",
    geminiContextRaw: "",
  };
}

/** Droša normalizācija — null / daļējs JSON neizraisa `.map()` / `.trim()` kļūdas. */
export function coerceVendorAvotuBlock(b: unknown): VendorAvotuBlockState {
  if (!b || typeof b !== "object") return emptyVendorAvotuBlock();
  return repairVendorBlock(b as VendorAvotuBlockState);
}

export function emptyCitiAvotiSection(): CitiAvotiSectionState {
  return { ...emptyVendorAvotuBlock(), rawUnprocessedData: "", label: "" };
}

export function emptyCitiAvotiBlock(): CitiAvotiBlockState {
  return { sections: [emptyCitiAvotiSection()] };
}

export function citiAvotiSectionLabel(section: CitiAvotiSectionState, index: number, total: number): string {
  const custom = section.label?.trim();
  if (custom) return custom;
  if (total > 1) return `Avots ${index + 1}`;
  return SOURCE_BLOCK_LABELS.citi_avoti;
}

export function citiAvotiSectionPdfTitle(section: CitiAvotiSectionState, index: number, total: number): string {
  const label = citiAvotiSectionLabel(section, index, total);
  if (label === SOURCE_BLOCK_LABELS.citi_avoti) return SOURCE_BLOCK_LABELS.citi_avoti;
  return `${SOURCE_BLOCK_LABELS.citi_avoti} — ${label}`;
}

export function citiAvotiSectionHasContent(section: CitiAvotiSectionState): boolean {
  return vendorAvotuBlockHasContent(section) || Boolean(section.rawUnprocessedData?.trim());
}

export function emptyListingAnalysisBlock(): ListingAnalysisBlockState {
  return {
    sellerPortrait: "",
    photoAnalysis: "",
    photos: [],
    photoGroups: [],
    extraSellerName: "",
    listingPasteRaw: "",
    listingSalesContext: "",
    geminiContextRaw: "",
  };
}

export function listingAnalysisHasContent(b: ListingAnalysisBlockState): boolean {
  return (
    wsStr(b.sellerPortrait).trim().length > 0 ||
    wsStr(b.photoAnalysis).trim().length > 0 ||
    (b.photos?.length ?? 0) > 0 ||
    countListingAnalysisPhotos(b.photoGroups) > 0 ||
    wsStr(b.extraSellerName).trim().length > 0 ||
    wsStr(b.listingPasteRaw).trim().length > 0 ||
    wsStr(b.listingSalesContext).trim().length > 0
  );
}

export const LISTING_ANALYSIS_SUBSECTIONS = {
  sellerPortrait: "Pārdevēja portrets",
  photoAnalysis: "Fotogrāfiju analīze",
  listingSalesContext: "Pārdošanas sludinājuma konteksts",
} as const;

/** Papildus pārdevēja nosaukums — admin Gemini analīzei; nav PDF. */
export const LISTING_ANALYSIS_EXTRA_SELLER_LABEL = "Papildus Pārdevēja Nosaukums";

/** Lauks A — ievade analīzei; nav PDF. */
export const LISTING_ANALYSIS_LISTING_PASTE_LABEL = "Sludinājuma apraksts (iekopēšanai)";

/** Tirgus dati integrēti „Sludinājuma analīzē” (PDF + admin). */
export const LISTING_HISTORY_SUBSECTION_TITLE = "Sludinājuma vēsture";

/** Vienots komentāru lauka apzīmējums „Sludinājuma analīzē” un apakšsadaļās. */
export const LISTING_ANALYSIS_COMMENT_LABEL = "Komentāri";

export function listingAnalysisToPlainText(b: ListingAnalysisBlockState): string {
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const parts: string[] = [];
  const extra = wsStr(b.extraSellerName).trim();
  const portrait = wsStr(b.sellerPortrait).trim();
  const photos = wsStr(b.photoAnalysis).trim();
  const sales = wsStr(b.listingSalesContext).trim();
  if (extra) parts.push(`${LISTING_ANALYSIS_EXTRA_SELLER_LABEL}\n${extra}`);
  if (portrait) parts.push(`${L.sellerPortrait}\nKomentāri\n${portrait}`);
  if (photos) parts.push(`${L.photoAnalysis}\nKomentāri\n${photos}`);
  if (sales) parts.push(`${L.listingSalesContext}\nKomentāri\n${sales}`);
  return parts.join("\n\n");
}

function parseListingAnalysisRaw(raw: Record<string, unknown>): ListingAnalysisBlockState {
  const clip = (v: unknown) => String(v ?? "").slice(0, 50_000);
  const sellerPortrait = clip(raw.sellerPortrait);
  const photoAnalysis = clip(raw.photoAnalysis);
  const extraSellerName = clip(raw.extraSellerName);
  const listingPasteRaw = clip(raw.listingPasteRaw);
  let listingSalesContext = clip(raw.listingSalesContext);
  const legacyListingDescription = clip(raw.listingDescription);
  if (!listingSalesContext && legacyListingDescription) {
    listingSalesContext = legacyListingDescription;
  }
  const synced = syncListingAnalysisPhotoGroupsAndFlat(
    normalizeListingAnalysisPhotoGroups(raw.photoGroups, raw.photos),
  );
  return {
    sellerPortrait,
    photoAnalysis,
    photos: synced.photos,
    photoGroups: synced.photoGroups,
    extraSellerName,
    listingPasteRaw,
    listingSalesContext,
    geminiContextRaw: clip(raw.geminiContextRaw),
  };
}

export function createDefaultSourceBlocks(): WorkspaceSourceBlocks {
  return {
    csdd: emptyCsddFields(),
    tirgus: emptyTirgusFields(),
    autodna: emptyVendorAvotuBlock(),
    carvertical: emptyVendorAvotuBlock(),
    auto_records: emptyAutoRecordsBlock(),
    ltab: emptyLtabBlock(),
    citi_avoti: emptyCitiAvotiBlock(),
    listing_analysis: emptyListingAnalysisBlock(),
  };
}

export function rowHasData(r: SourceDataRow): boolean {
  return Boolean(r.date.trim() || r.km.trim() || r.amount.trim());
}

export function standardBlockHasContent(b: StandardSourceBlockState): boolean {
  return b.rows.some(rowHasData) || b.comments.trim().length > 0;
}

export function standardBlockToPlainText(b: StandardSourceBlockState): string {
  const lines = b.rows.filter(rowHasData).map((r) => `${r.date.trim()}\t${r.km.trim()}\t${r.amount.trim()}`);
  const c = wsStr(b.comments).trim();
  return [...lines, ...(c ? [c] : [])].join("\n");
}

export function autoRecordsBlockHasContent(b: AutoRecordsBlockState): boolean {
  return (
    (b.serviceHistory ?? []).some(autoRecordsRowHasData) ||
    wsStr(b.rawUnprocessedData).trim().length > 0 ||
    wsStr(b.comments).trim().length > 0 ||
    outvinDealerReportHasContent(b.outvinReport) ||
    outvinBundleHasStructuredContent(b.outvin ?? getAutoRecordsOutvinBundle(b))
  );
}

export function autoRecordsBlockToPlainText(b: AutoRecordsBlockState): string {
  const lines: string[] = [];
  const mileageRows = (b.serviceHistory ?? []).filter(autoRecordsRowHasData);
  if (mileageRows.length > 0) {
    lines.push("Nobraukuma / servisa vēsture (tabula):");
    for (const r of mileageRows) {
      lines.push(
        [
          formatAutoRecordsDateForOutput(r.date),
          normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
          r.country.replace(/\s+/g, " ").trim(),
        ].join("\t"),
      );
    }
  }

  const outvinReport =
    b.outvinReport && outvinDealerReportHasContent(b.outvinReport)
      ? b.outvinReport
      : (() => {
          const bundle = b.outvin ?? getAutoRecordsOutvinBundle(b);
          return bundle && outvinBundleHasStructuredContent(bundle)
            ? outvinBundleToDealerReport(bundle)
            : undefined;
        })();
  if (outvinReport && outvinDealerReportHasContent(outvinReport)) {
    lines.push("Oficiālā dīlera atskaite (Outvin / auto-records):");
    lines.push(outvinDealerReportToPlainText(outvinReport));
  }

  const outvinBundle = b.outvin ?? getAutoRecordsOutvinBundle(b);
  const dealerLog = (outvinBundle?.dealerServiceLog ?? []).filter(outvinDealerServiceRowHasData);
  if (dealerLog.length > 0) {
    lines.push("Dīlera servisa žurnāls:");
    for (const r of dealerLog) {
      const notes = r.serviceNotes?.trim();
      lines.push(
        [
          formatAutoRecordsDateForOutput(r.date),
          normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
          r.country.replace(/\s+/g, " ").trim(),
          notes,
        ]
          .filter(Boolean)
          .join("\t"),
      );
    }
  }

  const checklistTxt = formatSourcePdfChecklistForPdf(b.pdfChecklist);
  if (checklistTxt) lines.push(checklistTxt);
  if ((b.comments ?? "").trim()) lines.push(`Komentāri\n${(b.comments ?? "").trim()}`);
  if ((b.rawUnprocessedData ?? "").trim()) lines.push((b.rawUnprocessedData ?? "").trim());
  return lines.join("\n\n");
}

export function ltabRowHasData(r: LtabIncidentRow): boolean {
  return Boolean(r.incidentNo.trim() || r.csngDate.trim() || r.lossAmount.trim());
}

export function ltabBlockHasContent(b: LtabBlockState): boolean {
  return (b.rows ?? []).some(ltabRowHasData) || wsStr(b.comments).trim().length > 0;
}

/**
 * Teksts apdrošināšanas / OCTA heuristiku: katrā rindā datums + EUR, lai `parseClaimRowsFromLineBasedText` varētu nolasīt.
 */
export function ltabBlockToPlainText(b: LtabBlockState): string {
  const lines = (b.rows ?? []).filter(ltabRowHasData).map((r) => {
    const d = r.csngDate.trim();
    const rawAmt = r.lossAmount.trim();
    const amt =
      rawAmt && !/EUR|€/i.test(rawAmt) ? `${rawAmt.replace(/\s+/g, " ")} EUR` : rawAmt.replace(/\s+/g, " ");
    const n = r.incidentNo.trim();
    const core = [d, amt].filter(Boolean).join("\t");
    return n ? `${core}\t${n}`.trim() : core;
  });
  const c = wsStr(b.comments).trim();
  return [...lines, ...(c ? [c] : [])].join("\n");
}

export function vendorAvotuBlockHasContent(b: VendorAvotuBlockState | null | undefined): boolean {
  const safe = coerceVendorAvotuBlock(b);
  return (
    (safe.serviceHistory ?? []).some(autoRecordsRowHasData) ||
    (safe.incidents ?? []).some(ltabRowHasData) ||
    (safe.vehicleHistoryTimeline ?? []).some((r) => r.date.trim() || r.description.trim()) ||
    (safe.damageDetails ?? []).some((r) => r.date.trim() || r.lossAmount.trim()) ||
    wsStr(safe.comments).trim().length > 0 ||
    sourcePdfChecklistHasAny(safe.pdfChecklist)
  );
}

export function vendorAvotuBlockToPlainText(b: VendorAvotuBlockState | null | undefined): string {
  const safe = coerceVendorAvotuBlock(b);
  const lines: string[] = [];
  const mh = (safe.serviceHistory ?? []).filter(autoRecordsRowHasData);
  if (mh.length > 0) {
    lines.push(CSDD_MILEAGE_UNIFIED_TITLE);
    for (const r of mh) {
      const odometer = wsStr(r?.odometer);
      const country = wsStr(r?.country).replace(/\s+/g, " ").trim();
      lines.push(
        [
          formatAutoRecordsDateForOutput(wsStr(r?.date)),
          normalizeAutoRecordsOdometer(odometer) || odometer.replace(/\D/g, ""),
          country,
        ].join("\t"),
      );
    }
  }
  const inc = (safe.incidents ?? []).filter(ltabRowHasData);
  if (inc.length > 0) {
    lines.push(NEGADIJUMU_VESTURE_TITLE);
    for (const r of inc) {
      lines.push(
        [wsStr(r?.incidentNo).trim(), wsStr(r?.csngDate).trim(), wsStr(r?.lossAmount).trim()].join("\t"),
      );
    }
  }
  const timeline = (safe.vehicleHistoryTimeline ?? []).filter((r) => r.date.trim() || r.description.trim());
  if (timeline.length > 0) {
    lines.push(CARVERTICAL_TIMELINE_TITLE);
    for (const r of timeline) {
      lines.push([r.date, r.country, r.description].join("\t"));
    }
  }
  const checklistTxt = formatSourcePdfChecklistForPdf(safe.pdfChecklist);
  if (checklistTxt) lines.push(checklistTxt);
  const comments = wsStr(safe.comments).trim();
  if (comments) lines.push(`Komentāri\n${comments}`);
  return lines.join("\n");
}

export function citiAvotiHasContent(b: CitiAvotiBlockState): boolean {
  return (b.sections ?? []).some(citiAvotiSectionHasContent);
}

function citiAvotiSectionToPlainText(section: CitiAvotiSectionState): string {
  const parts: string[] = [];
  const raw = section.rawUnprocessedData?.trim();
  if (raw) parts.push(`RAW datu žurnāls\n${raw}`);
  const vendor = vendorAvotuBlockToPlainText(section);
  if (vendor) parts.push(vendor);
  return appendGeminiContextRawSection(parts.join("\n\n"), section.geminiContextRaw);
}

export function citiAvotiToPlainText(b: CitiAvotiBlockState): string {
  const sections = b.sections ?? [];
  const total = sections.length;
  const parts: string[] = [];
  for (const [i, section] of sections.entries()) {
    if (!citiAvotiSectionHasContent(section)) continue;
    const body = citiAvotiSectionToPlainText(section);
    if (!body) continue;
    const head = citiAvotiSectionPdfTitle(section, i, total);
    parts.push(total > 1 ? `【${head}】\n${body}` : body);
  }
  return parts.join("\n\n");
}

/** Zaudējumu summas avoti (AutoDNA, CarVertical) — ne AUTO RECORDS. */
const LOSS_VENDOR_KEYS = ["autodna", "carvertical"] as const satisfies readonly StandardSourceBlockKey[];

export function mergeVendorBlocksPlain(blocks: WorkspaceSourceBlocks): string {
  const parts: string[] = [];
  for (const k of LOSS_VENDOR_KEYS) {
    const t = vendorAvotuBlockToPlainText(blocks[k]);
    if (!t) continue;
    parts.push(`【${SOURCE_BLOCK_LABELS[k]}】\n${t}`);
  }
  const ar = autoRecordsBlockToPlainText(blocks.auto_records).trim();
  if (ar) parts.push(`【${SOURCE_BLOCK_LABELS.auto_records}】\n${ar}`);
  return parts.join("\n\n");
}

export function blocksToLegacyFlatFields(blocks: WorkspaceSourceBlocks): {
  csdd: string;
  ltab: string;
  tirgus: string;
  citi: string;
} {
  const vendorPlain = mergeVendorBlocksPlain(blocks);
  const citiPlain = citiAvotiToPlainText(blocks.citi_avoti).trim();
  const citiParts: string[] = [];
  if (vendorPlain) citiParts.push(vendorPlain);
  if (citiPlain) citiParts.push(`【${SOURCE_BLOCK_LABELS.citi_avoti}】\n${citiPlain}`);
  return {
    csdd: csddFormToPlainText(blocks.csdd),
    ltab: ltabBlockToPlainText(blocks.ltab),
    tirgus: tirgusFormToPlainText(blocks.tirgus),
    citi: citiParts.join("\n\n"),
  };
}

export type ClientManualVendorBlockPdf = {
  title: string;
  mileageRows: AutoRecordsServiceRow[];
  incidentRows: LtabIncidentRow[];
  comments: string;
  pdfChecklist?: SourcePdfChecklist;
  vehicleHistoryTimeline?: CarVerticalTimelineRow[];
  damageDetails?: CarVerticalDamageDetailRow[];
};

/** Strukturēts LTAB bloks PDF — atsevišķi panelī pēc AutoDNA / CV / Auto-Records (kā admin režģī). */
export type ClientManualLtabBlockPdf = {
  rows: LtabIncidentRow[];
  comments: string;
};

export function toPdfManualVendorBlocks(blocks: WorkspaceSourceBlocks): ClientManualVendorBlockPdf[] {
  const out: ClientManualVendorBlockPdf[] = [];
  for (const k of LOSS_VENDOR_KEYS) {
    const b = blocks[k];
    if (!vendorAvotuBlockHasContent(b)) continue;
    out.push({
      title: SOURCE_BLOCK_LABELS[k],
      mileageRows: (b.serviceHistory ?? []).filter(autoRecordsRowHasData),
      incidentRows: (b.incidents ?? []).filter(ltabRowHasData),
      comments: (b.comments ?? "").trim(),
      ...(sourcePdfChecklistHasAny(b.pdfChecklist) ? { pdfChecklist: b.pdfChecklist } : {}),
      ...(k === "carvertical" && (b.vehicleHistoryTimeline ?? []).length > 0
        ? { vehicleHistoryTimeline: b.vehicleHistoryTimeline }
        : {}),
      ...(k === "carvertical" && (b.damageDetails ?? []).length > 0
        ? { damageDetails: b.damageDetails }
        : {}),
    });
  }
  const citiSections = blocks.citi_avoti.sections ?? [];
  const citiTotal = citiSections.length;
  for (const [i, citi] of citiSections.entries()) {
    if (!citiAvotiSectionHasContent(citi)) continue;
    out.push({
      title: citiAvotiSectionPdfTitle(citi, i, citiTotal),
      mileageRows: (citi.serviceHistory ?? []).filter(autoRecordsRowHasData),
      incidentRows: (citi.incidents ?? []).filter(ltabRowHasData),
      comments: (citi.comments ?? "").trim(),
      ...(sourcePdfChecklistHasAny(citi.pdfChecklist) ? { pdfChecklist: citi.pdfChecklist } : {}),
    });
  }
  return out;
}

export function toPdfLtabManualBlock(b: LtabBlockState): ClientManualLtabBlockPdf | null {
  if (!ltabBlockHasContent(b)) return null;
  return {
    rows: b.rows.filter(ltabRowHasData),
    comments: b.comments.trim(),
  };
}

function mapUnknownArrayToAutoRecordsRows(rowsIn: unknown[]): AutoRecordsServiceRow[] {
  return rowsIn.map((row) => {
    if (!row || typeof row !== "object") return emptyAutoRecordsServiceRow();
    const x = row as Record<string, unknown>;
    return {
      date: String(x.date ?? "").slice(0, 40),
      odometer: String(x.odometer ?? "").slice(0, 40),
      country: String(x.country ?? "").slice(0, 120),
    };
  });
}

function normalizeParsedAutoRecordsRows(rawRows: AutoRecordsServiceRow[]): AutoRecordsServiceRow[] {
  const { head, trailing } = splitTrailingEmptyBy(rawRows, autoRecordsRowHasData);
  const dataRows = head.filter(autoRecordsRowHasData);
  const sorted = sortAutoRecordsDescending(dataRows);
  const clip = (r: AutoRecordsServiceRow) => ({
    date: formatAutoRecordsDateForOutput(r.date),
    odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
    country: normalizeCountryNameLv(r.country.replace(/\s+/g, " ").trim()),
  });
  const normalized = sorted.map(clip);
  const normalizedTrailing = trailing.map(clip);
  const out = [...normalized, ...normalizedTrailing];
  return out.length > 0 ? out : [emptyAutoRecordsServiceRow()];
}

function parseOutvinDealerReportRaw(raw: unknown): OutvinDealerReport | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const base = emptyOutvinDealerReport();
  const vi = o.vehicleInfo;
  if (vi && typeof vi === "object") {
    const v = vi as Record<string, unknown>;
    for (const key of Object.keys(base.vehicleInfo) as (keyof typeof base.vehicleInfo)[]) {
      if (typeof v[key] === "string") base.vehicleInfo[key] = v[key].slice(0, 500);
    }
  }
  if (typeof o.accidentCheck === "string") base.accidentCheck = o.accidentCheck.slice(0, 8000);
  if (typeof o.stolenCheck === "string") base.stolenCheck = o.stolenCheck.slice(0, 8000);
  if (Array.isArray(o.equipment)) {
    base.equipment = o.equipment
      .map((line) => {
        if (!line || typeof line !== "object") return { code: "", description: "" };
        const x = line as Record<string, unknown>;
        return {
          code: String(x.code ?? "").slice(0, 32),
          description: String(x.description ?? "").slice(0, 400),
        };
      })
      .filter((l) => l.code.trim() || l.description.trim());
  }
  return outvinDealerReportHasContent(base) ? base : undefined;
}

function parseAutoRecordsBlockRaw(raw: Record<string, unknown>): AutoRecordsBlockState {
  if ("serviceHistory" in raw || "rawUnprocessedData" in raw || "outvinReport" in raw || "outvin" in raw) {
    const rowsIn = Array.isArray(raw.serviceHistory) ? raw.serviceHistory : [];
    const rawRows = mapUnknownArrayToAutoRecordsRows(rowsIn);
    const normalized = normalizeParsedAutoRecordsRows(rawRows);
    const outvinReport = parseOutvinDealerReportRaw(raw.outvinReport);
    const outvin = parseOutvinDataBundleRaw(raw.outvin);
    return {
      rawUnprocessedData: String(raw.rawUnprocessedData ?? "").slice(0, 500_000),
      serviceHistory: normalized,
      comments: typeof raw.comments === "string" ? raw.comments.slice(0, 12000) : "",
      geminiContextRaw: clipGeminiContextRaw(raw.geminiContextRaw),
      ...(outvin ? { outvin } : {}),
      ...(outvinReport ? { outvinReport } : {}),
      ...("pdfChecklist" in raw ? { pdfChecklist: normalizeSourcePdfChecklist(raw.pdfChecklist) } : {}),
    };
  }
  const legacy = parseStandardBlockRaw(raw);
  const legacyText = standardBlockToPlainText(legacy).trim();
  if (!legacyText) return emptyAutoRecordsBlock();
  return {
    rawUnprocessedData: legacyText.slice(0, 500_000),
    serviceHistory: [emptyAutoRecordsServiceRow()],
    comments: "",
    geminiContextRaw: "",
  };
}

function parseStandardBlockRaw(raw: Record<string, unknown>): StandardSourceBlockState {
  const rowsIn = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: SourceDataRow[] = rowsIn
    .map((row) => {
      if (!row || typeof row !== "object") return emptyDataRow();
      const x = row as Record<string, unknown>;
      return {
        date: String(x.date ?? "").slice(0, 120),
        km: String(x.km ?? "").slice(0, 120),
        amount: String(x.amount ?? "").slice(0, 120),
      };
    })
    .filter((row) => row.date || row.km || row.amount);
  const comments = typeof raw.comments === "string" ? raw.comments : "";
  return {
    rows: rows.length > 0 ? rows : [emptyDataRow()],
    comments,
  };
}

export function migrateLegacyVendorBlock(legacy: StandardSourceBlockState): VendorAvotuBlockState {
  const rows = legacy.rows;
  const mileageFromLegacy = rows
    .map((r) => ({
      date: formatAutoRecordsDateForOutput(r.date),
      odometer: normalizeAutoRecordsOdometer(r.km) || r.km.replace(/\D/g, ""),
      country: "",
    }))
    .filter(autoRecordsRowHasData);
  const sorted = sortAutoRecordsDescending(mileageFromLegacy);
  const serviceHistory = sorted.length > 0 ? sorted : [emptyAutoRecordsServiceRow()];

  const incidentsFromAmount = rows
    .filter((r) => r.amount.trim().length > 0)
    .map((r) => ({
      incidentNo: "",
      csngDate: r.date.trim().slice(0, 120),
      lossAmount: r.amount.trim().slice(0, 120),
    }));
  const incidents = incidentsFromAmount.length > 0 ? incidentsFromAmount : [emptyLtabRow()];

  return {
    serviceHistory,
    incidents,
    comments: legacy.comments,
    geminiContextRaw: "",
  };
}

function normalizeVendorMileageRowsFromRaw(rowsIn: unknown[]): AutoRecordsServiceRow[] {
  return normalizeParsedAutoRecordsRows(mapUnknownArrayToAutoRecordsRows(rowsIn));
}

function normalizeVendorIncidentsFromRaw(rowsIn: unknown[]): LtabIncidentRow[] {
  const rows: LtabIncidentRow[] = rowsIn.map((row) => {
    if (!row || typeof row !== "object") return emptyLtabRow();
    const x = row as Record<string, unknown>;
    return normalizeLtabIncidentRow({
      incidentNo: String(x.incidentNo ?? "").slice(0, 120),
      csngDate: String(x.csngDate ?? "").slice(0, 120),
      lossAmount: String(x.lossAmount ?? "").slice(0, 120),
    });
  });
  const { head, trailing } = splitTrailingEmptyBy(rows, ltabRowHasData);
  const dataRows = head.filter(ltabRowHasData);
  const out = [...dataRows, ...trailing];
  return out.length > 0 ? out : [emptyLtabRow()];
}

function parseVendorAvotuBlockRaw(raw: Record<string, unknown>): VendorAvotuBlockState {
  if ("serviceHistory" in raw || "incidents" in raw) {
    const shIn = Array.isArray(raw.serviceHistory) ? raw.serviceHistory : [];
    const incIn = Array.isArray(raw.incidents) ? raw.incidents : [];
    const timelineIn = Array.isArray(raw.vehicleHistoryTimeline) ? raw.vehicleHistoryTimeline : [];
    const damageIn = Array.isArray(raw.damageDetails) ? raw.damageDetails : [];
    return {
      serviceHistory: normalizeVendorMileageRowsFromRaw(shIn as unknown[]),
      incidents: normalizeVendorIncidentsFromRaw(incIn as unknown[]),
      comments: typeof raw.comments === "string" ? raw.comments.slice(0, 12000) : "",
      geminiContextRaw: clipGeminiContextRaw(raw.geminiContextRaw),
      ...(typeof raw.mileagePasteRaw === "string"
        ? { mileagePasteRaw: raw.mileagePasteRaw.slice(0, 24_000) }
        : {}),
      ...(timelineIn.length > 0
        ? {
            vehicleHistoryTimeline: timelineIn.map((row) => {
              const x = row as Record<string, unknown>;
              return {
                date: String(x.date ?? "").slice(0, 40),
                country: String(x.country ?? "").slice(0, 120),
                description: String(x.description ?? "").slice(0, 400),
              };
            }),
          }
        : {}),
      ...(damageIn.length > 0
        ? {
            damageDetails: damageIn.map((row) => {
              const x = row as Record<string, unknown>;
              return {
                date: String(x.date ?? "").slice(0, 40),
                country: String(x.country ?? "").slice(0, 120),
                lossAmount: normalizeLossAmountEurDisplay(String(x.lossAmount ?? "")).slice(0, 120),
                damagedSides: String(x.damagedSides ?? "").slice(0, 200),
                damageGroups: String(x.damageGroups ?? "").slice(0, 600),
              };
            }),
          }
        : {}),
      ...("pdfChecklist" in raw ? { pdfChecklist: normalizeSourcePdfChecklist(raw.pdfChecklist) } : {}),
    };
  }
  return migrateLegacyVendorBlock(parseStandardBlockRaw(raw));
}

function parseLtabBlockRaw(raw: Record<string, unknown>): LtabBlockState {
  const rowsIn = Array.isArray(raw.rows) ? raw.rows : [];
  const comments = typeof raw.comments === "string" ? raw.comments : "";
  const pdfImportRaw = typeof raw.pdfImportRaw === "string" ? raw.pdfImportRaw.slice(0, 120_000) : "";
  const rows: LtabIncidentRow[] = rowsIn.map((row) => {
    if (!row || typeof row !== "object") return emptyLtabRow();
    const x = row as Record<string, unknown>;
    if ("incidentNo" in x || "csngDate" in x || "lossAmount" in x) {
      return normalizeLtabIncidentRow({
        incidentNo: String(x.incidentNo ?? "").slice(0, 120),
        csngDate: String(x.csngDate ?? "").slice(0, 120),
        lossAmount: String(x.lossAmount ?? "").slice(0, 120),
      });
    }
    return normalizeLtabIncidentRow({
      incidentNo: String(x.km ?? "").slice(0, 120),
      csngDate: String(x.date ?? "").slice(0, 120),
      lossAmount: String(x.amount ?? "").slice(0, 120),
    });
  });
  if (rows.length === 0) {
    return {
      rows: [emptyLtabRow()],
      comments,
      geminiContextRaw: clipGeminiContextRaw(raw.geminiContextRaw),
      ...(pdfImportRaw ? { pdfImportRaw } : {}),
    };
  }
  const { head, trailing } = splitTrailingEmptyBy(rows, ltabRowHasData);
  const dataRows = head.filter(ltabRowHasData);
  const combined = [...dataRows, ...trailing];
  return {
    rows: combined.length > 0 ? combined : [emptyLtabRow()],
    comments,
    geminiContextRaw: clipGeminiContextRaw(raw.geminiContextRaw),
    ...(pdfImportRaw ? { pdfImportRaw } : {}),
  };
}

function parseCsddMileageHistoryRaw(raw: unknown): CsddMileageHistoryRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: CsddMileageHistoryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const x = row as Record<string, unknown>;
    rows.push({
      date: String(x.date ?? "").slice(0, 120),
      odometer: String(x.odometer ?? "").slice(0, 120),
    });
  }
  return rows;
}

function parseCsddMileageAbroadRaw(raw: unknown): CsddMileageAbroadRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: CsddMileageAbroadRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const x = row as Record<string, unknown>;
    rows.push({
      date: String(x.date ?? "").slice(0, 120),
      odometer: String(x.odometer ?? "").slice(0, 120),
    });
  }
  return rows;
}

function parseCsddMileageUnifiedRaw(raw: unknown): CsddMileageRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: CsddMileageRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const x = row as Record<string, unknown>;
    /** Bez „country” JSON atslēgas nenoklusējam LV — citādi ārvalstu rindas kļūst par „Latvija”. */
    const country = "country" in x ? normalizeCountryNameLv(String(x.country ?? "").slice(0, 120).trim()) : "";
    rows.push({
      date: String(x.date ?? "").slice(0, 120),
      odometer: String(x.odometer ?? "").slice(0, 120),
      country,
    });
  }
  return rows;
}

/** Vecā JSON struktūra → apvienots masīvs; ārvalstu rindām bez valsts — tukša (PDF: „—”). */
function mergeLegacyMileageArrays(
  lv: CsddMileageHistoryRow[],
  abroad: CsddMileageAbroadRow[],
): CsddMileageRow[] {
  const out: CsddMileageRow[] = [];
  for (const r of lv) {
    if (!r.date.trim() && !r.odometer.trim()) continue;
    out.push({ date: r.date, odometer: r.odometer, country: CSDD_MILEAGE_COUNTRY_LV });
  }
  for (const r of abroad) {
    if (!r.date.trim() && !r.odometer.trim()) continue;
    out.push({ date: r.date, odometer: r.odometer, country: "" });
  }
  return finalizeMileageHistory(out);
}

function clipCsddField(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}

function parseCsddInspectionWarningStoredRaw(raw: unknown): CsddInspectionWarningRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const text = clipCsddField(o.text, 2000);
      const sev = o.severity;
      const severity: CsddInspectionWarningSeverity =
        sev === "gray" || sev === "yellow" || sev === "red" ? sev : "yellow";
      if (!text.trim()) return null;
      return { text, severity };
    })
    .filter((r): r is CsddInspectionWarningRow => r != null);
}

function parseCsddPreviousInspectionStoredRaw(raw: unknown): CsddPreviousInspectionBlock {
  if (!raw || typeof raw !== "object") return emptyCsddPreviousInspectionBlock();
  const o = raw as Record<string, unknown>;
  const ratingRaw = o.ratingLevel;
  const ratingLevel =
    ratingRaw === 1 || ratingRaw === 2 || ratingRaw === 3 ? ratingRaw : null;
  return {
    inspectionType: clipCsddField(o.inspectionType, 120),
    inspectionDateText: clipCsddField(o.inspectionDateText, 40),
    nextInspectionDateText: clipCsddField(o.nextInspectionDateText, 40),
    odometer: clipCsddField(o.odometer, 20),
    ratingLabel: clipCsddField(o.ratingLabel, 200),
    ratingLevel,
    smokeCoefficient: clipCsddField(o.smokeCoefficient, 40),
    notes: clipCsddField(o.notes, 2000),
    defects: parseCsddInspectionDefectStoredRaw(o.defects),
  };
}

function parseCsddInspectionDefectStoredRaw(raw: unknown): CsddInspectionDefectRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const code = clipCsddField(o.code, 40);
      const rating = clipCsddField(o.rating, 4);
      const description = clipCsddField(o.description, 2000);
      if (!code.trim() && !rating.trim() && !description.trim()) return null;
      return { code, rating, description };
    })
    .filter((r): r is CsddInspectionDefectRow => r != null);
}

function parseCsddTechnicalInspectionStoredRaw(raw: unknown): CsddTechnicalInspectionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const ratingRaw = o.ratingLevel;
      const maxDefectRaw = o.maxDefectLevel;
      const ratingLevel =
        ratingRaw === 1 || ratingRaw === 2 || ratingRaw === 3 ? ratingRaw : null;
      const maxDefectLevel =
        maxDefectRaw === 1 || maxDefectRaw === 2 || maxDefectRaw === 3 ? maxDefectRaw : null;
      return {
        date: clipCsddField(o.date, 20),
        inspectionType: clipCsddField(o.inspectionType, 120),
        ratingLabel: clipCsddField(o.ratingLabel, 200),
        ratingLevel,
        maxDefectLevel,
        smokeCoefficient: clipCsddField(o.smokeCoefficient, 40),
        notes: clipCsddField(o.notes, 500),
        defects: parseCsddInspectionDefectStoredRaw(o.defects),
      };
    })
    .filter((r): r is CsddTechnicalInspectionRow => r != null && r.date.trim().length > 0);
}

function parseCsddOwnerEventsStoredRaw(raw: unknown): CsddOwnerChangeRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const date = clipCsddField(o.date, 20);
      const label = clipCsddField(o.label, 200);
      if (!date.trim() && !label.trim()) return null;
      return { date, label };
    })
    .filter((r): r is CsddOwnerChangeRow => r != null);
}

function parseCsddStoredFieldsRaw(raw: Record<string, unknown>): Omit<CsddFormFields, "mileageHistory"> {
  return {
    rawUnprocessedData: clipCsddField(raw.rawUnprocessedData, CSDD_RAW_UNPROCESSED_MAX_LEN),
    makeModel: clipCsddField(raw.makeModel, 240),
    registrationNumber: clipCsddField(raw.registrationNumber, 40),
    firstRegistration: clipCsddField(raw.firstRegistration, 40),
    nextInspectionDate: clipCsddField(raw.nextInspectionDate, 40),
    prevInspectionDate: clipCsddField(raw.prevInspectionDate, 40),
    engineDisplacementCm3: clipCsddField(raw.engineDisplacementCm3, 40),
    enginePowerKw: clipCsddField(raw.enginePowerKw, 40),
    fuelType: clipCsddField(raw.fuelType, 80),
    emissionStandard: clipCsddField(raw.emissionStandard, 40),
    grossMassKg: clipCsddField(raw.grossMassKg, 40),
    curbMassKg: clipCsddField(raw.curbMassKg, 40),
    roadTaxEur: clipCsddField(raw.roadTaxEur, 80),
    registrationStatus: clipCsddField(raw.registrationStatus, 120),
    opacityCoefficient: clipCsddField(raw.opacityCoefficient, 40),
    particulateMatter: clipCsddField(raw.particulateMatter, 80),
    previousRegistrationCountry: clipCsddField(raw.previousRegistrationCountry, 120),
    ownerCountLatvia: clipCsddField(raw.ownerCountLatvia, 8),
    technicalInspectionHistory: parseCsddTechnicalInspectionStoredRaw(raw.technicalInspectionHistory),
    ownerRegistrationEvents: parseCsddOwnerEventsStoredRaw(raw.ownerRegistrationEvents),
    prevInspectionBlock: parseCsddPreviousInspectionStoredRaw(raw.prevInspectionBlock),
    prevInspectionWarnings: parseCsddInspectionWarningStoredRaw(raw.prevInspectionWarnings),
    technicalInspectionWarnings: parseCsddInspectionWarningStoredRaw(raw.technicalInspectionWarnings),
    comments: clipCsddField(raw.comments, 12000),
    geminiContextRaw: clipCsddField(raw.geminiContextRaw, 24_000),
    ...("pdfChecklist" in raw ? { pdfChecklist: normalizeSourcePdfChecklist(raw.pdfChecklist) } : {}),
  };
}

function parseCsddFieldsRaw(raw: Record<string, unknown>): CsddFormFields {
  const base = parseCsddStoredFieldsRaw(raw);
  if ("mileageHistory" in raw && Array.isArray(raw.mileageHistory)) {
    const unified = parseCsddMileageUnifiedRaw(raw.mileageHistory);
    return {
      ...base,
      mileageHistory: finalizeMileageHistory(unified),
    };
  }
  const mileage = parseCsddMileageHistoryRaw(raw.mileageHistoryLv);
  const mileageAbroad = parseCsddMileageAbroadRaw(raw.mileageHistoryAbroad);
  const merged = mergeLegacyMileageArrays(mileage, mileageAbroad);
  return {
    ...base,
    mileageHistory: merged,
  };
}

function parseTirgusBlockRaw(raw: Record<string, unknown>): TirgusFormFields {
  const clip = (v: unknown) => String(v ?? "").slice(0, 4000);
  if ("listedForSale" in raw || "listingCreated" in raw || "priceDrop" in raw) {
    return {
      listedForSale: clip(raw.listedForSale),
      listingCreated: clip(raw.listingCreated),
      priceDrop: clip(raw.priceDrop),
      comments: typeof raw.comments === "string" ? raw.comments : "",
      geminiContextRaw: clip(raw.geminiContextRaw),
    };
  }
  if ("rows" in raw || "comments" in raw) {
    const old = parseStandardBlockRaw(raw);
    const t = standardBlockToPlainText(old).trim();
    return t ? { ...emptyTirgusFields(), comments: t } : emptyTirgusFields();
  }
  return emptyTirgusFields();
}

/** Vecais CSDD { rows, comments } → rindas raw, komentārs atsevišķi. */
export function migrateLegacyCsddBlock(old: StandardSourceBlockState): CsddFormFields {
  const rowLines = old.rows
    .filter(rowHasData)
    .map((r) => `${r.date.trim()}\t${r.km.trim()}\t${r.amount.trim()}`);
  const rowText = rowLines.join("\n").trim();
  const c = old.comments.trim();
  if (!rowText && !c) return emptyCsddFields();
  return { ...emptyCsddFields(), rawUnprocessedData: rowText, comments: c };
}

function wsStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function repairVendorBlock(b: VendorAvotuBlockState | undefined): VendorAvotuBlockState {
  const e = emptyVendorAvotuBlock();
  if (!b) return e;
  const incidents = (Array.isArray(b.incidents) ? b.incidents : e.incidents).map((r) =>
    normalizeLtabIncidentRow({
      incidentNo: wsStr(r?.incidentNo),
      csngDate: wsStr(r?.csngDate),
      lossAmount: normalizeLossAmountEurDisplay(wsStr(r?.lossAmount)),
    }),
  );
  return {
    serviceHistory: Array.isArray(b.serviceHistory) ? b.serviceHistory : e.serviceHistory,
    incidents,
    comments: wsStr(b.comments),
    geminiContextRaw: wsStr(b.geminiContextRaw),
    ...(typeof b.mileagePasteRaw === "string" ? { mileagePasteRaw: b.mileagePasteRaw } : {}),
    ...(Array.isArray(b.vehicleHistoryTimeline) ? { vehicleHistoryTimeline: b.vehicleHistoryTimeline } : {}),
    ...(Array.isArray(b.damageDetails) ? { damageDetails: b.damageDetails } : {}),
    ...(b.pdfChecklist ? { pdfChecklist: b.pdfChecklist } : {}),
  };
}

function repairCitiSection(s: CitiAvotiSectionState | undefined): CitiAvotiSectionState {
  const v = repairVendorBlock(s);
  return {
    ...v,
    rawUnprocessedData: wsStr(s?.rawUnprocessedData),
    label: wsStr(s?.label),
  };
}

/** Garantē masīvus un string laukus pēc merge (bojāts localStorage / daļējs stāvoklis). */
export function repairWorkspaceSourceBlocks(blocks: WorkspaceSourceBlocks): WorkspaceSourceBlocks {
  const d = createDefaultSourceBlocks();
  const csdd = blocks.csdd ?? d.csdd;
  const csddRepaired = backfillCsddExtendedFromRaw({
    ...d.csdd,
    ...csdd,
    mileageHistory: Array.isArray(csdd.mileageHistory) ? csdd.mileageHistory : d.csdd.mileageHistory,
    technicalInspectionHistory: Array.isArray(csdd.technicalInspectionHistory)
      ? csdd.technicalInspectionHistory
      : d.csdd.technicalInspectionHistory,
    ownerRegistrationEvents: Array.isArray(csdd.ownerRegistrationEvents)
      ? csdd.ownerRegistrationEvents
      : d.csdd.ownerRegistrationEvents,
    prevInspectionBlock:
      csdd.prevInspectionBlock && typeof csdd.prevInspectionBlock === "object"
        ? parseCsddPreviousInspectionStoredRaw(csdd.prevInspectionBlock)
        : d.csdd.prevInspectionBlock,
    prevInspectionWarnings: Array.isArray(csdd.prevInspectionWarnings)
      ? parseCsddInspectionWarningStoredRaw(csdd.prevInspectionWarnings)
      : d.csdd.prevInspectionWarnings,
    technicalInspectionWarnings: Array.isArray(csdd.technicalInspectionWarnings)
      ? parseCsddInspectionWarningStoredRaw(csdd.technicalInspectionWarnings)
      : d.csdd.technicalInspectionWarnings,
    comments: wsStr(csdd.comments),
    rawUnprocessedData: wsStr(csdd.rawUnprocessedData),
    geminiContextRaw: wsStr(csdd.geminiContextRaw),
  });
  return {
    csdd: csddRepaired,
    autodna: repairVendorBlock(blocks.autodna),
    carvertical: repairVendorBlock(blocks.carvertical),
    auto_records: {
      ...d.auto_records,
      ...blocks.auto_records,
      serviceHistory: Array.isArray(blocks.auto_records?.serviceHistory)
        ? blocks.auto_records.serviceHistory
        : d.auto_records.serviceHistory,
      comments: wsStr(blocks.auto_records?.comments),
      rawUnprocessedData: wsStr(blocks.auto_records?.rawUnprocessedData),
      geminiContextRaw: wsStr(blocks.auto_records?.geminiContextRaw),
    },
    ltab: {
      ...d.ltab,
      ...blocks.ltab,
      rows: Array.isArray(blocks.ltab?.rows) ? blocks.ltab.rows : d.ltab.rows,
      comments: wsStr(blocks.ltab?.comments),
      pdfImportRaw: wsStr(blocks.ltab?.pdfImportRaw),
      geminiContextRaw: wsStr(blocks.ltab?.geminiContextRaw),
    },
    tirgus: {
      listedForSale: wsStr(blocks.tirgus?.listedForSale),
      listingCreated: wsStr(blocks.tirgus?.listingCreated),
      priceDrop: wsStr(blocks.tirgus?.priceDrop),
      comments: wsStr(blocks.tirgus?.comments),
      geminiContextRaw: wsStr(blocks.tirgus?.geminiContextRaw),
    },
    citi_avoti: {
      sections: (blocks.citi_avoti?.sections ?? d.citi_avoti.sections).map(repairCitiSection),
    },
    listing_analysis: (() => {
      const synced = syncListingAnalysisPhotoGroupsAndFlat(
        normalizeListingAnalysisPhotoGroups(
          blocks.listing_analysis?.photoGroups,
          blocks.listing_analysis?.photos,
        ),
      );
      return {
        sellerPortrait: wsStr(blocks.listing_analysis?.sellerPortrait),
        photoAnalysis: wsStr(blocks.listing_analysis?.photoAnalysis),
        photos: synced.photos,
        photoGroups: synced.photoGroups,
        extraSellerName: wsStr(blocks.listing_analysis?.extraSellerName),
        listingPasteRaw: wsStr(blocks.listing_analysis?.listingPasteRaw),
        listingSalesContext: wsStr(blocks.listing_analysis?.listingSalesContext),
        geminiContextRaw: wsStr(blocks.listing_analysis?.geminiContextRaw),
      };
    })(),
  };
}

export function mergeSourceBlocksWithDefaults(partial: unknown): WorkspaceSourceBlocks {
  const base = createDefaultSourceBlocks();
  if (!partial || typeof partial !== "object") return repairWorkspaceSourceBlocks(base);
  const o = partial as Record<string, unknown>;

  const rawCsdd = o.csdd;
  if (rawCsdd && typeof rawCsdd === "object") {
    const c = rawCsdd as Record<string, unknown>;
    const hasStructuredCsdd =
      "fields" in c ||
      "rawUnprocessedData" in c ||
      "nextInspectionDate" in c ||
      "mileageHistory" in c ||
      "mileageHistoryLv" in c ||
      "mileageHistoryAbroad" in c ||
      "makeModel" in c ||
      "registrationNumber" in c ||
      "firstRegistration" in c ||
      "detailedRatingRows" in c ||
      "prevInspectionBlock" in c ||
      "prevInspectionDefectRows" in c ||
      "comments" in c;
    if (hasStructuredCsdd) {
      const fields = c.fields && typeof c.fields === "object" ? (c.fields as Record<string, unknown>) : c;
      base.csdd = { ...emptyCsddFields(), ...parseCsddFieldsRaw(fields) };
    } else if ("rows" in c || "comments" in c) {
      base.csdd = migrateLegacyCsddBlock(parseStandardBlockRaw(c));
    }
  }

  const rawAutoRecords = o.auto_records;
  if (rawAutoRecords && typeof rawAutoRecords === "object") {
    base.auto_records = parseAutoRecordsBlockRaw(rawAutoRecords as Record<string, unknown>);
  }

  const rawAutodna = o.autodna;
  if (rawAutodna && typeof rawAutodna === "object") {
    base.autodna = parseVendorAvotuBlockRaw(rawAutodna as Record<string, unknown>);
  }
  const rawCarvertical = o.carvertical;
  if (rawCarvertical && typeof rawCarvertical === "object") {
    base.carvertical = parseVendorAvotuBlockRaw(rawCarvertical as Record<string, unknown>);
  }

  const rawTirgus = o.tirgus;
  if (rawTirgus && typeof rawTirgus === "object") {
    base.tirgus = parseTirgusBlockRaw(rawTirgus as Record<string, unknown>);
  }

  const rawLtab = o.ltab;
  if (rawLtab && typeof rawLtab === "object") {
    base.ltab = parseLtabBlockRaw(rawLtab as Record<string, unknown>);
  }

  const rawListing = o.listing_analysis;
  if (rawListing && typeof rawListing === "object") {
    base.listing_analysis = parseListingAnalysisRaw(rawListing as Record<string, unknown>);
  }

  const rawCitiAvoti = o.citi_avoti;
  if (rawCitiAvoti && typeof rawCitiAvoti === "object") {
    base.citi_avoti = parseCitiAvotiRaw(rawCitiAvoti as Record<string, unknown>);
  }

  return repairWorkspaceSourceBlocks(base);
}

function parseCitiAvotiSectionRaw(raw: unknown): CitiAvotiSectionState {
  if (!raw || typeof raw !== "object") return emptyCitiAvotiSection();
  const o = raw as Record<string, unknown>;
  const vendor =
    "serviceHistory" in o || "incidents" in o ?
      parseVendorAvotuBlockRaw(o)
    : { ...emptyVendorAvotuBlock(), comments: typeof o.comments === "string" ? o.comments.slice(0, 12000) : "" };
  return {
    ...vendor,
    rawUnprocessedData:
      typeof o.rawUnprocessedData === "string" ? o.rawUnprocessedData.slice(0, 500_000) : "",
    label: typeof o.label === "string" ? o.label.slice(0, 120) : "",
  };
}

function parseCitiAvotiRaw(raw: Record<string, unknown>): CitiAvotiBlockState {
  if (Array.isArray(raw.sections)) {
    const sections = raw.sections.map((s) => parseCitiAvotiSectionRaw(s));
    return { sections: sections.length > 0 ? sections : [emptyCitiAvotiSection()] };
  }
  if ("serviceHistory" in raw || "incidents" in raw || "rawUnprocessedData" in raw || "label" in raw) {
    return { sections: [parseCitiAvotiSectionRaw(raw)] };
  }
  const legacy = typeof raw.comments === "string" ? raw.comments.slice(0, 12000) : "";
  return { sections: [{ ...emptyVendorAvotuBlock(), comments: legacy, rawUnprocessedData: "", label: "" }] };
}

export function migrateFlatWorkspaceToBlocks(flat: {
  csdd?: string;
  ltab?: string;
  tirgus?: string;
  citi?: string;
}): WorkspaceSourceBlocks {
  const b = createDefaultSourceBlocks();
  if (flat.csdd?.trim()) b.csdd = { ...emptyCsddFields(), rawUnprocessedData: flat.csdd.trim() };
  if (flat.ltab?.trim()) b.ltab = { ...emptyLtabBlock(), comments: flat.ltab.trim() };
  if (flat.tirgus?.trim()) b.tirgus = { ...emptyTirgusFields(), comments: flat.tirgus.trim() };
  if (flat.citi?.trim()) {
    b.citi_avoti = {
      sections: [{ ...emptyVendorAvotuBlock(), comments: flat.citi.trim(), rawUnprocessedData: "", label: "" }],
    };
  }
  return b;
}

export function hydrateWorkspaceFromStorage(raw: string | null): {
  sourceBlocks: WorkspaceSourceBlocks;
  iriss: string;
  apskatesPlāns: string;
  cenasAtbilstiba: string;
  previewConfirmed: boolean;
  pdfVisibility: PdfVisibilitySettings;
  pdfBannerInclude: ProvinBannerPdfInclude;
  manualBanners: ProvinManualBanner[];
  vehicleAiExtraction: VehicleAIExtraction | null;
  vehicleAiExtractionMeta: VehicleAiExtractionMeta | null;
} | null {
  if (!raw) return null;
  try {
    const p = deepSanitizeDraftStrings(JSON.parse(raw)) as Record<string, unknown>;
    let sourceBlocks: WorkspaceSourceBlocks;
    if (p.sourceBlocks && typeof p.sourceBlocks === "object") {
      sourceBlocks = mergeSourceBlocksWithDefaults(p.sourceBlocks);
    } else if ("csdd" in p || "ltab" in p || "tirgus" in p || "citi" in p) {
      sourceBlocks = migrateFlatWorkspaceToBlocks({
        csdd: typeof p.csdd === "string" ? p.csdd : "",
        ltab: typeof p.ltab === "string" ? p.ltab : "",
        tirgus: typeof p.tirgus === "string" ? p.tirgus : "",
        citi: typeof p.citi === "string" ? p.citi : "",
      });
    } else {
      return null;
    }
    const { extraction: vehicleAiExtraction, meta: vehicleAiExtractionMeta } =
      parseVehicleAiFromWorkspaceRecord(p);
    return {
      sourceBlocks,
      iriss: typeof p.iriss === "string" ? p.iriss : "",
      apskatesPlāns: typeof p.apskatesPlāns === "string" ? p.apskatesPlāns : "",
      cenasAtbilstiba: typeof p.cenasAtbilstiba === "string" ? p.cenasAtbilstiba : "",
      previewConfirmed: Boolean(p.previewConfirmed),
      pdfVisibility: mergePdfVisibility(p.pdfVisibility),
      pdfBannerInclude: mergeProvinBannerPdfInclude(p.pdfBannerInclude),
      manualBanners: mergeProvinManualBanners(p.manualBanners),
      vehicleAiExtraction,
      vehicleAiExtractionMeta,
    };
  } catch {
    return null;
  }
}
