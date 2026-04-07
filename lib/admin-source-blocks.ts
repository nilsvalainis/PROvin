/**
 * Strukturēti avotu bloki admin portfelī → sintēze uz PDF / km / VIN heuristiku.
 */

import { mergePdfVisibility, type PdfVisibilitySettings } from "@/lib/pdf-visibility";
import type { AutoRecordsServiceRow } from "./auto-records-paste-parse";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
  sortAutoRecordsDescending,
} from "./auto-records-paste-parse";

export type { AutoRecordsServiceRow };

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
  auto_records: "AUTO RECORDS",
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
  /** Hronoloģiski sakārtots (jaunākais augšā): Datums | Odometrs | Valsts. */
  mileageHistory: CsddMileageRow[];
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
];

/** @deprecated Lietot CSDD_FORM_STRUCTURED_FIELDS */
export const CSDD_FORM_SHORT_FIELDS = CSDD_FORM_STRUCTURED_FIELDS;

/** Tirgus dati — admin un PDF etiķetes (precīzi). */
export type TirgusFormFields = {
  listedForSale: string;
  listingCreated: string;
  priceDrop: string;
  comments: string;
};

export const TIRGUS_LABEL_LISTED = "Auto pārdošanā (dienas):";
export const TIRGUS_LABEL_CREATED = "Izveidots:";
export const TIRGUS_LABEL_PRICE_DROP = "Cenas kritums (eiro):";
/** Senā atsauce; jaunajā UI izmanto LISTING_ANALYSIS_COMMENT_LABEL. */
export const TIRGUS_LABEL_COMMENTS = "Komentāri:";

export function emptyTirgusFields(): TirgusFormFields {
  return { listedForSale: "", listingCreated: "", priceDrop: "", comments: "" };
}

export function tirgusFormHasContent(f: TirgusFormFields | null | undefined): boolean {
  if (!f) return false;
  return (
    f.listedForSale.trim().length > 0 ||
    f.listingCreated.trim().length > 0 ||
    f.priceDrop.trim().length > 0 ||
    f.comments.trim().length > 0
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
    mileageHistory: [],
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

/**
 * Viena hronoloģiska vēsture: apvieno LV + ārvalstu masīvus.
 * 1) Ja vienāds datums+odometrs vairākos ierakstos → saglabā to ar **konkrētu valsti**, nevis „Latvija”, ja tāda ir.
 * 2) Pēc tam precīzi dublikāti (datums+odometrs+valsts) tiek noņemti.
 */
export function finalizeMileageHistory(rows: CsddMileageRow[]): CsddMileageRow[] {
  const withData = rows.filter(csddMileageRowHasData);
  const merged = mergeDuplicateDateKmPreferNonLv(withData);
  const seen = new Set<string>();
  const deduped: CsddMileageRow[] = [];
  for (const r of merged) {
    const k = mileageDedupKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }
  return sortMileageHistoryDescending(deduped);
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
  const t = s.trim();
  const dm = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dm) {
    const d = Number(dm[1]);
    const mo = Number(dm[2]);
    const y = Number(dm[3]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100) {
      return new Date(y, mo - 1, d).getTime();
    }
    return 0;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const ts = new Date(t).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
  return 0;
}

/** Strukturētie lauki PDF atskaitei (bez raw). */
export function csddFormHasContent(f: CsddFormFields): boolean {
  return (
    CSDD_FORM_STRUCTURED_FIELDS.some(({ key }) => (f[key] as string).trim().length > 0) ||
    f.mileageHistory.some(csddMileageRowHasData)
  );
}

/** Teksts km/VIN heuristiku (`extractKmCandidates`, u.c.) — ietver arī raw. */
export function csddFormToPlainText(f: CsddFormFields): string {
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
  if (f.rawUnprocessedData.trim()) lines.push(f.rawUnprocessedData.trim());
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
  /** Kā citiem avotiem — piezīmes zem tabulas. */
  comments: string;
};

/** LTAB / OCTA — viena negadījuma rinda (horizontāli). */
export type LtabIncidentRow = {
  incidentNo: string;
  csngDate: string;
  lossAmount: string;
};

export type LtabBlockState = {
  rows: LtabIncidentRow[];
  comments: string;
};

/** AutoDNA / CarVertical — nobraukums (kā AUTO RECORDS) + negadījumi (kā LTAB). */
export type VendorAvotuBlockState = {
  serviceHistory: AutoRecordsServiceRow[];
  incidents: LtabIncidentRow[];
  comments: string;
};

/** Citi avoti — tā pati struktūra kā AutoDNA / CarVertical (nobraukums + negadījumi + komentāri). */
export type CitiAvotiBlockState = VendorAvotuBlockState;

/** Sludinājuma analīze — trīs brīvā teksta lauki (PDF: apakškategorijas ar „Komentāri”). */
export type ListingAnalysisBlockState = {
  sellerPortrait: string;
  photoAnalysis: string;
  listingDescription: string;
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
  return { rawUnprocessedData: "", serviceHistory: [emptyAutoRecordsServiceRow()], comments: "" };
}

export function emptyLtabRow(): LtabIncidentRow {
  return { incidentNo: "", csngDate: "", lossAmount: "" };
}

export function emptyLtabBlock(): LtabBlockState {
  return { rows: [emptyLtabRow()], comments: "" };
}

export function emptyVendorAvotuBlock(): VendorAvotuBlockState {
  return {
    serviceHistory: [emptyAutoRecordsServiceRow()],
    incidents: [emptyLtabRow()],
    comments: "",
  };
}

export function emptyCitiAvotiBlock(): CitiAvotiBlockState {
  return emptyVendorAvotuBlock();
}

export function emptyListingAnalysisBlock(): ListingAnalysisBlockState {
  return { sellerPortrait: "", photoAnalysis: "", listingDescription: "" };
}

export function listingAnalysisHasContent(b: ListingAnalysisBlockState): boolean {
  return (
    b.sellerPortrait.trim().length > 0 ||
    b.photoAnalysis.trim().length > 0 ||
    b.listingDescription.trim().length > 0
  );
}

export const LISTING_ANALYSIS_SUBSECTIONS = {
  sellerPortrait: "Pārdevēja portrets",
  photoAnalysis: "Fotogrāfiju analīze",
  listingDescription: "Sludinājuma apraksts",
} as const;

/** Tirgus dati integrēti „Sludinājuma analīzē” (PDF + admin). */
export const LISTING_HISTORY_SUBSECTION_TITLE = "Sludinājuma vēsture";

/** Vienots komentāru lauka apzīmējums „Sludinājuma analīzē” un apakšsadaļās. */
export const LISTING_ANALYSIS_COMMENT_LABEL = "Komentāri";

export function listingAnalysisToPlainText(b: ListingAnalysisBlockState): string {
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const parts: string[] = [];
  if (b.sellerPortrait.trim()) {
    parts.push(`${L.sellerPortrait}\nKomentāri\n${b.sellerPortrait.trim()}`);
  }
  if (b.photoAnalysis.trim()) {
    parts.push(`${L.photoAnalysis}\nKomentāri\n${b.photoAnalysis.trim()}`);
  }
  if (b.listingDescription.trim()) {
    parts.push(`${L.listingDescription}\nKomentāri\n${b.listingDescription.trim()}`);
  }
  return parts.join("\n\n");
}

function parseListingAnalysisRaw(raw: Record<string, unknown>): ListingAnalysisBlockState {
  const clip = (v: unknown) => String(v ?? "").slice(0, 8000);
  return {
    sellerPortrait: clip(raw.sellerPortrait),
    photoAnalysis: clip(raw.photoAnalysis),
    listingDescription: clip(raw.listingDescription),
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
  const c = b.comments.trim();
  return [...lines, ...(c ? [c] : [])].join("\n");
}

export function autoRecordsBlockHasContent(b: AutoRecordsBlockState): boolean {
  return (
    b.serviceHistory.some(autoRecordsRowHasData) ||
    b.rawUnprocessedData.trim().length > 0 ||
    b.comments.trim().length > 0
  );
}

export function autoRecordsBlockToPlainText(b: AutoRecordsBlockState): string {
  const lines: string[] = [];
  for (const r of b.serviceHistory.filter(autoRecordsRowHasData)) {
    lines.push(
      [
        formatAutoRecordsDateForOutput(r.date),
        normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
        r.country.replace(/\s+/g, " ").trim(),
      ].join("\t"),
    );
  }
  if (b.comments.trim()) lines.push(`Komentāri\n${b.comments.trim()}`);
  if (b.rawUnprocessedData.trim()) lines.push(b.rawUnprocessedData.trim());
  return lines.join("\n\n");
}

export function ltabRowHasData(r: LtabIncidentRow): boolean {
  return Boolean(r.incidentNo.trim() || r.csngDate.trim() || r.lossAmount.trim());
}

export function ltabBlockHasContent(b: LtabBlockState): boolean {
  return b.rows.some(ltabRowHasData) || b.comments.trim().length > 0;
}

/**
 * Teksts apdrošināšanas / OCTA heuristiku: katrā rindā datums + EUR, lai `parseClaimRowsFromLineBasedText` varētu nolasīt.
 */
export function ltabBlockToPlainText(b: LtabBlockState): string {
  const lines = b.rows.filter(ltabRowHasData).map((r) => {
    const d = r.csngDate.trim();
    const rawAmt = r.lossAmount.trim();
    const amt =
      rawAmt && !/EUR|€/i.test(rawAmt) ? `${rawAmt.replace(/\s+/g, " ")} EUR` : rawAmt.replace(/\s+/g, " ");
    const n = r.incidentNo.trim();
    const core = [d, amt].filter(Boolean).join("\t");
    return n ? `${core}\t${n}`.trim() : core;
  });
  const c = b.comments.trim();
  return [...lines, ...(c ? [c] : [])].join("\n");
}

export function vendorAvotuBlockHasContent(b: VendorAvotuBlockState): boolean {
  return (
    b.serviceHistory.some(autoRecordsRowHasData) ||
    b.incidents.some(ltabRowHasData) ||
    b.comments.trim().length > 0
  );
}

export function vendorAvotuBlockToPlainText(b: VendorAvotuBlockState): string {
  const lines: string[] = [];
  const mh = b.serviceHistory.filter(autoRecordsRowHasData);
  if (mh.length > 0) {
    lines.push(CSDD_MILEAGE_UNIFIED_TITLE);
    for (const r of mh) {
      lines.push(
        [
          formatAutoRecordsDateForOutput(r.date),
          normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
          r.country.replace(/\s+/g, " ").trim(),
        ].join("\t"),
      );
    }
  }
  const inc = b.incidents.filter(ltabRowHasData);
  if (inc.length > 0) {
    lines.push(NEGADIJUMU_VESTURE_TITLE);
    for (const r of inc) {
      lines.push([r.incidentNo.trim(), r.csngDate.trim(), r.lossAmount.trim()].join("\t"));
    }
  }
  if (b.comments.trim()) lines.push(`Komentāri\n${b.comments.trim()}`);
  return lines.join("\n");
}

export function citiAvotiHasContent(b: CitiAvotiBlockState): boolean {
  return vendorAvotuBlockHasContent(b);
}

export function citiAvotiToPlainText(b: CitiAvotiBlockState): string {
  return vendorAvotuBlockToPlainText(b);
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
  const citiPlain = vendorAvotuBlockToPlainText(blocks.citi_avoti).trim();
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
      mileageRows: b.serviceHistory.filter(autoRecordsRowHasData),
      incidentRows: b.incidents.filter(ltabRowHasData),
      comments: b.comments.trim(),
    });
  }
  const citi = blocks.citi_avoti;
  if (vendorAvotuBlockHasContent(citi)) {
    out.push({
      title: SOURCE_BLOCK_LABELS.citi_avoti,
      mileageRows: citi.serviceHistory.filter(autoRecordsRowHasData),
      incidentRows: citi.incidents.filter(ltabRowHasData),
      comments: citi.comments.trim(),
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

function parseAutoRecordsBlockRaw(raw: Record<string, unknown>): AutoRecordsBlockState {
  if ("serviceHistory" in raw || "rawUnprocessedData" in raw) {
    const rowsIn = Array.isArray(raw.serviceHistory) ? raw.serviceHistory : [];
    const serviceHistory: AutoRecordsServiceRow[] = rowsIn
      .map((row) => {
        if (!row || typeof row !== "object") return emptyAutoRecordsServiceRow();
        const x = row as Record<string, unknown>;
        return {
          date: String(x.date ?? "").slice(0, 40),
          odometer: String(x.odometer ?? "").slice(0, 40),
          country: String(x.country ?? "").slice(0, 120),
        };
      })
      .filter(autoRecordsRowHasData);
    const sorted = sortAutoRecordsDescending(serviceHistory);
    const normalized = sorted.map((r) => ({
      date: formatAutoRecordsDateForOutput(r.date),
      odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
      country: r.country.replace(/\s+/g, " ").trim(),
    }));
    return {
      rawUnprocessedData: String(raw.rawUnprocessedData ?? "").slice(0, 500_000),
      serviceHistory: normalized.length > 0 ? normalized : [emptyAutoRecordsServiceRow()],
      comments: typeof raw.comments === "string" ? raw.comments.slice(0, 12000) : "",
    };
  }
  const legacy = parseStandardBlockRaw(raw);
  const legacyText = standardBlockToPlainText(legacy).trim();
  if (!legacyText) return emptyAutoRecordsBlock();
  return {
    rawUnprocessedData: legacyText.slice(0, 500_000),
    serviceHistory: [emptyAutoRecordsServiceRow()],
    comments: "",
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
  };
}

function normalizeVendorMileageRowsFromRaw(rowsIn: unknown[]): AutoRecordsServiceRow[] {
  const serviceHistory: AutoRecordsServiceRow[] = rowsIn
    .map((row) => {
      if (!row || typeof row !== "object") return emptyAutoRecordsServiceRow();
      const x = row as Record<string, unknown>;
      return {
        date: String(x.date ?? "").slice(0, 40),
        odometer: String(x.odometer ?? "").slice(0, 40),
        country: String(x.country ?? "").slice(0, 120),
      };
    })
    .filter(autoRecordsRowHasData);
  const sorted = sortAutoRecordsDescending(serviceHistory);
  const normalized = sorted.map((r) => ({
    date: formatAutoRecordsDateForOutput(r.date),
    odometer: normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, ""),
    country: r.country.replace(/\s+/g, " ").trim(),
  }));
  return normalized.length > 0 ? normalized : [emptyAutoRecordsServiceRow()];
}

function normalizeVendorIncidentsFromRaw(rowsIn: unknown[]): LtabIncidentRow[] {
  const rows: LtabIncidentRow[] = rowsIn.map((row) => {
    if (!row || typeof row !== "object") return emptyLtabRow();
    const x = row as Record<string, unknown>;
    return {
      incidentNo: String(x.incidentNo ?? "").slice(0, 120),
      csngDate: String(x.csngDate ?? "").slice(0, 120),
      lossAmount: String(x.lossAmount ?? "").slice(0, 120),
    };
  });
  const filtered = rows.filter(ltabRowHasData);
  return filtered.length > 0 ? filtered : [emptyLtabRow()];
}

function parseVendorAvotuBlockRaw(raw: Record<string, unknown>): VendorAvotuBlockState {
  if ("serviceHistory" in raw || "incidents" in raw) {
    const shIn = Array.isArray(raw.serviceHistory) ? raw.serviceHistory : [];
    const incIn = Array.isArray(raw.incidents) ? raw.incidents : [];
    return {
      serviceHistory: normalizeVendorMileageRowsFromRaw(shIn as unknown[]),
      incidents: normalizeVendorIncidentsFromRaw(incIn as unknown[]),
      comments: typeof raw.comments === "string" ? raw.comments.slice(0, 12000) : "",
    };
  }
  return migrateLegacyVendorBlock(parseStandardBlockRaw(raw));
}

function parseLtabBlockRaw(raw: Record<string, unknown>): LtabBlockState {
  const rowsIn = Array.isArray(raw.rows) ? raw.rows : [];
  const rows: LtabIncidentRow[] = rowsIn.map((row) => {
    if (!row || typeof row !== "object") return emptyLtabRow();
    const x = row as Record<string, unknown>;
    if ("incidentNo" in x || "csngDate" in x || "lossAmount" in x) {
      return {
        incidentNo: String(x.incidentNo ?? "").slice(0, 120),
        csngDate: String(x.csngDate ?? "").slice(0, 120),
        lossAmount: String(x.lossAmount ?? "").slice(0, 120),
      };
    }
    return {
      incidentNo: String(x.km ?? "").slice(0, 120),
      csngDate: String(x.date ?? "").slice(0, 120),
      lossAmount: String(x.amount ?? "").slice(0, 120),
    };
  });
  const filtered = rows.filter(ltabRowHasData);
  const comments = typeof raw.comments === "string" ? raw.comments : "";
  return {
    rows: filtered.length > 0 ? filtered : [emptyLtabRow()],
    comments,
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
    const country = "country" in x ? String(x.country ?? "").slice(0, 120).trim() : "";
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

function parseCsddStoredFieldsRaw(raw: Record<string, unknown>): Omit<CsddFormFields, "mileageHistory"> {
  return {
    rawUnprocessedData: clipCsddField(raw.rawUnprocessedData, 4000),
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
  };
}

function parseCsddFieldsRaw(raw: Record<string, unknown>): CsddFormFields {
  const base = parseCsddStoredFieldsRaw(raw);
  if ("mileageHistory" in raw && Array.isArray(raw.mileageHistory)) {
    const unified = parseCsddMileageUnifiedRaw(raw.mileageHistory).filter(csddMileageRowHasData);
    return {
      ...base,
      mileageHistory: unified.length > 0 ? finalizeMileageHistory(unified) : [],
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
    };
  }
  if ("rows" in raw || "comments" in raw) {
    const old = parseStandardBlockRaw(raw);
    const t = standardBlockToPlainText(old).trim();
    return t ? { ...emptyTirgusFields(), comments: t } : emptyTirgusFields();
  }
  return emptyTirgusFields();
}

/** Vecais CSDD { rows, comments } → raw laukā (migrācijas teksts). */
export function migrateLegacyCsddBlock(old: StandardSourceBlockState): CsddFormFields {
  const t = standardBlockToPlainText(old).trim();
  if (!t) return emptyCsddFields();
  return { ...emptyCsddFields(), rawUnprocessedData: t };
}

export function mergeSourceBlocksWithDefaults(partial: unknown): WorkspaceSourceBlocks {
  const base = createDefaultSourceBlocks();
  if (!partial || typeof partial !== "object") return base;
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
      "prevInspectionDefectRows" in c;
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

  return base;
}

function parseCitiAvotiRaw(raw: Record<string, unknown>): CitiAvotiBlockState {
  if ("serviceHistory" in raw || "incidents" in raw) {
    return parseVendorAvotuBlockRaw(raw);
  }
  const legacy = typeof raw.comments === "string" ? raw.comments.slice(0, 12000) : "";
  return { ...emptyVendorAvotuBlock(), comments: legacy };
}

export function migrateFlatWorkspaceToBlocks(flat: {
  csdd?: string;
  ltab?: string;
  tirgus?: string;
  citi?: string;
}): WorkspaceSourceBlocks {
  const b = createDefaultSourceBlocks();
  if (flat.csdd?.trim()) b.csdd = { ...emptyCsddFields(), rawUnprocessedData: flat.csdd.trim() };
  if (flat.ltab?.trim()) b.ltab = { rows: [emptyLtabRow()], comments: flat.ltab.trim() };
  if (flat.tirgus?.trim()) b.tirgus = { ...emptyTirgusFields(), comments: flat.tirgus.trim() };
  if (flat.citi?.trim()) {
    b.citi_avoti = { ...emptyVendorAvotuBlock(), comments: flat.citi.trim() };
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
} | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
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
    return {
      sourceBlocks,
      iriss: typeof p.iriss === "string" ? p.iriss : "",
      apskatesPlāns: typeof p.apskatesPlāns === "string" ? p.apskatesPlāns : "",
      cenasAtbilstiba: typeof p.cenasAtbilstiba === "string" ? p.cenasAtbilstiba : "",
      previewConfirmed: Boolean(p.previewConfirmed),
      pdfVisibility: mergePdfVisibility(p.pdfVisibility),
    };
  } catch {
    return null;
  }
}
