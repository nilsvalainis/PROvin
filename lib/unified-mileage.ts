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
} from "@/lib/admin-source-blocks";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
} from "@/lib/auto-records-paste-parse";
import { CC_VIN_PDF_SOURCE_LABEL, type CcVinBlockState } from "@/lib/cc-vin-report";
import { resolveListingMileageChartRow } from "@/lib/listing-odometer";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

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
};

/** Tabulas rinda pēc km apvienošanas — vairāki avoti vienā „Avots” kolonnā. */
export type UnifiedMileageDisplayRow = UnifiedMileageRow & {
  sourceLabels: string[];
};

/** Maks. datumu starplaiks km apvienošanai (~2 kalendāra mēneši). */
export const UNIFIED_MILEAGE_MERGE_MAX_DATE_SPAN_MS = 62 * 24 * 60 * 60 * 1000;

export type UnifiedMileageSourcePayload = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  ccVinBlock?: CcVinBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  citiAvotiBlock?: CitiAvotiBlockState | null;
  tirgusForm?: TirgusFormFields | null;
  listingUrl?: string | null;
};

export function parseMileageDateForSort(raw: string): number {
  const ms = parseDotOrIsoDateToMs(raw);
  return ms > 0 ? ms : Number.NEGATIVE_INFINITY;
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
  const primary = chrono[chrono.length - 1] ?? cluster[0]!;
  const labels = uniqueSourceLabelsOrdered(cluster);
  const countries = [...new Set(cluster.map((r) => r.country.trim()).filter(Boolean))];
  // Ja to pašu km apstiprina kāds neatkarīgs nolasījums, apvienotā rinda vairs nav tikai dokumenta vērtība.
  const documentValue = cluster.every((r) => r.documentValue === true);
  return {
    ...primary,
    country: countries.length <= 1 ? (countries[0] ?? primary.country) : countries.join(" / "),
    sourceOrder: Math.min(...cluster.map((r) => r.sourceOrder)),
    sourceLabel: labels[0] ?? primary.sourceLabel,
    sourceLabels: labels,
    ...(documentValue ? { documentValue: true } : { documentValue: undefined }),
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

/** Tabulas / grafika rindas — hronoloģiski + km apvienošana. */
export function prepareUnifiedMileageDisplayRows(rows: UnifiedMileageRow[]): UnifiedMileageDisplayRow[] {
  return mergeUnifiedMileageRowsByOdometer(sortMileageChronological([...rows]));
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
};

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
  let trustedMaxKm: number | null = null;

  for (const pt of pts) {
    const belowTrusted =
      trustedMaxKm !== null && trustedMaxKm - pt.km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
    const mirrorsStaleValue = staleValues.some(
      (v) => Math.abs(v - pt.km) <= STALE_DOCUMENT_MIRROR_TOLERANCE_KM,
    );
    if (belowTrusted && (pt.documentValue || mirrorsStaleValue)) {
      candidates.push({ sourceOrder: pt.sourceOrder, levelKm: trustedMaxKm! });
      candidateOrders.add(pt.sourceOrder);
      staleValues.push(pt.km);
      continue;
    }
    trustedMaxKm = trustedMaxKm === null ? pt.km : Math.max(trustedMaxKm, pt.km);
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

  const pts: { sourceOrder: number; km: number }[] = [];
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km !== null) pts.push({ sourceOrder: r.sourceOrder, km });
  }

  for (let i = 0; i < pts.length; i++) {
    const prev = i > 0 ? pts[i - 1]!.km : null;
    const next = i < pts.length - 1 ? pts[i + 1]!.km : null;
    const curr = pts[i]!;
    if (isSpuriousMileageSpike(curr.km, prev, next)) {
      chartExclude.add(curr.sourceOrder);
      continue;
    }
    // Spike kā pēdējais punkts: tikai ×10 pret iepriekšējo.
    if (next == null && prev != null && looksLikeExtraDigitOdometerTypo(curr.km, prev)) {
      chartExclude.add(curr.sourceOrder);
    }
  }

  const staleDocuments = findStaleDocumentSourceOrders(sorted, chartExclude);

  const map = new Map<number, boolean>();
  let prevKm: number | null = null;
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km === null) {
      map.set(r.sourceOrder, false);
      continue;
    }
    if (staleDocuments.has(r.sourceOrder)) {
      // Nav pretruna: dokumenta datums ≠ nolasījuma datums. Ķēdē un līknē neietekmē.
      map.set(r.sourceOrder, false);
      chartExclude.add(r.sourceOrder);
      continue;
    }
    if (chartExclude.has(r.sourceOrder)) {
      map.set(r.sourceOrder, true);
      continue;
    }
    const anom =
      prevKm !== null && km < prevKm && prevKm - km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
    map.set(r.sourceOrder, anom);
    prevKm = km;
  }

  return {
    anomalyBySourceOrder: map,
    chartExcludeSourceOrders: chartExclude,
    staleDocumentSourceOrders: staleDocuments,
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
  /** Neiekļaut konkrētus trešās puses avotus pēc nosaukuma (`SOURCE_BLOCK_LABELS`). */
  omitVendorBlockTitles?: Set<string>;
  /** Neiekļaut sludinājuma odometra rindu. */
  omitListingMileage?: boolean;
};

function dealerDocumentKey(dateRaw: string, odometerRaw: string): string {
  return `${dateRaw.trim()}|${odometerRaw.replace(/\D/g, "")}`;
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
  const pushRow = (
    dateRaw: string,
    odometerRaw: string,
    countryRaw: string,
    sourceLabelRaw: string,
    documentValue = false,
  ) => {
    const date = dateRaw.trim();
    const odometer = odometerRaw.trim();
    if (!date || !odometer) return;
    const countryNorm = normalizeCountryNameLv(countryRaw ?? "");
    rows.push({
      date,
      odometer,
      country: countryNorm || CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
      sortableTime: parseMileageDateForSort(date),
      sourceOrder,
      sourceLabel: sourceLabelRaw.trim() || "Nezināms avots",
      ...(documentValue ? { documentValue: true } : null),
    });
    sourceOrder += 1;
  };

  if (!options?.omitCsddMileage) {
    const csddRows = (p.csddForm?.mileageHistory ?? []).filter(csddMileageRowHasData);
    for (const r of csddRows) {
      pushRow(r.date, r.odometer, r.country, "CSDD");
    }
  }

  if (options?.omitAutoRecords) {
    /* skip auto records */
  } else {
  const autoRows = (p.autoRecordsBlock?.serviceHistory ?? []).filter(autoRecordsRowHasData);
  const documentKeys = dealerDocumentOdometerKeys(p.autoRecordsBlock?.serviceWorks);
  for (const r of autoRows) {
    const dateOut = formatAutoRecordsDateForOutput(r.date);
    const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
    pushRow(dateOut, odoOut, r.country, "OFICIĀLĀ DĪLERA DATI", documentKeys.has(dealerDocumentKey(dateOut, odoOut)));
  }
  }

  if (!options?.omitCcVin) {
    for (const r of (p.ccVinBlock?.mileage ?? []).filter(autoRecordsRowHasData)) {
      const dateOut = formatAutoRecordsDateForOutput(r.date);
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      pushRow(dateOut, odoOut, r.country, CC_VIN_PDF_SOURCE_LABEL);
    }
  }

  const omitTitles = options?.omitVendorBlockTitles;
  const vendors = (p.manualVendorBlocks ?? []).filter((b) => !omitTitles || !omitTitles.has(b.title));
  for (const b of vendors) {
    for (const r of (b.mileageRows ?? []).filter(autoRecordsRowHasData)) {
      const dateOut = formatAutoRecordsDateForOutput(r.date);
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      pushRow(dateOut, odoOut, r.country, b.title);
    }
  }

  const citiBlock = p.citiAvotiBlock;
  if (citiBlock?.sections) {
    const total = citiBlock.sections.length;
    for (const [i, section] of citiBlock.sections.entries()) {
      if (!citiAvotiSectionHasContent(section)) continue;
      const sourceLabel = citiAvotiSectionLabel(section, i, total).toUpperCase();
      for (const r of (section.serviceHistory ?? []).filter(autoRecordsRowHasData)) {
        const dateOut = formatAutoRecordsDateForOutput(r.date);
        const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
        pushRow(dateOut, odoOut, r.country, sourceLabel);
      }
      const citiComments = section.comments.trim();
      if (citiComments) {
        const parsed = parseCitiAvotiMileageFromComments(citiComments);
        for (const r of parsed) {
          const dateOut = formatAutoRecordsDateForOutput(r.date);
          const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
          pushRow(dateOut, odoOut, r.country, sourceLabel);
        }
      }
    }
  }

  if (!options?.omitListingMileage) {
    const listing = resolveListingMileageChartRow(p.tirgusForm, p.listingUrl);
    if (listing) {
      pushRow(listing.date, listing.odometer, listing.country, listing.sourceLabel);
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
