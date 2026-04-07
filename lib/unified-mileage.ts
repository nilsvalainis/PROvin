/**
 * Vienots nobraukums no visiem avotiem (CSDD, AUTO RECORDS, AutoDNA, CarVertical) + anomāliju noteikšana.
 */

import {
  CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
  csddMileageRowHasData,
  type AutoRecordsBlockState,
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
};

export type UnifiedMileageSourcePayload = {
  csddForm?: CsddFormFields | null;
  autoRecordsBlock?: AutoRecordsBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
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

export function collectUnifiedMileageRows(p: UnifiedMileageSourcePayload): UnifiedMileageRow[] {
  const rows: UnifiedMileageRow[] = [];
  let sourceOrder = 0;
  const pushRow = (dateRaw: string, odometerRaw: string, countryRaw: string) => {
    const date = dateRaw.trim();
    const odometer = odometerRaw.trim();
    if (!date || !odometer) return;
    rows.push({
      date,
      odometer,
      country: countryRaw.trim() || CSDD_MILEAGE_COUNTRY_UNKNOWN_LABEL,
      sortableTime: parseMileageDateForSort(date),
      sourceOrder,
    });
    sourceOrder += 1;
  };

  const csddRows = p.csddForm?.mileageHistory.filter(csddMileageRowHasData) ?? [];
  for (const r of csddRows) {
    pushRow(r.date, r.odometer, r.country);
  }

  const autoRows = p.autoRecordsBlock?.serviceHistory.filter(autoRecordsRowHasData) ?? [];
  for (const r of autoRows) {
    const dateOut = formatAutoRecordsDateForOutput(r.date);
    const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
    pushRow(dateOut, odoOut, r.country);
  }

  const vendorRows = (p.manualVendorBlocks ?? []).flatMap((b) => b.mileageRows.filter(autoRecordsRowHasData));
  for (const r of vendorRows) {
    const dateOut = formatAutoRecordsDateForOutput(r.date);
    const odoOut = normalizeAutoRecordsOdometer(r.odometer) || r.odometer.replace(/\D/g, "");
    pushRow(dateOut, odoOut, r.country);
  }

  return rows;
}

export function hasAnyOdometerAnomaly(anomalyBySourceOrder: Map<number, boolean>): boolean {
  for (const v of anomalyBySourceOrder.values()) {
    if (v) return true;
  }
  return false;
}
