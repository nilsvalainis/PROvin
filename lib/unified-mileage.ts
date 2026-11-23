/**
 * Vienots nobraukums no visiem avotiem (CSDD, AUTO RECORDS, AutoDNA, CarVertical) + anomāliju noteikšana.
 */

import { isImpossibleFutureDate } from "@/lib/future-date-guard";
import {
  CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
  csddMileageRowHasData,
  citiAvotiSectionHasContent,
  citiAvotiSectionLabel,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type TirgusFormFields,
  emptyAutoRecordsBlock,
  type OneautoBlockState,
} from "@/lib/admin-source-blocks";
import { resolveDealerAutoRecords } from "@/lib/oneauto-to-auto-records";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
} from "@/lib/auto-records-paste-parse";
import { CC_VIN_PDF_SOURCE_LABEL, type CcVinBlockState } from "@/lib/cc-vin-report";
import { ASV_PDF_SOURCE_LABEL, type AsvBlockState } from "@/lib/asv-report";
import { resolveListingMileageChartRow } from "@/lib/listing-odometer";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import { milesToKmRounded } from "@/lib/miles-to-km";
import { buildCountryTimeline, resolveCountryForDate } from "@/lib/vehicle-country-timeline";

export { MILES_TO_KM } from "@/lib/miles-to-km";

export type MileageDatePrecision = "day" | "month";
export type MileageUnit = "km" | "mi";

export type UnifiedMileageRow = {
  date: string;
  odometer: string;
  country: string;
  sortableTime: number;
  sourceOrder: number;
  sourceLabel: string;
  /**
   * Odometrs nolasīts no dokumenta (dīlera remonta / apkopes pasūtījuma), nevis no reāla nolasījuma.
   * Dokumentā rādījums bieži saglabāts no pasūtījuma atvēršanas brīža, tāpēc datums var būt vēlāks par rādījumu.
   */
  documentValue?: boolean;
  /**
   * Valsts nāk no sludinājuma/tirgus avota (piem. ss.lv → vienmēr "Latvija"), nevis no oficiāla
   * reģistra vai dīlera datiem. Pārdevēja norādītā vieta nav ticama ģeogrāfiska liecība, tāpēc
   * to nedrīkst izmantot robežšķērsošanas (importa) notikumu atvasināšanai laikposma hronoloģijā.
   */
  countryUnverified?: boolean;
  /**
   * 18.11 (valstu aizpilde): avots valsti nedeva, tā secināta no citiem rādījumiem (tas pats mēnesis vai
   * abi kaimiņi vienā valstī). Saglabātie dati netiek mainīti; valsts maiņas noteikšanā neskaitās.
   */
  countryInferred?: boolean;
  /** CarVertical `12.2013` - salīdzina mēnesī, ne kā 01.12 pret tā paša mēneša dīlera dienu. */
  datePrecision?: MileageDatePrecision;
  /** Avota mērvienība pirms pārrēķina; tabulā odometrs vienmēr km. */
  unit?: MileageUnit;
  /**
   * Rinda nāk no dīlera vizītes, jo nobraukuma tabula bija tukša.
   * Kartītei der; pretrunu ķēdē un līknē nav (vizīte jau ir servisa notikums).
   */
  visitOdometer?: boolean;
};

/** Tabulas rinda pēc km apvienošanas — vairāki avoti vienā „Avots” kolonnā. */
export type UnifiedMileageDisplayRow = UnifiedMileageRow & {
  sourceLabels: string[];
};

/** Maks. datumu starplaiks km apvienošanai (~2 kalendāra mēneši). */
export const UNIFIED_MILEAGE_MERGE_MAX_DATE_SPAN_MS = 62 * 24 * 60 * 60 * 1000;

/**
 * Maks. km atšķirība, pie kuras divu dažādu avotu ieraksts vienā mēnesī ir tas pats nolasījums.
 * Daļa avotu zina tikai mēnesi (datums normalizēts uz 1. datumu) un rādījumu glabā ar nelielu
 * sistemātisku nobīdi, tāpēc precīza km sakritība šos dublikātus nesavieno.
 */
export const UNIFIED_MILEAGE_CROSS_SOURCE_MERGE_MAX_KM_DIFF = 150;

export type UnifiedMileageSourcePayload = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  oneautoBlock?: OneautoBlockState | null;
  ccVinBlock?: CcVinBlockState | null;
  asvBlock?: AsvBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  citiAvotiBlock?: CitiAvotiBlockState | null;
  tirgusForm?: TirgusFormFields | null;
  listingUrl?: string | null;
};

export function parseMileageDateForSort(raw: string): number {
  const ms = parseDotOrIsoDateToMs(raw);
  if (ms > 0) return ms;
  const t = raw.trim().replace(/\.$/, "");
  const monthYear = t.match(/^(\d{1,2})\.(\d{4})$/);
  if (monthYear) {
    const m = Number(monthYear[1]);
    const y = Number(monthYear[2]);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      const utc = Date.UTC(y, m - 1, 1);
      return utc > 0 ? utc : Number.NEGATIVE_INFINITY;
    }
  }
  const isoMonth = t.match(/^(\d{4})-(\d{2})$/);
  if (isoMonth) {
    const y = Number(isoMonth[1]);
    const m = Number(isoMonth[2]);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      const utc = Date.UTC(y, m - 1, 1);
      return utc > 0 ? utc : Number.NEGATIVE_INFINITY;
    }
  }
  return Number.NEGATIVE_INFINITY;
}

/** `12.2013` / `2013-12` ir mēnesis, ne 1. diena. */
export function detectMileageDatePrecision(raw: string): MileageDatePrecision {
  const t = raw.trim();
  if (/^\d{1,2}\.\d{4}$/.test(t) || /^\d{4}-\d{2}$/.test(t)) return "month";
  return "day";
}

export function parseMileageUnit(raw: string | undefined): MileageUnit | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();
  if (/^(mi|mile|miles|m)$/i.test(t) || /\bmi\b/.test(t)) return "mi";
  if (/^(km|k|kilometr)/i.test(t)) return "km";
  return undefined;
}

/** Pārrēķina jūdzes uz km; jau km paliek (ar sākotnējo formatējumu). */
export function odometerToKmDisplay(raw: string, unit?: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n <= 0) return trimmed;
  const resolved = parseMileageUnit(unit) ?? parseMileageUnit(trimmed);
  if (resolved === "mi") return String(milesToKmRounded(n));
  return trimmed;
}

function squishMileageSource(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

/** Avota nosaukuma piedēklis rādījumam, kas avotā ir sludinājums (piem. "AutoDNA (sludinājums)"). */
export const VENDOR_LISTING_LABEL_SUFFIX = "(sludinājums)";

/** Atslēga rādījuma salīdzināšanai ar avota laika joslas sludinājumu: datums + km cipari. */
export function vendorListingKey(date: string, odometer: string): string {
  const d = (formatAutoRecordsDateForOutput(date) || date).trim();
  return `${d}|${odometer.replace(/\D/g, "")}`;
}

export function isListingMileageSource(r: Pick<UnifiedMileageRow, "sourceLabel" | "countryUnverified">): boolean {
  const sq = squishMileageSource(r.sourceLabel);
  if (r.sourceLabel.trim().toLowerCase().endsWith(VENDOR_LISTING_LABEL_SUFFIX)) return true;
  return (
    sq === "sslv" ||
    sq.includes("ss.lv") ||
    sq === "sludinajums" ||
    sq === "sludinajumaanalize" ||
    sq === "tirgusdati"
  );
}

/** A18: mēneša precizitātes rinda drukājas «04.2026», nevis «01.04.2026» (avotā nav dienas). */
export function formatMileageRowDateLabel(r: Pick<UnifiedMileageRow, "date" | "datePrecision">): string {
  const d = r.date.trim();
  if (r.datePrecision !== "month") return d;
  const m = /^0?1\.(\d{1,2})\.(\d{4})$/.exec(d);
  if (m) return `${m[1]!.padStart(2, "0")}.${m[2]}`;
  const iso = /^(\d{4})-(\d{2})(?:-01)?$/.exec(d);
  return iso ? `${iso[2]}.${iso[1]}` : d;
}

/** «EU» / «Eiropas Savienība» - reģions, nevis valsts (izsoles kataloga noklusējums). */
export function isGenericRegionCountry(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  return t === "eu" || t === "eiropas savienība" || t === "eiropa" || t === "europe" || t === "european union";
}

/** Izsoles ieraksta reģistrācijas valsts (TheCarApi `car_country_extended` u.c.) tai pašai dienai. */
function ccVinAuctionCountryForDate(block: CcVinBlockState | null | undefined, date: string): string {
  const day = parseDotOrIsoDateToMs(date);
  if (!Number.isFinite(day) || day <= 0) return "";
  for (const rec of block?.thecarapiRecords ?? []) {
    if (parseDotOrIsoDateToMs(rec.date ?? "") !== day) continue;
    const raw = (rec.raw ?? {}) as Record<string, unknown>;
    const fromRaw = [raw.car_country_extended, raw.countryOfRegistration, raw.car_country].find(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    const fromFields = (rec.fields ?? []).find(
      (f) => ["car_country_extended", "countryOfRegistration", "car_country"].includes(f.key) && f.value.trim(),
    )?.value;
    const code = (fromRaw ?? fromFields ?? "").trim();
    if (code && !isGenericRegionCountry(code) && countryLabelToIso2(code)) return normalizeCountryNameLv(code);
  }
  return "";
}

/** Rindā ir arī neatkarīgs (ne sludinājuma) avots - piem. izsole ar odometra foto tajā pašā km. */
function hasNonListingLabel(labels: readonly string[]): boolean {
  return labels.some((lbl) => !isListingMileageSource({ sourceLabel: lbl }));
}

/** CSDD / TA un oficiālais dīleris - prioritāte tikai vienā datumā / nelielā starpībā. */
export function isVerifiedMileageSource(
  r: Pick<UnifiedMileageRow, "sourceLabel" | "countryUnverified"> & { sourceLabels?: string[] },
): boolean {
  if (r.countryUnverified === true) return false;
  const labels = r.sourceLabels && r.sourceLabels.length > 0 ? r.sourceLabels : [r.sourceLabel];
  return labels.some((lbl) => {
    const sq = squishMileageSource(lbl);
    return (
      sq === "csdd" ||
      sq === "dealer" ||
      sq === "autorecords" ||
      sq === "oficialadileradati" ||
      sq === "razotajaundileradati" ||
      sq === "dileradati"
    );
  });
}

function rankMileageRowsNewestFirst<T extends UnifiedMileageRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.sortableTime !== b.sortableTime) return b.sortableTime - a.sortableTime;
    const kmA = parseOdometerKm(a.odometer) ?? -1;
    const kmB = parseOdometerKm(b.odometer) ?? -1;
    if (kmA !== kmB) return kmB - kmA;
    return a.sourceOrder - b.sourceOrder;
  });
}

/** Viens datums vai ~2 mēneši un ≤150 km: verificētais avots pārspēj AutoDNA/CV. */
export function mileageReadingsCloseForVerifiedPriority(
  a: Pick<UnifiedMileageRow, "sortableTime" | "odometer">,
  b: Pick<UnifiedMileageRow, "sortableTime" | "odometer">,
): boolean {
  if (a.sortableTime === Number.NEGATIVE_INFINITY || b.sortableTime === Number.NEGATIVE_INFINITY) {
    return false;
  }
  if (a.sortableTime === b.sortableTime) return true;
  const kmA = parseOdometerKm(a.odometer);
  const kmB = parseOdometerKm(b.odometer);
  if (kmA == null || kmB == null) return false;
  return (
    Math.abs(a.sortableTime - b.sortableTime) <= UNIFIED_MILEAGE_MERGE_MAX_DATE_SPAN_MS &&
    Math.abs(kmA - kmB) <= UNIFIED_MILEAGE_CROSS_SOURCE_MERGE_MAX_KM_DIFF
  );
}

/**
 * Kartītes / anomāliju „jaunākais”: visi avoti bez sludinājumiem.
 * CSDD/dīleris uzvar tikai tad, ja ir tas pats datums vai neliela starpība.
 */
export function selectNewestVerifiedMileageRow<T extends UnifiedMileageRow>(rows: T[]): T | null {
  const nonListing = rows.filter((r) => !isListingMileageSource(r));
  const pool = nonListing.length > 0 ? nonListing : rows;
  if (pool.length === 0) return null;
  const ranked = rankMileageRowsNewestFirst(pool);
  const newest = ranked[0]!;
  const verifiedClose = ranked.filter(
    (r) => isVerifiedMileageSource(r) && mileageReadingsCloseForVerifiedPriority(r, newest),
  );
  return verifiedClose[0] ?? newest;
}

export const DEALER_MILEAGE_TABLE_EMPTY_VISITS_WARNING =
  "dīlera nobraukuma tabula tukša, bet vizītēs ir odometrs";

export function dealerMileageTableEmptyButVisitsHaveOdometer(
  block: Pick<AutoRecordsBlockState, "serviceHistory" | "serviceWorks"> | null | undefined,
): boolean {
  if (!block) return false;
  const tableEmpty = !(block.serviceHistory ?? []).some(autoRecordsRowHasData);
  const visitsHaveOdo = (block.serviceWorks ?? []).some((w) => {
    const digits = w.odometer.replace(/\D/g, "");
    const date = formatAutoRecordsDateForOutput(w.date) || w.date.trim();
    return Boolean(digits && date);
  });
  return tableEmpty && visitsHaveOdo;
}

export function parseOdometerKm(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (n < 100 || n > 2_000_000) return null;
  return n;
}

/**
 * A16 (Business audits 23.11): jauna auto piegādes rādījumi (5 / 10 / 17 km) ir tabulā, tātad arī grafikā.
 * `parseOdometerKm` tos (<100 km) ignorē anomāliju analīzei - šeit tikai zīmēšanai.
 */
export function parseChartOdometerKm(raw: string): number | null {
  const km = parseOdometerKm(raw);
  if (km != null) return km;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return n >= 1 && n < 100 ? n : null;
}

/**
 * Hronoloģiski: vecākais → jaunākais; vienā datumā - odometrs augošā secībā; nederīgs datums - beigās.
 * 17.11 (etalons, klase A): ja mēnesī ir rādījums ar mēneša precizitāti (carVertical "12.2013" -> 01.12.2013), tā
 * vieta mēnesī nav zināma - šī mēneša rindas kārto pēc km. Agrāk tas vienmēr stāvēja mēneša sākumā, un precīzs
 * dīlera rādījums 02.12 izskatījās pēc krituma.
 */
export function sortMileageChronological(rows: UnifiedMileageRow[]): UnifiedMileageRow[] {
  const sorted = [...rows].sort((a, b) => {
    const ta = a.sortableTime === Number.NEGATIVE_INFINITY ? Number.POSITIVE_INFINITY : a.sortableTime;
    const tb = b.sortableTime === Number.NEGATIVE_INFINITY ? Number.POSITIVE_INFINITY : b.sortableTime;
    if (ta !== tb) return ta - tb;
    const ka = parseOdometerKm(a.odometer) ?? Number.POSITIVE_INFINITY;
    const kb = parseOdometerKm(b.odometer) ?? Number.POSITIVE_INFINITY;
    if (ka !== kb) return ka - kb;
    return a.sourceOrder - b.sourceOrder;
  });
  const out: UnifiedMileageRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sameCalendarMonth(sorted[i]!.sortableTime, sorted[j]!.sortableTime)) j += 1;
    const run = sorted.slice(i, j);
    if (run.length > 1 && run.some((r) => r.datePrecision === "month")) {
      run.sort((a, b) => {
        const ka = parseOdometerKm(a.odometer) ?? Number.POSITIVE_INFINITY;
        const kb = parseOdometerKm(b.odometer) ?? Number.POSITIVE_INFINITY;
        if (ka !== kb) return ka - kb;
        return a.sortableTime - b.sortableTime || a.sourceOrder - b.sourceOrder;
      });
    }
    out.push(...run);
    i = j;
  }
  return out;
}

/** carVertical dod tikai mēnesi un gadu; mūsu ielasē tas kļūst par 01.MM.GGGG. */
export function isMonthOnlyVendorReading(sourceLabel: string, dateRaw: string): boolean {
  return /carvertical/i.test(sourceLabel) && /^0?1[./]\d{1,2}[./]\d{4}$/.test(dateRaw.trim());
}

/** Back-roll anomālijai: starpībai starp secīgiem rādījumiem jābūt vismaz šādai (km). */
export const UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM = 1000;

/**
 * Nobraukuma tabula + līknei: hronoloģiska secība; tabulā km dublikāti apvienojas (skat. merge).
 */
export function filterDuplicateOdometerKmReadings(rows: UnifiedMileageRow[]): UnifiedMileageRow[] {
  return sortMileageChronological([...rows]);
}

function sortableTimeForMerge(raw: number): number {
  return raw === Number.NEGATIVE_INFINITY ? Number.POSITIVE_INFINITY : raw;
}

function clusterRowsByDateWindow(rows: UnifiedMileageRow[], maxSpanMs: number): UnifiedMileageRow[][] {
  const sorted = [...rows].sort(
    (a, b) => sortableTimeForMerge(a.sortableTime) - sortableTimeForMerge(b.sortableTime),
  );
  const clusters: UnifiedMileageRow[][] = [];
  let current: UnifiedMileageRow[] = [];
  let clusterMin = Number.POSITIVE_INFINITY;
  let clusterMax = Number.NEGATIVE_INFINITY;

  for (const row of sorted) {
    const t = sortableTimeForMerge(row.sortableTime);
    if (current.length === 0) {
      current = [row];
      clusterMin = clusterMax = t;
      continue;
    }
    const nextMin = Math.min(clusterMin, t);
    const nextMax = Math.max(clusterMax, t);
    if (nextMax - nextMin <= maxSpanMs) {
      current.push(row);
      clusterMin = nextMin;
      clusterMax = nextMax;
    } else {
      clusters.push(current);
      current = [row];
      clusterMin = clusterMax = t;
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

function uniqueSourceLabelsOrdered(rows: UnifiedMileageRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const lbl = r.sourceLabel.trim() || "Nezināms avots";
    const key = lbl.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lbl);
  }
  return out;
}

function dropGenericRegionCountries(countries: string[]): string[] {
  const specific = countries.filter((c) => !isGenericRegionCountry(c));
  return specific.length > 0 ? specific : countries;
}

/**
 * A18: «01.04.2026» no avota, kas dod tikai mēnesi (AutoDNA glabā 1. datumu). Ja tajā pašā rindā ir mēneša
 * precizitātes ieraksts tam pašam mēnesim un visi «dienas» ieraksti ir mēneša 1. datumā - tas ir mēnesis.
 */
function mergedDatePrecision(
  rows: readonly Pick<UnifiedMileageRow, "datePrecision" | "sortableTime" | "sourceLabel">[],
): "day" | "month" {
  if (rows.every((r) => r.datePrecision === "month")) return "month";
  const months = rows.filter((r) => r.datePrecision === "month");
  if (months.length === 0) return "day";
  const dayRows = rows.filter((r) => r.datePrecision !== "month");
  // Tikai AutoDNA (mēneša avots, ielasē 1. datums); dīlera / CSDD 1. datums var būt īsts vizītes datums.
  if (!dayRows.every((r) => /^autodna$/i.test(r.sourceLabel.trim()))) return "day";
  const firstOfMonth = dayRows.every((r) => Number.isFinite(r.sortableTime) && new Date(r.sortableTime).getUTCDate() === 1);
  const sameMonth = dayRows.every((d) => months.some((m) => sameCalendarMonth(m.sortableTime, d.sortableTime)));
  return firstOfMonth && sameMonth ? "month" : "day";
}

function mergeMileageCluster(cluster: UnifiedMileageRow[]): UnifiedMileageDisplayRow {
  const chrono = sortMileageChronological(cluster);
  const dayPrecise = chrono.filter((r) => r.datePrecision !== "month");
  const pickFrom = dayPrecise.length > 0 ? dayPrecise : chrono;
  const primary = pickFrom[pickFrom.length - 1] ?? cluster[0]!;
  const labels = uniqueSourceLabelsOrdered(cluster);
  // Business audits 23.11 (A7): sludinājuma etiķete nedrīkst būt galvenā, ja to pašu km apstiprina izsole u.c.
  if (labels.length > 1 && hasNonListingLabel(labels)) {
    labels.sort((a, b) => Number(isListingMileageSource({ sourceLabel: a })) - Number(isListingMileageSource({ sourceLabel: b })));
  }
  const filledLabels = labels.length > 0 ? labels : [primary.sourceLabel.trim() || "Nezināms avots"];
  const countries = dropGenericRegionCountries([...new Set(cluster.map((r) => r.country.trim()).filter(Boolean))]);
  // Ja to pašu km apstiprina kāds neatkarīgs nolasījums, apvienotā rinda vairs nav tikai dokumenta vērtība.
  const documentValue = cluster.every((r) => r.documentValue === true);
  // Valsts paliek nesertificēta tikai tad, ja pilnīgi visi avoti šajā km klasterī ir nesertificēti
  // (piem. tikai sludinājums) — ja klāt ir kaut viens oficiāls avots, valsts vairs nav tikai pieņēmums.
  const countryUnverified = cluster.every((r) => r.countryUnverified === true);
  const countryInferred = cluster.every((r) => r.countryInferred === true);
  const visitOdometer = cluster.every((r) => r.visitOdometer === true);
  const datePrecision = mergedDatePrecision(cluster);
  const knownCountries = countries.filter((c) => c && c !== CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL);
  return {
    ...primary,
    country:
      knownCountries.length === 1
        ? knownCountries[0]!
        : knownCountries.length > 1
          ? knownCountries.join(" / ")
          : (countries[0] ?? primary.country),
    sourceOrder: Math.min(...cluster.map((r) => r.sourceOrder)),
    sourceLabel: filledLabels[0] ?? primary.sourceLabel,
    sourceLabels: filledLabels,
    datePrecision,
    ...(documentValue ? { documentValue: true } : { documentValue: undefined }),
    ...(countryUnverified ? { countryUnverified: true } : { countryUnverified: undefined }),
    ...(countryInferred ? { countryInferred: true } : { countryInferred: undefined }),
    ...(visitOdometer ? { visitOdometer: true } : { visitOdometer: undefined }),
    // Nils B7: ja kaut viens apvienotais avots bija jūdzēs, PDF to paskaidro.
    ...(cluster.some((r) => r.unit === "mi") ? { unit: "mi" as const } : {}),
  };
}

/**
 * Apvieno rindas ar identisku odometru (km), ja datumi atšķiras ne vairāk par ~2 mēnešiem.
 * Atgriež hronoloģiski sakārtotas tabulas rindas ar `sourceLabels` vairākiem avotiem.
 */
export function mergeUnifiedMileageRowsByOdometer(
  rows: UnifiedMileageRow[],
  maxDateSpanMs = UNIFIED_MILEAGE_MERGE_MAX_DATE_SPAN_MS,
): UnifiedMileageDisplayRow[] {
  const mergeable: UnifiedMileageRow[] = [];
  const passthrough: UnifiedMileageDisplayRow[] = [];

  for (const row of rows) {
    if (parseOdometerKm(row.odometer) === null) {
      passthrough.push({ ...row, sourceLabels: [row.sourceLabel.trim() || "Nezināms avots"] });
    } else {
      mergeable.push(row);
    }
  }

  const byKm = new Map<number, UnifiedMileageRow[]>();
  for (const row of mergeable) {
    const km = parseOdometerKm(row.odometer)!;
    const bucket = byKm.get(km) ?? [];
    bucket.push(row);
    byKm.set(km, bucket);
  }

  const merged: UnifiedMileageDisplayRow[] = [];
  for (const bucket of byKm.values()) {
    for (const cluster of clusterRowsByDateWindow(bucket, maxDateSpanMs)) {
      merged.push(mergeMileageCluster(cluster));
    }
  }

  return sortMileageChronological([...merged, ...passthrough]) as UnifiedMileageDisplayRow[];
}

function sameCalendarMonth(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
}

function shareSourceLabel(a: UnifiedMileageDisplayRow, b: UnifiedMileageDisplayRow): boolean {
  const mine = new Set(a.sourceLabels.map((l) => l.trim().toLowerCase()));
  return b.sourceLabels.some((l) => mine.has(l.trim().toLowerCase()));
}

/**
 * Viens nolasījums, ko divi avoti uzrāda ar nelielu atšķirību. Viena avota rindas netiek skartas:
 * dīlera pasūtījumu rindas ar tuvām vērtībām ir atsevišķi ieraksti, ne dublikāti.
 */
function isCrossSourceMonthDuplicate(
  earlier: UnifiedMileageDisplayRow,
  later: UnifiedMileageDisplayRow,
  maxKmDiff: number,
): boolean {
  const kmA = parseOdometerKm(earlier.odometer);
  const kmB = parseOdometerKm(later.odometer);
  if (kmA === null || kmB === null) return false;
  if (Math.abs(kmB - kmA) > maxKmDiff) return false;
  if (!sameCalendarMonth(earlier.sortableTime, later.sortableTime)) return false;
  return !shareSourceLabel(earlier, later);
}

/** Patur vēlāko (precīzi datēto) rindu un tās rādījumu, bet abu avotu etiķetes. */
function mergeCrossSourceRows(
  earlier: UnifiedMileageDisplayRow,
  later: UnifiedMileageDisplayRow,
): UnifiedMileageDisplayRow {
  const labels: string[] = [];
  for (const raw of [...later.sourceLabels, ...earlier.sourceLabels]) {
    const lbl = raw.trim() || "Nezināms avots";
    if (!labels.some((v) => v.toLowerCase() === lbl.toLowerCase())) labels.push(lbl);
  }
  if (labels.length > 1 && hasNonListingLabel(labels)) {
    labels.sort((a, b) => Number(isListingMileageSource({ sourceLabel: a })) - Number(isListingMileageSource({ sourceLabel: b })));
  }
  const filledLabels = labels.length > 0 ? labels : [later.sourceLabel.trim() || "Nezināms avots"];
  const countries = dropGenericRegionCountries([...new Set([later.country.trim(), earlier.country.trim()].filter(Boolean))]);
  const documentValue = later.documentValue === true && earlier.documentValue === true;
  const countryUnverified = later.countryUnverified === true && earlier.countryUnverified === true;
  const dayRow = later.datePrecision !== "month" ? later : earlier.datePrecision !== "month" ? earlier : later;
  return {
    ...dayRow,
    country: countries.length <= 1 ? (countries[0] ?? later.country) : countries.join(" / "),
    sourceOrder: Math.min(earlier.sourceOrder, later.sourceOrder),
    sourceLabel: filledLabels[0] ?? later.sourceLabel,
    sourceLabels: filledLabels,
    datePrecision: mergedDatePrecision([earlier, later]),
    ...(documentValue ? { documentValue: true } : { documentValue: undefined }),
    ...(countryUnverified ? { countryUnverified: true } : { countryUnverified: undefined }),
  };
}

export function mergeCrossSourceMonthDuplicates(
  rows: UnifiedMileageDisplayRow[],
  maxKmDiff = UNIFIED_MILEAGE_CROSS_SOURCE_MERGE_MAX_KM_DIFF,
): UnifiedMileageDisplayRow[] {
  const out: UnifiedMileageDisplayRow[] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    if (prev && isCrossSourceMonthDuplicate(prev, row, maxKmDiff)) {
      out[out.length - 1] = mergeCrossSourceRows(prev, row);
      continue;
    }
    out.push(row);
  }
  return out;
}

/** Tabulas / grafika rindas — hronoloģiski + km apvienošana. */
export function prepareUnifiedMileageDisplayRows(rows: UnifiedMileageRow[]): UnifiedMileageDisplayRow[] {
  return mergeCrossSourceMonthDuplicates(
    mergeUnifiedMileageRowsByOdometer(sortMileageChronological([...rows])),
  );
}

/**
 * Tipiska ieraksta kļūda: ekstra cipars (piem. 25 581 → 255 811).
 */
export function looksLikeExtraDigitOdometerTypo(spikeKm: number, neighborKm: number): boolean {
  if (!(neighborKm >= 1_000 && spikeKm > neighborKm * 5)) return false;
  const tol = Math.max(100, neighborKm * 0.02);
  if (Math.abs(spikeKm - neighborKm * 10) <= tol) return true;
  if (Math.abs(spikeKm / 10 - neighborKm) <= tol) return true;
  if (Math.abs(Math.round(spikeKm / 10) - neighborKm) <= Math.max(200, neighborKm * 0.03)) return true;
  return false;
}

/**
 * Adatas spike starp zemākiem kaimiņiem — neiekļauj grafikā (Y skala citādi izkropļojas).
 */
/**
 * 19.11 (BMW dīlera dati, Nils): viena cipara pārrakstīšanās (85 886 -> 96 533 -> 90 205, īstais ~86 533).
 * Ja, nomainot TIKAI vienu ciparu, rādījums iekļaujas starp kaimiņiem (prev <= v <= next), tas ir ievades kļūdas
 * paraksts, nevis korekcija. Atsevišķi pārbauda tempu (sk. {@link isSpuriousMileageSpike}).
 */
export function singleDigitTypoFitsBetween(currKm: number, prevKm: number, nextKm: number): boolean {
  const digits = String(Math.round(currKm));
  for (let i = 0; i < digits.length; i++) {
    for (let d = 0; d <= 9; d++) {
      if (String(d) === digits[i]) continue;
      if (i === 0 && d === 0 && digits.length > 1) continue;
      const v = Number(digits.slice(0, i) + String(d) + digits.slice(i + 1));
      if (v >= prevKm && v <= nextKm) return true;
    }
  }
  return false;
}

/** Viena cipara izlēcējs: sērijai tā līmenis jāsasniedz ne vēlāk kā pēc gada. */
export const SPIKE_RECOVERY_MAX_MS = 365 * 24 * 60 * 60 * 1000;

/** Tempa reizinātājs: kāpums uz izlēcēju jābūt vismaz tik reižu straujāks par prev -> next tempu. */
export const SPIKE_RATE_FACTOR = 5;

export type MileageSpikeTimes = { prev?: number; curr?: number; next?: number; recoveredWithinYear?: boolean };

/**
 * Viena cipara izlēcējs uz augšu: bez tā sērija ir monotona (prev <= next), viena cipara labojums iekļaujas starp
 * kaimiņiem, kāpuma temps ≥ 5× sērijas tempa, un sērija šo līmeni sasniedz gada laikā. Īsta korekcija
 * (next < prev vai līmenis netiek sasniegts) šeit neiekrīt.
 */
export function isSingleDigitTypoSpike(
  currKm: number,
  prevKm: number | null,
  nextKm: number | null,
  times?: MileageSpikeTimes,
): boolean {
  if (prevKm == null || nextKm == null) return false;
  if (!(currKm > prevKm && nextKm < currKm)) return false;
  const up = currKm - prevKm;
  const down = currKm - nextKm;
  // Viena cipara kļūda: bez tā punkta sērija ir monotona (prev <= next) un temps uz izlēcēju ir nereāls.
  // Īsta korekcija (next < prev) šeit neiekrīt - to tālāk atzīmē kā kritumu.
  if (
    down >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM &&
    nextKm >= prevKm &&
    times?.prev != null &&
    times.curr != null &&
    times.next != null &&
    Number.isFinite(times.prev) &&
    Number.isFinite(times.curr) &&
    Number.isFinite(times.next) &&
    times.next > times.prev &&
    // Sērija izlēcēja līmeni vēlāk sasniedz normālā tempā (≤ 1 gads). Ja nekad - tā var būt korekcija
    // (210 000 -> 120 000 -> 150 000), un punkts paliek kā kritums.
    times.recoveredWithinYear === true &&
    singleDigitTypoFitsBetween(currKm, prevKm, nextKm)
  ) {
    const DAY = 24 * 60 * 60 * 1000;
    const spikeRate = up / Math.max(1, (times.curr - times.prev) / DAY);
    const chainRate = (nextKm - prevKm) / Math.max(1, (times.next - times.prev) / DAY);
    return spikeRate >= Math.max(chainRate * SPIKE_RATE_FACTOR, 150);
  }
  return false;
}

export function isSpuriousMileageSpike(
  currKm: number,
  prevKm: number | null,
  nextKm: number | null,
  times?: MileageSpikeTimes,
): boolean {
  if (prevKm == null || nextKm == null) return false;
  if (!(currKm > prevKm && nextKm < currKm)) return false;
  const up = currKm - prevKm;
  const down = currKm - nextKm;
  if (isSingleDigitTypoSpike(currKm, prevKm, nextKm, times)) return true;
  if (down < Math.max(UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM, up * 0.4)) return false;
  if (looksLikeExtraDigitOdometerTypo(currKm, prevKm) || looksLikeExtraDigitOdometerTypo(currKm, nextKm)) {
    return true;
  }
  // Liels lēciens uz augšu, tad lielākā daļa „pazūd”, un nākamais punkts ir tuvāk iepriekšējam.
  if (up >= 80_000 && Math.abs(nextKm - prevKm) < Math.abs(nextKm - currKm) * 0.5) return true;
  if (up >= 100_000 && nextKm <= prevKm + Math.max(up * 0.25, 50_000) && nextKm >= prevKm * 0.3) {
    return true;
  }
  return false;
}

export type UnifiedMileageAnomalyAnalysis = {
  anomalyBySourceOrder: Map<number, boolean>;
  /** Extra-digit / needle spike — izlaist no līknes (tabulā tomēr ar brīdinājumu). */
  chartExcludeSourceOrders: Set<number>;
  /** Novecojis dokumenta rādījums: „dokumenta datums ≠ nolasījuma datums” (nav odometra pretruna). */
  staleDocumentSourceOrders: Set<number>;
  /** A → zems → A+ izolēts kritums: datu ievades kļūda, ne pretruna. */
  dataEntryErrorSourceOrders: Set<number>;
  /**
   * 17.11 (Nils B2): sludinājuma rādījums >= 1 000 km zem iepriekšējā fiksētā - "pārdevējs norādījis mazāku
   * nobraukumu". Atsevišķs dzeltens brīdinājums, nekad sarkanā josla (sludinājums nav oficiāls fiksējums).
   */
  listingBelowRecordedSourceOrders: Set<number>;
  /** 19.11: viena cipara izlēcējs uz augšu (sk. {@link isSingleDigitTypoSpike}) - nav salīdzināšanas punkts kritumam. */
  typoSpikeSourceOrders?: Set<number>;
};

/** Izolēts kritums starp diviem augstākiem kaimiņiem (A → zems → A+). */
export const ISOLATED_MILEAGE_DROP_MAX_RECOVERY_MS = 183 * 24 * 60 * 60 * 1000;

export function isIsolatedMileageDrop(
  currKm: number,
  prevKm: number | null,
  nextKm: number | null,
  currTime?: number,
  nextTime?: number,
): boolean {
  if (prevKm == null || nextKm == null) return false;
  if (!(currKm < prevKm && nextKm >= prevKm)) return false;
  if (
    currTime != null &&
    nextTime != null &&
    Number.isFinite(currTime) &&
    Number.isFinite(nextTime) &&
    nextTime - currTime > ISOLATED_MILEAGE_DROP_MAX_RECOVERY_MS
  ) {
    return false;
  }
  const drop = prevKm - currKm;
  return drop >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
}

function endOfUtcMonth(t: number): number {
  if (!Number.isFinite(t)) return t;
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
}

/** Pirmā rādījuma kļūda: nākamais rādījums ne vēlāk kā pēc tik ilga laika. */
export const LEADING_MILEAGE_ENTRY_ERROR_MAX_GAP_MS = 31 * 24 * 60 * 60 * 1000;

/**
 * Sērijas pirmais rādījums ir kļūda, ja: nākamais ir vismaz {@link UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM} zemāks un
 * nolasīts ne vēlāk kā pēc 31 dienas, bet sērija turpinās no nākamā (aiznākamais ~ nākamais, < pirmais).
 * Piem. dīleris 22.09.2011 22 997, 23.09.2011 12 397, CV 10.2011 12 347, 11.2011 12 500.
 * Ja aiznākamais jau pārsniedz pirmo, nevar zināt, kurš ir kļūdains - netiek aiztikts.
 */
export function isLeadingMileageEntryError(
  firstKm: number,
  firstTime: number,
  nextKm: number,
  nextTime: number,
  afterKm: number,
): boolean {
  if (firstKm - nextKm < UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) return false;
  if (!Number.isFinite(firstTime) || !Number.isFinite(nextTime)) return false;
  if (nextTime - firstTime > LEADING_MILEAGE_ENTRY_ERROR_MAX_GAP_MS || nextTime < firstTime) return false;
  // Pielaide kā citur analīzē: mēneša avoti (CV) var būt par dažiem desmitiem km zem precīzā rādījuma.
  return afterKm > nextKm - UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM && afterKm < firstKm;
}

/** Cita avota atkārtots tas pats novecojušais dokumenta rādījums — pieļaujamā km atšķirība. */
const STALE_DOCUMENT_MIRROR_TOLERANCE_KM = 1_000;

type StaleDocumentCandidate = {
  sourceOrder: number;
  /** Uzticamais nolasījumu līmenis pirms šīs rindas — tam ķēdei jāatgriežas, lai rindu uzskatītu par dokumentu. */
  levelKm: number;
};

/**
 * Dīlera pasūtījuma odometrs zem faktisko nolasījumu līmeņa: dokuments atvērts agrāk, nekā datēts.
 * Kandidāts kļūst par apstiprinātu „novecojušu dokumentu” tikai tad, ja vēlākie nolasījumi atgriežas
 * vismaz līdz iepriekšējam līmenim — citādi tā ir īsta odometra pretruna un paliek atzīmēta.
 *
 * Zemāks jauns rādījums pēc pīķa (īsta korekcija, piem. 90 599 → 63 573) NAV dokuments:
 * tas paliek sarkanā pretruna. Oranžais brīdinājums tikai tad, ja tas pats km jau bija
 * redzēts pirms pīķa (pasūtījums atkārto vecu nolasījumu).
 */
function findStaleDocumentSourceOrders(
  sorted: UnifiedMileageRow[],
  chartExclude: Set<number>,
): Set<number> {
  const pts: { sourceOrder: number; km: number; documentValue: boolean; row: UnifiedMileageRow }[] = [];
  for (const r of sorted) {
    if (chartExclude.has(r.sourceOrder)) continue;
    // 19.11: sludinājums nav dokuments - to vērtē sludinājuma zarā ("sludinājumā mazāk"), citādi noapaļots
    // sludinājuma km (200 000, 90 000), kas nejauši atkārto agrāku līmeni, kļūst par "novecojušu dokumentu".
    if (isListingMileageSource(r)) continue;
    const km = parseOdometerKm(r.odometer);
    if (km !== null) pts.push({ sourceOrder: r.sourceOrder, km, documentValue: r.documentValue === true, row: r });
  }

  const candidates: StaleDocumentCandidate[] = [];
  const candidateOrders = new Set<number>();
  const staleValues: number[] = [];
  const kmAtCurrentPeak: number[] = [];
  let trustedMaxKm: number | null = null;
  let trustedMaxRow: UnifiedMileageRow | undefined;

  for (const pt of pts) {
    const belowTrusted =
      trustedMaxKm !== null && trustedMaxKm - pt.km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
    const repeatsPeakChainKm = kmAtCurrentPeak.some(
      (v) => Math.abs(v - pt.km) <= STALE_DOCUMENT_MIRROR_TOLERANCE_KM,
    );
    const mirrorsStaleValue = staleValues.some(
      (v) => Math.abs(v - pt.km) <= STALE_DOCUMENT_MIRROR_TOLERANCE_KM,
    );
    // 20.11 (PROVIN ADMINS, B6): valsts maiņas brīdī zemāks rādījums nav "novecojis dokuments", pat ja tas nejauši
    // atkārto agrāku līmeni (Škoda TMBJH9NP9H7561596: SE 253 760 -> LV CSDD 181 345 ~ SE 2019 181 850).
    // Ievades kļūdas skaidrojums nedrīkst noslēpt importa attīšanu.
    const atCountryChange = isMileageCountryChange(trustedMaxRow, pt.row);
    if (belowTrusted && !atCountryChange && (repeatsPeakChainKm || mirrorsStaleValue)) {
      candidates.push({ sourceOrder: pt.sourceOrder, levelKm: trustedMaxKm! });
      candidateOrders.add(pt.sourceOrder);
      staleValues.push(pt.km);
      continue;
    }
    if (trustedMaxKm === null || pt.km >= trustedMaxKm) {
      kmAtCurrentPeak.push(pt.km);
      trustedMaxKm = pt.km;
      trustedMaxRow = pt.row;
    }
  }

  const confirmed = new Set<number>();
  for (const candidate of candidates) {
    const idx = pts.findIndex((pt) => pt.sourceOrder === candidate.sourceOrder);
    const recovers = pts
      .slice(idx + 1)
      .some((pt) => !candidateOrders.has(pt.sourceOrder) && pt.km >= candidate.levelKm);
    if (recovers) confirmed.add(candidate.sourceOrder);
  }
  return confirmed;
}

/**
 * 1) Atzīmē viltus spike (ekstra cipars u.c.) — tabulā + izslēgšana no grafika.
 * 2) Novecojuši dokumenta rādījumi (dīlera pasūtījums) — nav pretruna, arī ārpus ķēdes un līknes.
 * 3) Back-roll uz ķēdes *bez* šiem spike: V_current < V_previous un Δ ≥ {@link UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM}.
 */
/**
 * Nils 18.11: rādījumi ap valsts maiņu jāvērtē īpaši uzmanīgi - tur kritumu nenoraksta kā ievades kļūdu.
 * Tikai pārbaudītas valstis (sludinājuma vieta neskaitās).
 */
export function isMileageCountryChange(
  a: Pick<UnifiedMileageRow, "country" | "countryUnverified" | "countryInferred"> | undefined,
  b: Pick<UnifiedMileageRow, "country" | "countryUnverified" | "countryInferred"> | undefined,
): boolean {
  if (!a || !b || a.countryUnverified || b.countryUnverified) return false;
  if (a.countryInferred || b.countryInferred) return false;
  // Apvienotā rinda var nest vairākas valstis ("ASV / Kanāda"); maiņa tikai, ja kopīgas valsts nav.
  const set = (c: string) =>
    new Set(
      c
        .split("/")
        .map((x) => normalizeCountryNameLv(x.trim()).toLocaleLowerCase("lv"))
        .filter((x) => x && !isUnknownMileageCountry(x)),
    );
  const ca = set(a.country);
  const cb = set(b.country);
  if (ca.size === 0 || cb.size === 0) return false;
  return ![...ca].some((x) => cb.has(x));
}

/**
 * 19.11 (Nils): viena avota divi rādījumi vienā dienā ar starpību > {@link UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM}
 * (piem. dīleris 16.03.2018 90 044 un 99 044) - viens no tiem ir ievades kļūda.
 */
export const SAME_DAY_SOURCE_PAIR_MIN_DIFF_KM = UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;

/** Abi skaitļi atšķiras tieši vienā ciparā (vienāds garums). */
export function differsBySingleDigit(a: number, b: number): boolean {
  const da = String(Math.round(a));
  const db = String(Math.round(b));
  if (da.length !== db.length || da === db) return false;
  let diff = 0;
  for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) diff += 1;
  return diff === 1;
}

/**
 * Vienas dienas viena avota pāris: ievades kļūda ir tas rādījums, kas neiekļaujas līknē starp kaimiņiem
 * (iepriekšējo un nākamo citas dienas rādījumu, ± {@link UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM}).
 * Ja abi iekļaujas vai neiekļaujas neviens - neko nemarķē (īsta korekcija paliek sarkana).
 * Ja ir tikai viens kaimiņš, marķē tikai tad, ja abi rādījumi atšķiras vienā ciparā (tipiska pārrakstīšanās).
 */
export function findSameDaySourceEntryErrors(
  pts: readonly { sourceOrder: number; km: number; time: number; row: UnifiedMileageRow }[],
): Set<number> {
  const out = new Set<number>();
  const groups = new Map<string, number[]>();
  pts.forEach((p, idx) => {
    const r = p.row;
    if (!Number.isFinite(p.time) || r.datePrecision === "month" || isListingMileageSource(r)) return;
    const key = `${p.time}|${r.sourceLabel.trim().toLocaleLowerCase("lv")}`;
    const arr = groups.get(key);
    if (arr) arr.push(idx);
    else groups.set(key, [idx]);
  });
  const tol = UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
  for (const idxs of groups.values()) {
    if (idxs.length !== 2) continue;
    const [a, b] = idxs.map((i) => pts[i]!);
    if (Math.abs(a!.km - b!.km) <= SAME_DAY_SOURCE_PAIR_MIN_DIFF_KM) continue;
    const time = a!.time;
    let prevKm: number | null = null;
    for (let i = idxs[0]! - 1; i >= 0; i--) {
      const p = pts[i]!;
      if (p.time < time && !out.has(p.sourceOrder) && !isListingMileageSource(p.row)) {
        prevKm = p.km;
        break;
      }
    }
    let nextKm: number | null = null;
    for (let i = idxs[1]! + 1; i < pts.length; i++) {
      const p = pts[i]!;
      if (p.time > time && !isListingMileageSource(p.row)) {
        nextKm = p.km;
        break;
      }
    }
    if (prevKm == null && nextKm == null) continue;
    if ((prevKm == null || nextKm == null) && !differsBySingleDigit(a!.km, b!.km)) continue;
    const fits = (km: number) =>
      (prevKm == null || km >= prevKm - tol) && (nextKm == null || km <= nextKm + tol);
    const fa = fits(a!.km);
    const fb = fits(b!.km);
    if (fa === fb) continue;
    out.add(fa ? b!.sourceOrder : a!.sourceOrder);
  }
  return out;
}

/**
 * 19.11 (drošības princips): sērijas PĒDĒJAIS vienas dienas viena avota pāris (> 1000 km starpība, nākamā rādījuma
 * nav). Kārtojot pēc km, zemākais nonāk pirmais, un augstākais partneris izskatās pēc "atgūšanās" - zemāko nedrīkst
 * norakstīt kā izolētu ievades kļūdu. Šaubu gadījumā kritumu rāda (viena cipara gadījumu marķē
 * {@link findSameDaySourceEntryErrors}).
 */
export function isTrailingSameDaySourcePair(
  curr: Pick<UnifiedMileageRow, "sortableTime" | "sourceLabel" | "datePrecision" | "odometer" | "countryUnverified">,
  partner: Pick<UnifiedMileageRow, "sortableTime" | "sourceLabel" | "datePrecision" | "odometer" | "countryUnverified"> | undefined,
  partnerIsLast: boolean,
): boolean {
  if (!partner || !partnerIsLast) return false;
  if (!Number.isFinite(curr.sortableTime) || curr.sortableTime !== partner.sortableTime) return false;
  if (curr.datePrecision === "month" || partner.datePrecision === "month") return false;
  if (isListingMileageSource(curr) || isListingMileageSource(partner)) return false;
  if (curr.sourceLabel.trim().toLocaleLowerCase("lv") !== partner.sourceLabel.trim().toLocaleLowerCase("lv")) {
    return false;
  }
  const a = parseOdometerKm(curr.odometer);
  const b = parseOdometerKm(partner.odometer);
  return a != null && b != null && Math.abs(a - b) > SAME_DAY_SOURCE_PAIR_MIN_DIFF_KM;
}

export function analyzeUnifiedMileageAnomalies(rows: UnifiedMileageRow[]): UnifiedMileageAnomalyAnalysis {
  const sorted = sortMileageChronological(rows);
  const rowByOrder = new Map(sorted.map((r) => [r.sourceOrder, r]));
  const chartExclude = new Set<number>();
  const dataEntryErrors = new Set<number>();
  const typoSpikes = new Set<number>();

  const allPts: { sourceOrder: number; km: number; time: number; row: UnifiedMileageRow }[] = [];
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km !== null) allPts.push({ sourceOrder: r.sourceOrder, km, time: r.sortableTime, row: r });
  }
  // 19.11: vienas dienas viena avota pāra ievades kļūda - nav līknē un nav kaimiņš/bāze tālākajā analīzē.
  const sameDayErrors = findSameDaySourceEntryErrors(allPts);
  for (const so of sameDayErrors) {
    dataEntryErrors.add(so);
    chartExclude.add(so);
  }
  const pts = allPts.filter((p) => !sameDayErrors.has(p.sourceOrder));

  for (let i = 0; i < pts.length; i++) {
    const prev = i > 0 ? pts[i - 1]!.km : null;
    const next = i < pts.length - 1 ? pts[i + 1]!.km : null;
    const curr = pts[i]!;
    const spikeTimes = {
      prev: i > 0 ? pts[i - 1]!.time : undefined,
      curr: curr.time,
      next: i < pts.length - 1 ? pts[i + 1]!.time : undefined,
      recoveredWithinYear: pts
        .slice(i + 2)
        .some((p) => p.km >= curr.km && Number.isFinite(p.time) && p.time - curr.time <= SPIKE_RECOVERY_MAX_MS),
    };
    if (isSpuriousMileageSpike(curr.km, prev, next, spikeTimes)) {
      if (isSingleDigitTypoSpike(curr.km, prev, next, spikeTimes)) typoSpikes.add(curr.sourceOrder);
      chartExclude.add(curr.sourceOrder);
      continue;
    }
    const src = rowByOrder.get(curr.sourceOrder);
    const nextTime = i < pts.length - 1 ? pts[i + 1]!.time : undefined;
    const prevRowForCountry = i > 0 ? rowByOrder.get(pts[i - 1]!.sourceOrder) : undefined;
    const trailingPair =
      src != null &&
      i + 1 < pts.length &&
      isTrailingSameDaySourcePair(src, rowByOrder.get(pts[i + 1]!.sourceOrder), i + 2 >= pts.length);
    if (
      !trailingPair &&
      isIsolatedMileageDrop(curr.km, prev, next, curr.time, nextTime) &&
      !(src && isListingMileageSource(src)) &&
      !isMileageCountryChange(prevRowForCountry, src)
    ) {
      dataEntryErrors.add(curr.sourceOrder);
      chartExclude.add(curr.sourceOrder);
      continue;
    }
    // Spike kā pēdējais punkts: tikai ×10 pret iepriekšējo.
    if (next == null && prev != null && looksLikeExtraDigitOdometerTypo(curr.km, prev)) {
      chartExclude.add(curr.sourceOrder);
    }
    // 17.11 (etalons, klase B): kļūdains PIRMAIS rādījums. Agrāk vainots nākamais (pareizais) punkts.
    if (prev == null && i + 2 < pts.length && src && !isListingMileageSource(src)) {
      const n1 = pts[i + 1]!;
      const n2 = pts[i + 2]!;
      // 19.11: mēneša precizitātes rādījums (CarVertical 11.2012) var būt no mēneša beigām - 31 dienas logu skaita
      // no mēneša pēdējās dienas, citādi 01.11 -> 04.12 izskatās pēc 33 dienām un pareizais dīleris saņem sarkano joslu.
      const firstTime = src.datePrecision === "month" ? endOfUtcMonth(curr.time) : curr.time;
      if (
        isLeadingMileageEntryError(curr.km, firstTime, n1.km, Math.max(n1.time, firstTime), n2.km) &&
        !isMileageCountryChange(src, rowByOrder.get(n1.sourceOrder))
      ) {
        dataEntryErrors.add(curr.sourceOrder);
        chartExclude.add(curr.sourceOrder);
      }
    }
  }

  const staleDocuments = findStaleDocumentSourceOrders(sorted, chartExclude);

  const map = new Map<number, boolean>();
  const listingBelow = new Set<number>();
  let prevKm: number | null = null;
  let prevRow: UnifiedMileageRow | null = null;
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km === null) {
      map.set(r.sourceOrder, false);
      continue;
    }
    if (staleDocuments.has(r.sourceOrder) || dataEntryErrors.has(r.sourceOrder) || r.visitOdometer) {
      // Nav pretruna: dokumenta datums ≠ nolasījuma datums / datu ievades kļūda /
      // vizītes odometrs, kad dīlera nobraukuma tabula bija tukša.
      map.set(r.sourceOrder, false);
      chartExclude.add(r.sourceOrder);
      continue;
    }
    if (chartExclude.has(r.sourceOrder)) {
      map.set(r.sourceOrder, true);
      continue;
    }
    if (isListingMileageSource(r)) {
      // Sludinājums nekad nav sarkanā pretruna; ja zem iepriekšējā fiksētā - atsevišķs dzeltens brīdinājums.
      map.set(r.sourceOrder, false);
      if (prevKm !== null && prevKm - km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) {
        listingBelow.add(r.sourceOrder);
        chartExclude.add(r.sourceOrder);
      }
      continue;
    }
    const sameMonthAsPrev =
      prevRow != null &&
      sameCalendarMonth(prevRow.sortableTime, r.sortableTime) &&
      (prevRow.datePrecision === "month" || r.datePrecision === "month");
    const anom =
      !sameMonthAsPrev &&
      prevKm !== null &&
      km < prevKm &&
      prevKm - km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
    map.set(r.sourceOrder, anom);
    if (!isListingMileageSource(r)) {
      prevKm = km;
      prevRow = r;
    }
  }

  return {
    anomalyBySourceOrder: map,
    chartExcludeSourceOrders: chartExclude,
    staleDocumentSourceOrders: staleDocuments,
    dataEntryErrorSourceOrders: dataEntryErrors,
    listingBelowRecordedSourceOrders: listingBelow,
    typoSpikeSourceOrders: typoSpikes,
  };
}

/** @see analyzeUnifiedMileageAnomalies */
/**
 * CSDD „Odometra rādījums” bez datuma (nereģistrēts auto: LV nobraukuma tabulas nav).
 * Datums ir aptuvens - sludinājuma pirmās publicēšanas mēnesis (`tirgus.listingCreated`).
 * Šī rinda NAV vienotajā tabulā un krituma aprēķinā; tikai AI kontekstam un kā
 * apstiprinājums, ka trends turpinās (forenzika). Saglabātie dati netiek mainīti.
 */
export type CsddUndatedOdometer = {
  km: number;
  /** `MM.YYYY` vai "" (datums nav zināms). */
  approxMonth: string;
  /** Mēneša 1. datums UTC ms vai null. */
  approxTime: number | null;
};

export function resolveCsddUndatedOdometer(
  payload: Pick<UnifiedMileageSourcePayload, "csddForm" | "tirgusForm">,
): CsddUndatedOdometer | null {
  const block = payload.csddForm?.prevInspectionBlock;
  const digits = (block?.odometer ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if ((block?.inspectionDateText ?? "").trim()) return null;
  const km = Number(digits);
  if (!Number.isFinite(km) || km < 100) return null;
  const dated = (payload.csddForm?.mileageHistory ?? []).some(
    (r) => r.date.trim() && r.odometer.replace(/\D/g, "") === digits,
  );
  if (dated) return null;
  const created = (payload.tirgusForm?.listingCreated ?? "").trim();
  const t = created ? parseMileageDateForSort(created) : Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(t) || t === Number.NEGATIVE_INFINITY) {
    return { km, approxMonth: "", approxTime: null };
  }
  const d = new Date(t);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return {
    km,
    approxMonth: `${month}.${d.getUTCFullYear()}`,
    approxTime: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
  };
}

/** Viena rinda AI kontekstam (faktu lapa / apvienotais nobraukums). */
export function formatCsddUndatedOdometerLine(u: CsddUndatedOdometer): string {
  const km = String(u.km).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const when = u.approxMonth
    ? `aptuveni ${u.approxMonth} (sludinājuma pirmās publicēšanas mēnesis, aptuvens datums)`
    : "datums nav zināms";
  return `CSDD odometra rādījums bez datuma: ${km} km, ${when}. Nav kritumu un tempa aprēķinā.`;
}

export function computeOdometerAnomalyBySourceOrder(rows: UnifiedMileageRow[]): Map<number, boolean> {
  return analyzeUnifiedMileageAnomalies(rows).anomalyBySourceOrder;
}

/** Servisa vēsturē mērinstrumentu paneļa / odometra nomaiņa = reālas korekcijas pazīme. */
export const ODOMETER_REPLACEMENT_RE =
  /instrument(?:en)?\s*cluster|kombiinstrument|tachometer\s*(?:replace|tausch)|tacho\w*\s*(?:getauscht|ersetzt|tausch)|speedometer\s*(?:replace|repair)|odomet\w*\s*(?:replace|repair|nomai|maiņ|remont)|(?:nomai\w*|maiņ\w*|remont\w*)\s+odometr|mērinstrumentu\s+panel\w*\s*(?:nomai|maiņ|remont)|spidometr\w*\s*(?:nomai|maiņ|remont)/i;

/** j26: neticams rādījums - zem šī km pēc > 1 gada, ja agrāk bija ≥ 10× lielāks. */
export const IMPLAUSIBLE_READING_MAX_KM = 1_000;
export const IMPLAUSIBLE_READING_MIN_AGE_DAYS = 365;
export const IMPLAUSIBLE_READING_RATIO = 10;

/**
 * Neticami rādījumi (piem. 100 km reģistrācijas apskatē pēc eksporta): vienmēr ievades kļūda,
 * valsts maiņa to neietekmē. Ja servisā fiksēta odometra / paneļa nomaiņa - netiek piemērots.
 * Saglabātos datus nemaina: rindas izslēdz tikai aprēķinā un PDF/AI.
 */
export function findImplausibleMileageReadings(
  rows: readonly UnifiedMileageRow[],
  opts?: { odometerReplacementNoted?: boolean },
): UnifiedMileageRow[] {
  if (opts?.odometerReplacementNoted) return [];
  const dated = rows
    .map((r) => ({ r, km: Number(r.odometer.replace(/\D/g, "")), t: r.sortableTime }))
    .filter((x) => x.r.odometer.replace(/\D/g, "") !== "" && Number.isFinite(x.km) && Number.isFinite(x.t));
  if (dated.length < 2) return [];
  const earliest = Math.min(...dated.map((x) => x.t));
  return dated
    .filter(
      (x) =>
        x.km < IMPLAUSIBLE_READING_MAX_KM &&
        x.t - earliest >= IMPLAUSIBLE_READING_MIN_AGE_DAYS * 86_400_000 &&
        dated.some(
          (y) => y.t < x.t && y.km >= IMPLAUSIBLE_READING_MAX_KM && y.km >= x.km * IMPLAUSIBLE_READING_RATIO,
        ),
    )
    .map((x) => x.r);
}

export function formatImplausibleReadingLine(r: UnifiedMileageRow): string {
  const km = r.odometer.replace(/\D/g, "");
  return `${r.date}, ${km} km, ${r.sourceLabel}`;
}

export type CollectUnifiedMileageOptions = {
  /** Iekļaut neticamos rādījumus (tikai admin brīdinājumam). Noklusējumā izslēgti. */
  includeImplausible?: boolean;
  /** Tikai admin priekšskatījumam: piezīme par izlaistajiem neticamajiem rādījumiem. */
  showImplausibleNote?: boolean;
  /** Neiekļaut CSDD `mileageHistory` rindas (CSDD bloks var būt PDF, bet ne šī tabula). */
  omitCsddMileage?: boolean;
  /** Tikai PDF tabulai: nerādīt CSDD rādījumu bez datuma („aptuveni MM.YYYY” rinda). */
  omitCsddUndatedRow?: boolean;
  /** Neiekļaut AUTO RECORDS servisa vēsturi. */
  omitAutoRecords?: boolean;
  /** Neiekļaut starptautiskās vēstures odometra ierakstus. */
  omitCcVin?: boolean;
  /** Neiekļaut ASV vēstures odometra ierakstus. */
  omitAsv?: boolean;
  /** Neiekļaut konkrētus trešās puses avotus pēc nosaukuma (`SOURCE_BLOCK_LABELS`). */
  omitVendorBlockTitles?: Set<string>;
  /** Neiekļaut sludinājuma odometra rindu. */
  omitListingMileage?: boolean;
};

function dealerDocumentKey(dateRaw: string, odometerRaw: string): string {
  return `${dateRaw.trim()}|${odometerRaw.replace(/\D/g, "")}`;
}

function countryFromServiceWorkLocation(location: string): string {
  const t = location.trim();
  if (!t || /[,;/]/.test(t)) return "";
  if (!countryLabelToIso2(t)) return "";
  return normalizeCountryNameLv(t) || t;
}

/**
 * Dīlera remonta / apkopes pasūtījumu (datums + odometrs) atslēgas — pēc tām nobraukuma rinda
 * tiek atzīta par dokumenta rādījumu, nevis par faktisku odometra nolasījumu.
 */
function dealerDocumentOdometerKeys(works: AutoRecordsBlockState["serviceWorks"] | undefined): Set<string> {
  const keys = new Set<string>();
  for (const w of works ?? []) {
    const date = formatAutoRecordsDateForOutput(w.date) || w.date.trim();
    const digits = w.odometer.replace(/\D/g, "");
    if (!date || !digits) continue;
    keys.add(dealerDocumentKey(date, digits));
  }
  return keys;
}

export function collectUnifiedMileageRows(
  p: UnifiedMileageSourcePayload,
  options?: CollectUnifiedMileageOptions,
): UnifiedMileageRow[] {
  const rows: UnifiedMileageRow[] = [];
  let sourceOrder = 0;
  let pendingVisitOdometers: { date: string; odometer: string; country: string; unit: string }[] = [];
  let futureDropped = 0;
  const pushRow = (
    dateRaw: string,
    odometerRaw: string,
    countryRaw: string,
    sourceLabelRaw: string,
    documentValue = false,
    countryUnverified = false,
    unitRaw?: string,
    visitOdometer = false,
    allowBlankCountry = false,
  ) => {
    const date = formatAutoRecordsDateForOutput(dateRaw) || dateRaw.trim();
    const datePrecision =
      detectMileageDatePrecision(dateRaw) === "month" || isMonthOnlyVendorReading(sourceLabelRaw, date) ? "month" : "day";
    const unit = parseMileageUnit(unitRaw) ?? parseMileageUnit(odometerRaw);
    const odometer = odometerToKmDisplay(odometerRaw.trim(), unit);
    if (!date || !odometer) return;
    // Jebkura avota rādījums ar datumu nākotnē nav fakts (Nils 23.11.2026) - netiek ne tabulā, ne PDF, ne AI.
    if (isImpossibleFutureDate(date)) {
      futureDropped += 1;
      return;
    }
    const countryNorm = normalizeCountryNameLv(countryRaw ?? "");
    rows.push({
      date,
      odometer,
      country: countryNorm || (allowBlankCountry ? "" : CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL),
      sortableTime: parseMileageDateForSort(date),
      sourceOrder,
      sourceLabel: sourceLabelRaw.trim() || "Nezināms avots",
      datePrecision,
      ...(unit ? { unit } : null),
      ...(documentValue ? { documentValue: true } : null),
      ...(countryUnverified ? { countryUnverified: true } : null),
      ...(visitOdometer ? { visitOdometer: true } : null),
    });
    sourceOrder += 1;
  };

  if (!options?.omitCsddMileage) {
    const csddRows = (p.csddForm?.mileageHistory ?? []).filter(csddMileageRowHasData);
    for (const r of csddRows) {
      pushRow(r.date, r.odometer, r.country, "CSDD");
    }
  }

  if (!options?.omitAutoRecords) {
    const dealer = resolveDealerAutoRecords(
      p.autoRecordsBlock,
      p.oneautoBlock,
      emptyAutoRecordsBlock(),
    );
    const autoRows = (dealer.serviceHistory ?? []).filter(autoRecordsRowHasData);
    const works = dealer.serviceWorks ?? [];
    const documentKeys = dealerDocumentOdometerKeys(works);
    if (autoRows.length === 0) {
      pendingVisitOdometers = works
        .map((w) => ({
          date: w.date,
          odometer: normalizeAutoRecordsOdometer(w.odometer) || w.odometer.replace(/\D/g, ""),
          country: countryFromServiceWorkLocation(w.location),
          unit: w.odometer,
        }))
        .filter((w) => (formatAutoRecordsDateForOutput(w.date) || w.date.trim()) && w.odometer);
    }
    for (const r of autoRows) {
      const dateOut = formatAutoRecordsDateForOutput(r.date) || r.date.trim();
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      pushRow(
        r.date,
        odoOut,
        r.country,
        "OFICIĀLĀ DĪLERA DATI",
        documentKeys.has(dealerDocumentKey(dateOut, odoOut)),
        false,
        r.unit ?? r.odometer,
      );
    }
  }

  if (!options?.omitCcVin) {
    for (const r of (p.ccVinBlock?.mileage ?? []).filter(autoRecordsRowHasData)) {
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      const country = isGenericRegionCountry(r.country)
        ? ccVinAuctionCountryForDate(p.ccVinBlock, r.date) || r.country
        : r.country;
      pushRow(r.date, odoOut, country, CC_VIN_PDF_SOURCE_LABEL, false, false, r.unit ?? r.odometer);
    }
  }

  if (!options?.omitAsv) {
    for (const r of (p.asvBlock?.mileage ?? []).filter(autoRecordsRowHasData)) {
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      pushRow(r.date, odoOut, r.country, ASV_PDF_SOURCE_LABEL, false, false, r.unit ?? r.odometer);
    }
  }

  const omitTitles = options?.omitVendorBlockTitles;
  const vendors = (p.manualVendorBlocks ?? []).filter((b) => !omitTitles || !omitTitles.has(b.title));
  for (const b of vendors) {
    // 17.11 (etalons, B2): rādījums, kas avota laika joslā ir sludinājums ("Pārdošanai piedāvātas automašīnas",
    // dīlera piedāvājums, izsole), nav oficiāls fiksējums - apzīmē kā sludinājumu (nav kritumu bāze, nav kritums).
    const listingKeys = new Set(
      (b.listingCountryHints ?? [])
        .filter((h) => h.odometer?.trim())
        .map((h) => vendorListingKey(h.date, h.odometer!)),
    );
    for (const r of (b.mileageRows ?? []).filter(autoRecordsRowHasData)) {
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      const isListing = listingKeys.size > 0 && listingKeys.has(vendorListingKey(r.date, r.odometer));
      pushRow(
        r.date,
        odoOut,
        r.country,
        isListing ? `${b.title} ${VENDOR_LISTING_LABEL_SUFFIX}` : b.title,
        false,
        isListing,
        r.unit ?? r.odometer,
      );
    }
  }

  const citiBlock = p.citiAvotiBlock;
  if (citiBlock?.sections) {
    const total = citiBlock.sections.length;
    for (const [i, section] of citiBlock.sections.entries()) {
      if (!citiAvotiSectionHasContent(section)) continue;
      const sourceLabel = citiAvotiSectionLabel(section, i, total).toUpperCase();
      for (const r of (section.serviceHistory ?? []).filter(autoRecordsRowHasData)) {
        const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
        pushRow(r.date, odoOut, r.country, sourceLabel, false, false, r.unit ?? r.odometer);
      }
      const citiComments = section.comments.trim();
      if (citiComments) {
        const parsed = parseCitiAvotiMileageFromComments(citiComments);
        for (const r of parsed) {
          const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
          pushRow(r.date, odoOut, r.country, sourceLabel, false, false, r.odometer);
        }
      }
    }
  }

  if (!options?.omitListingMileage) {
    const listing = resolveListingMileageChartRow(p.tirgusForm, p.listingUrl);
    if (listing) {
      // Sludinājuma valsts (piem. ss.lv → vienmēr "Latvija") ir pieņēmums, ne apstiprināts fakts.
      pushRow(listing.date, listing.odometer, listing.country, listing.sourceLabel, false, true);
    }
  }

  if (pendingVisitOdometers.length > 0) {
    const seen = new Set(
      rows.map((r) => `${r.date.trim().toLowerCase()}|${r.odometer.replace(/\D/g, "")}`),
    );
    for (const w of pendingVisitOdometers) {
      const dateOut = formatAutoRecordsDateForOutput(w.date) || w.date.trim();
      const key = `${dateOut.toLowerCase()}|${w.odometer.replace(/\D/g, "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pushRow(w.date, w.odometer, w.country, "OFICIĀLĀ DĪLERA DATI", true, false, w.unit, true, true);
    }
  }

  const dedup = new Set<string>();
  const out: UnifiedMileageRow[] = [];
  for (const r of inferMissingMileageCountries(rows)) {
    const k = `${r.date.trim().toLowerCase()}|${r.odometer.replace(/\D/g, "")}|${r.country.trim().toLowerCase()}|${r.sourceLabel.trim().toLowerCase()}`;
    if (dedup.has(k)) continue;
    dedup.add(k);
    out.push(r);
  }
  if (futureDropped > 0 && typeof window === "undefined") {
    console.warn("[future-date-guard] izmesti ieraksti ar datumu nākotnē", { source: "unified_mileage", count: futureDropped });
  }
  if (options?.includeImplausible) return out;
  const implausible = new Set(
    findImplausibleMileageReadings(out, { odometerReplacementNoted: odometerReplacementNotedIn(p) }),
  );
  return implausible.size > 0 ? out.filter((r) => !implausible.has(r)) : out;
}

function isUnknownMileageCountry(country: string): boolean {
  const c = country.trim();
  // 19.11: "Nezināmā" (ar ā) agrāk netika atpazīts pēc toLocaleLowerCase - nezināma valsts skaitījās kā valsts
  // maiņa, un tas bloķēja ievades kļūdu atpazīšanu (CV 11.2012 89 960 -> dīleris 04.12.2012 2 954).
  return (
    !c ||
    c.toLocaleLowerCase("lv") === CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL.toLocaleLowerCase("lv") ||
    /^nezin[āa]m/i.test(c)
  );
}

/**
 * 18.11 (Nila plāns, 3. tēma): tukšu vai „Nezināmā” valsti aizpilda no pārējiem rādījumiem - tikai, ja tajā pašā
 * mēnesī ir viena valsts vai abi tuvākie kaimiņi ir vienā valstī. Pāri valsts maiņai un pirms pirmā / pēc pēdējā
 * zināmā rādījuma neaizpilda. Sludinājumu vieta nav pierādījums. Tikai nolasot - saglabātie dati netiek mainīti.
 */
export function inferMissingMileageCountries<T extends UnifiedMileageRow>(rows: T[]): T[] {
  const evidence = rows.filter((r) => !r.countryUnverified && !isUnknownMileageCountry(r.country));
  if (evidence.length === 0 || evidence.length === rows.length) return rows;
  const timeline = buildCountryTimeline(
    evidence.map((r) => ({ date: formatAutoRecordsDateForOutput(r.date) || r.date, country: r.country })),
  );
  return rows.map((r) => {
    if (!isUnknownMileageCountry(r.country)) return r;
    const country = resolveCountryForDate(timeline, formatAutoRecordsDateForOutput(r.date) || r.date, {
      extrapolateAfterLast: false,
    });
    return country ? { ...r, country, countryInferred: true } : r;
  });
}

function odometerReplacementNotedIn(p: UnifiedMileageSourcePayload): boolean {
  const works = (p.autoRecordsBlock?.serviceWorks ?? []).map((w) => w.works).join("\n");
  return ODOMETER_REPLACEMENT_RE.test(works);
}

/** Admin brīdinājumam: rādījumi, ko PDF un AI izlaiž kā neticamus. */
export function collectImplausibleMileageReadings(
  p: UnifiedMileageSourcePayload,
  options?: CollectUnifiedMileageOptions,
): UnifiedMileageRow[] {
  const all = collectUnifiedMileageRows(p, { ...options, includeImplausible: true });
  return findImplausibleMileageReadings(all, { odometerReplacementNoted: odometerReplacementNotedIn(p) });
}

function parseCitiAvotiMileageFromComments(raw: string): { date: string; odometer: string; country: string }[] {
  const out: { date: string; odometer: string; country: string }[] = [];
  const lines = raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^NOBRAUKUMA\s+VĒSTURE$/i.test(line) || /datums\s*\|\s*odometrs\s*\|\s*valsts/i.test(line)) {
      continue;
    }

    const cols = line.split(/\s*\|\s*|\t+/).map((x) => x.trim());
    if (cols.length >= 3 && isLikelyDate(cols[0] ?? "") && /\d/.test(cols[1] ?? "")) {
      out.push({ date: cols[0]!, odometer: cols[1]!, country: cols[2]! });
      continue;
    }

    const kv = line.match(
      /datums\s*[:\-]\s*([^,;|]+)\s*[,;|]\s*odometrs\s*[:\-]\s*([^,;|]+)\s*[,;|]\s*valsts\s*[:\-]\s*(.+)$/i,
    );
    if (kv) {
      out.push({ date: kv[1]!.trim(), odometer: kv[2]!.trim(), country: kv[3]!.trim() });
    }
  }

  return out;
}

function isLikelyDate(raw: string): boolean {
  const t = raw.trim();
  return /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/.test(t) || /^(\d{4})-(\d{2})-(\d{2})$/.test(t);
}

export function hasAnyOdometerAnomaly(anomalyBySourceOrder: Map<number, boolean>): boolean {
  for (const v of anomalyBySourceOrder.values()) {
    if (v) return true;
  }
  return false;
}
