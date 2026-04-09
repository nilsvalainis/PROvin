/**
 * Vienots nobraukums no visiem avotiem (CSDD, AUTO RECORDS, AutoDNA, CarVertical) + anomāliju noteikšana.
 */

import {
  CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
  csddMileageRowHasData,
  type AutoRecordsBlockState,
  type CitiAvotiBlockState,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
} from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  normalizeAutoRecordsOdometer,
} from "@/lib/auto-records-paste-parse";

export type UnifiedMileageRow = {
  date: string;
  odometer: string;
  country: string;
  sortableTime: number;
  sourceOrder: number;
  sourceLabel: string;
};

export type UnifiedMileageSourcePayload = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  citiAvotiBlock?: CitiAvotiBlockState | null;
};

export function parseMileageDateForSort(raw: string): number {
  const t = raw.trim();
  if (!t) return Number.NEGATIVE_INFINITY;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number.parseInt(iso[1] ?? "", 10);
    const m = Number.parseInt(iso[2] ?? "", 10);
    const d = Number.parseInt(iso[3] ?? "", 10);
    return Date.UTC(y, Math.max(0, m - 1), d);
  }
  const lv = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (lv) {
    const d = Number.parseInt(lv[1] ?? "", 10);
    const m = Number.parseInt(lv[2] ?? "", 10);
    const yRaw = Number.parseInt(lv[3] ?? "", 10);
    const y = yRaw < 100 ? 2000 + yRaw : yRaw;
    return Date.UTC(y, Math.max(0, m - 1), d);
  }
  const ts = Date.parse(t);
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
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

/**
 * Back-roll: ja V_current < V_previous (hronoloģiski iepriekšējais derīgais odometrs), isAnomaly = true.
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
    const anom = prevKm !== null && km < prevKm;
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
    rows.push({
      date,
      odometer,
      country: countryRaw.trim() || CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
      sortableTime: parseMileageDateForSort(date),
      sourceOrder,
      sourceLabel: sourceLabelRaw.trim() || "Nezināms avots",
    });
    sourceOrder += 1;
  };

  if (!options?.omitCsddMileage) {
    const csddRows = p.csddForm?.mileageHistory.filter(csddMileageRowHasData) ?? [];
    for (const r of csddRows) {
      pushRow(r.date, r.odometer, r.country, "CSDD");
    }
  }

  if (options?.omitAutoRecords) {
    /* skip auto records */
  } else {
  const autoRows = p.autoRecordsBlock?.serviceHistory.filter(autoRecordsRowHasData) ?? [];
  for (const r of autoRows) {
    const dateOut = formatAutoRecordsDateForOutput(r.date);
    const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
    pushRow(dateOut, odoOut, r.country, "AUTO RECORDS");
  }
  }

  const omitTitles = options?.omitVendorBlockTitles;
  const vendors = (p.manualVendorBlocks ?? []).filter((b) => !omitTitles || !omitTitles.has(b.title));
  for (const b of vendors) {
    for (const r of b.mileageRows.filter(autoRecordsRowHasData)) {
      const dateOut = formatAutoRecordsDateForOutput(r.date);
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      pushRow(dateOut, odoOut, r.country, b.title);
    }
  }

  /**
   * "Citi avoti" komentāri (legacy / manuāla ievade) — mēģina nolasīt
   * Datums/Odometrs/Valsts ierakstus, ja tie nav ielikti strukturētajās rindās.
   */
  const citiComments = p.citiAvotiBlock?.comments?.trim() ?? "";
  if (citiComments) {
    const parsed = parseCitiAvotiMileageFromComments(citiComments);
    for (const r of parsed) {
      const dateOut = formatAutoRecordsDateForOutput(r.date);
      const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
      pushRow(dateOut, odoOut, r.country, "CITI AVOTI");
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
