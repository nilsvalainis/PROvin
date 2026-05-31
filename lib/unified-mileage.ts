/**
 * Vienots nobraukums no visiem avotiem (CSDD, AUTO RECORDS, AutoDNA, CarVertical) + anomāliju noteikšana.
 */

import {
  CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
  csddMileageRowHasData,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
  citiAvotiSectionLabel,
  citiAvotiSectionHasContent,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
} from "@/lib/auto-records-paste-parse";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";

export type UnifiedMileageRow = {
  date: string;
  odometer: string;
  country: string;
  sortableTime: number;
  sourceOrder: number;
  sourceLabel: string;
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
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  citiAvotiBlock?: CitiAvotiBlockState | null;
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
  return {
    ...primary,
    country: countries.length <= 1 ? (countries[0] ?? primary.country) : countries.join(" / "),
    sourceOrder: Math.min(...cluster.map((r) => r.sourceOrder)),
    sourceLabel: labels[0] ?? primary.sourceLabel,
    sourceLabels: labels,
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
 * Back-roll: anomālija tikai ja V_current < V_previous un starpība ≥ {@link UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM} km.
 */
export function computeOdometerAnomalyBySourceOrder(rows: UnifiedMileageRow[]): Map<number, boolean> {
  const sorted = sortMileageChronological(rows);
  const map = new Map<number, boolean>();
  let prevKm: number | null = null;
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km === null) {
      map.set(r.sourceOrder, false);
      continue;
    }
    const anom =
      prevKm !== null &&
      km < prevKm &&
      prevKm - km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM;
    map.set(r.sourceOrder, anom);
    prevKm = km;
  }
  return map;
}

export type CollectUnifiedMileageOptions = {
  /** Neiekļaut CSDD `mileageHistory` rindas (CSDD bloks var būt PDF, bet ne šī tabula). */
  omitCsddMileage?: boolean;
  /** Neiekļaut AUTO RECORDS servisa vēsturi. */
  omitAutoRecords?: boolean;
  /** Neiekļaut konkrētus trešās puses avotus pēc nosaukuma (`SOURCE_BLOCK_LABELS`). */
  omitVendorBlockTitles?: Set<string>;
};

export function collectUnifiedMileageRows(
  p: UnifiedMileageSourcePayload,
  options?: CollectUnifiedMileageOptions,
): UnifiedMileageRow[] {
  const rows: UnifiedMileageRow[] = [];
  let sourceOrder = 0;
  const pushRow = (dateRaw: string, odometerRaw: string, countryRaw: string, sourceLabelRaw: string) => {
    const date = dateRaw.trim();
    const odometer = odometerRaw.trim();
    if (!date || !odometer) return;
    const countryNorm = normalizeCountryNameLv(countryRaw);
    rows.push({
      date,
      odometer,
      country: countryNorm || CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
      sortableTime: parseMileageDateForSort(date),
      sourceOrder,
      sourceLabel: sourceLabelRaw.trim() || "Nezināms avots",
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
  for (const r of autoRows) {
    const dateOut = formatAutoRecordsDateForOutput(r.date);
    const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
    pushRow(dateOut, odoOut, r.country, "AUTO RECORDS");
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
