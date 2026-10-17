/**
 * Vienots nobraukums no visiem avotiem (CSDD, AUTO RECORDS, AutoDNA, CarVertical) + anomāliju noteikšana.
 */

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

export const MILES_TO_KM = 1.609344;

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
  return ms > 0 ? ms : Number.NEGATIVE_INFINITY;
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
  if (resolved === "mi") return String(Math.round(n * MILES_TO_KM));
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

export function isListingMileageSource(r: Pick<UnifiedMileageRow, "sourceLabel" | "countryUnverified">): boolean {
  const sq = squishMileageSource(r.sourceLabel);
  return (
    sq === "sslv" ||
    sq.includes("ss.lv") ||
    sq === "sludinajums" ||
    sq === "sludinajumaanalize" ||
    sq === "tirgusdati"
  );
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

/** Hronoloģiski: vecākais → jaunākais; vienā datumā — odometrs augošā secībā; nederīgs datums — beigās. */
export function sortMileageChronological(rows: UnifiedMileageRow[]): UnifiedMileageRow[] {
  return [...rows].sort((a, b) => {
    const ta = a.sortableTime === Number.NEGATIVE_INFINITY ? Number.POSITIVE_INFINITY : a.sortableTime;
    const tb = b.sortableTime === Number.NEGATIVE_INFINITY ? Number.POSITIVE_INFINITY : b.sortableTime;
    if (ta !== tb) return ta - tb;
    const ka = parseOdometerKm(a.odometer) ?? Number.POSITIVE_INFINITY;
    const kb = parseOdometerKm(b.odometer) ?? Number.POSITIVE_INFINITY;
    if (ka !== kb) return ka - kb;
    return a.sourceOrder - b.sourceOrder;
  });
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

function mergeMileageCluster(cluster: UnifiedMileageRow[]): UnifiedMileageDisplayRow {
  const chrono = sortMileageChronological(cluster);
  const dayPrecise = chrono.filter((r) => r.datePrecision !== "month");
  const pickFrom = dayPrecise.length > 0 ? dayPrecise : chrono;
  const primary = pickFrom[pickFrom.length - 1] ?? cluster[0]!;
  const labels = uniqueSourceLabelsOrdered(cluster);
  const filledLabels = labels.length > 0 ? labels : [primary.sourceLabel.trim() || "Nezināms avots"];
  const countries = [...new Set(cluster.map((r) => r.country.trim()).filter(Boolean))];
  // Ja to pašu km apstiprina kāds neatkarīgs nolasījums, apvienotā rinda vairs nav tikai dokumenta vērtība.
  const documentValue = cluster.every((r) => r.documentValue === true);
  // Valsts paliek nesertificēta tikai tad, ja pilnīgi visi avoti šajā km klasterī ir nesertificēti
  // (piem. tikai sludinājums) — ja klāt ir kaut viens oficiāls avots, valsts vairs nav tikai pieņēmums.
  const countryUnverified = cluster.every((r) => r.countryUnverified === true);
  const visitOdometer = cluster.every((r) => r.visitOdometer === true);
  const datePrecision = cluster.every((r) => r.datePrecision === "month") ? "month" : "day";
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
    ...(visitOdometer ? { visitOdometer: true } : { visitOdometer: undefined }),
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
  const filledLabels = labels.length > 0 ? labels : [later.sourceLabel.trim() || "Nezināms avots"];
  const countries = [...new Set([later.country.trim(), earlier.country.trim()].filter(Boolean))];
  const documentValue = later.documentValue === true && earlier.documentValue === true;
  const countryUnverified = later.countryUnverified === true && earlier.countryUnverified === true;
  const dayRow = later.datePrecision !== "month" ? later : earlier.datePrecision !== "month" ? earlier : later;
  return {
    ...dayRow,
    country: countries.length <= 1 ? (countries[0] ?? later.country) : countries.join(" / "),
    sourceOrder: Math.min(earlier.sourceOrder, later.sourceOrder),
    sourceLabel: filledLabels[0] ?? later.sourceLabel,
    sourceLabels: filledLabels,
    datePrecision: later.datePrecision === "month" && earlier.datePrecision === "month" ? "month" : "day",
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
export function isSpuriousMileageSpike(currKm: number, prevKm: number | null, nextKm: number | null): boolean {
  if (prevKm == null || nextKm == null) return false;
  if (!(currKm > prevKm && nextKm < currKm)) return false;
  const up = currKm - prevKm;
  const down = currKm - nextKm;
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
  const pts: { sourceOrder: number; km: number; documentValue: boolean }[] = [];
  for (const r of sorted) {
    if (chartExclude.has(r.sourceOrder)) continue;
    const km = parseOdometerKm(r.odometer);
    if (km !== null) pts.push({ sourceOrder: r.sourceOrder, km, documentValue: r.documentValue === true });
  }

  const candidates: StaleDocumentCandidate[] = [];
  const candidateOrders = new Set<number>();
  const staleValues: number[] = [];
  const kmAtCurrentPeak: number[] = [];
  let trustedMaxKm: number | null = null;

  for (const pt of pts) {
    const belowTrusted =
      trustedMaxKm !== null && trustedMaxKm - pt.km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
    const repeatsPeakChainKm = kmAtCurrentPeak.some(
      (v) => Math.abs(v - pt.km) <= STALE_DOCUMENT_MIRROR_TOLERANCE_KM,
    );
    const mirrorsStaleValue = staleValues.some(
      (v) => Math.abs(v - pt.km) <= STALE_DOCUMENT_MIRROR_TOLERANCE_KM,
    );
    if (belowTrusted && (repeatsPeakChainKm || mirrorsStaleValue)) {
      candidates.push({ sourceOrder: pt.sourceOrder, levelKm: trustedMaxKm! });
      candidateOrders.add(pt.sourceOrder);
      staleValues.push(pt.km);
      continue;
    }
    if (trustedMaxKm === null || pt.km >= trustedMaxKm) {
      kmAtCurrentPeak.push(pt.km);
      trustedMaxKm = pt.km;
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
export function analyzeUnifiedMileageAnomalies(rows: UnifiedMileageRow[]): UnifiedMileageAnomalyAnalysis {
  const sorted = sortMileageChronological(rows);
  const chartExclude = new Set<number>();
  const dataEntryErrors = new Set<number>();

  const pts: { sourceOrder: number; km: number; time: number }[] = [];
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km !== null) pts.push({ sourceOrder: r.sourceOrder, km, time: r.sortableTime });
  }

  for (let i = 0; i < pts.length; i++) {
    const prev = i > 0 ? pts[i - 1]!.km : null;
    const next = i < pts.length - 1 ? pts[i + 1]!.km : null;
    const curr = pts[i]!;
    if (isSpuriousMileageSpike(curr.km, prev, next)) {
      chartExclude.add(curr.sourceOrder);
      continue;
    }
    const src = sorted.find((r) => r.sourceOrder === curr.sourceOrder);
    const nextTime = i < pts.length - 1 ? pts[i + 1]!.time : undefined;
    if (
      isIsolatedMileageDrop(curr.km, prev, next, curr.time, nextTime) &&
      !(src && isListingMileageSource(src))
    ) {
      dataEntryErrors.add(curr.sourceOrder);
      chartExclude.add(curr.sourceOrder);
      continue;
    }
    // Spike kā pēdējais punkts: tikai ×10 pret iepriekšējo.
    if (next == null && prev != null && looksLikeExtraDigitOdometerTypo(curr.km, prev)) {
      chartExclude.add(curr.sourceOrder);
    }
  }

  const staleDocuments = findStaleDocumentSourceOrders(sorted, chartExclude);
  const newestVerifiedKm = selectNewestVerifiedMileageRow(sorted);
  const verifiedKm = newestVerifiedKm ? parseOdometerKm(newestVerifiedKm.odometer) : null;

  const map = new Map<number, boolean>();
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
    if (isListingMileageSource(r) && verifiedKm != null && km <= verifiedKm) {
      // Sludinājums pēc pēdējā verificētā rādījuma (Copart 87 000 pret dīlera 88 310) nav pretruna.
      // Vidū starp verificētiem rādījumiem (ss.lv 300 000 starp CSDD 330 488 un 330 779) paliek anomālija.
      const laterVerified = sorted.some(
        (later) =>
          later.sourceOrder !== r.sourceOrder &&
          later.sortableTime > r.sortableTime &&
          isVerifiedMileageSource(later),
      );
      if (!laterVerified) {
        map.set(r.sourceOrder, false);
        continue;
      }
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
  };
}

/** @see analyzeUnifiedMileageAnomalies */
export function computeOdometerAnomalyBySourceOrder(rows: UnifiedMileageRow[]): Map<number, boolean> {
  return analyzeUnifiedMileageAnomalies(rows).anomalyBySourceOrder;
}

export type CollectUnifiedMileageOptions = {
  /** Neiekļaut CSDD `mileageHistory` rindas (CSDD bloks var būt PDF, bet ne šī tabula). */
  omitCsddMileage?: boolean;
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
    const datePrecision = detectMileageDatePrecision(dateRaw);
    const date = formatAutoRecordsDateForOutput(dateRaw) || dateRaw.trim();
    const unit = parseMileageUnit(unitRaw) ?? parseMileageUnit(odometerRaw);
    const odometer = odometerToKmDisplay(odometerRaw.trim(), unit);
    if (!date || !odometer) return;
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
      pushRow(r.date, odoOut, r.country, CC_VIN_PDF_SOURCE_LABEL, false, false, r.unit ?? r.odometer);
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
    for (const r of (b.mileageRows ?? []).filter(autoRecordsRowHasData)) {
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      pushRow(r.date, odoOut, r.country, b.title, false, false, r.unit ?? r.odometer);
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
  for (const r of rows) {
    const k = `${r.date.trim().toLowerCase()}|${r.odometer.replace(/\D/g, "")}|${r.country.trim().toLowerCase()}|${r.sourceLabel.trim().toLowerCase()}`;
    if (dedup.has(k)) continue;
    dedup.add(k);
    out.push(r);
  }
  return out;
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
