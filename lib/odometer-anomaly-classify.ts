/**
 * Nobraukuma anomāliju klases (admin brīdinājumi + galvenes „bez pretrunām”).
 * Grafika vizuāli nemaina. Nav maksas modeļa.
 */
import {
  ISOLATED_MILEAGE_DROP_MAX_RECOVERY_MS,
  UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM,
  analyzeUnifiedMileageAnomalies,
  isIsolatedMileageDrop,
  isListingMileageSource,
  parseOdometerKm,
  sortMileageChronological,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

export type OdometerAnomalyClass = "typo_outlier" | "rollback" | "date_precision";

export const ODOMETER_ANOMALY_LABEL_LV: Record<OdometerAnomalyClass, string> = {
  typo_outlier: "Iespējama ievades kļūda",
  rollback: "Nobraukuma kritums",
  date_precision: "Datuma neprecizitāte",
};

export type ClassifiedOdometerAnomaly = {
  key: string;
  sourceOrder: number;
  class: OdometerAnomalyClass;
  labelLv: string;
  fromDate: string;
  toDate: string;
  fromKm: number;
  toKm: number;
  dropKm: number;
};

export type OdometerAnomalyOverrideAction = "confirm" | "dismiss";

export type OdometerAnomalyOverride = {
  key: string;
  action: OdometerAnomalyOverrideAction;
};

/** Vecie pasūtījumi bez lauka paliek `undefined` - netiek pārrakstīti. */
export function parseOdometerAnomalyOverrides(raw: unknown): OdometerAnomalyOverride[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: OdometerAnomalyOverride[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const key = typeof (item as { key?: unknown }).key === "string" ? (item as { key: string }).key.trim() : "";
    const action = (item as { action?: unknown }).action;
    if (!key || (action !== "confirm" && action !== "dismiss") || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, action });
  }
  return out;
}

/** Persistences lauks - tikai ja masīvs ir, lai esošie melnraksti paliek neskarti. */
export function odometerAnomalyOverridesSnapshotField(
  overrides: OdometerAnomalyOverride[] | null | undefined,
): { odometerAnomalyOverrides?: OdometerAnomalyOverride[] } {
  return overrides != null ? { odometerAnomalyOverrides: overrides } : {};
}

export function odometerAnomalyKey(row: Pick<UnifiedMileageRow, "date" | "odometer" | "sourceLabel" | "sourceOrder">): string {
  return `${row.date}|${row.odometer}|${row.sourceLabel}|${row.sourceOrder}`;
}

/** 01.MM.YYYY vai avota mēneša precizitāte - diena izskatās mākslīga. */
export function looksArtificialMonthDay(row: Pick<UnifiedMileageRow, "date" | "datePrecision">): boolean {
  if (row.datePrecision === "month") return true;
  return /^01[./]\d{1,2}[./]\d{2,4}$/.test(row.date.trim());
}

function sameCalendarMonthMs(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
}

/**
 * „Atgūšanās” = maksimums atkal sasniegts tajā pašā logā kā izolētai ievades kļūdai (183 d).
 * Pēc attīšanas auto brauc tālāk un pēc gadiem pārsniedz veco maksimumu - tas kritumu neatceļ
 * (Škoda TMBJH9NP9H7561596: SE 253 760 km 05.2020 → LV 181 345 km 09.2020 → 275 181 km 2025).
 */
function laterPointsStayBelow(
  pts: { km: number; row: Pick<UnifiedMileageRow, "sortableTime"> }[],
  fromIndex: number,
  peakKm: number,
): boolean {
  const dropTime = pts[fromIndex]?.row.sortableTime;
  const later = pts.slice(fromIndex + 1);
  if (later.length === 0) return true;
  const recovered = later.some((p) => {
    if (p.km < peakKm) return false;
    if (dropTime == null || !Number.isFinite(dropTime) || !Number.isFinite(p.row.sortableTime)) return true;
    return p.row.sortableTime - dropTime <= ISOLATED_MILEAGE_DROP_MAX_RECOVERY_MS;
  });
  return !recovered;
}

export function classifyOdometerAnomalies(rows: UnifiedMileageRow[]): ClassifiedOdometerAnomaly[] {
  const sorted = sortMileageChronological(rows);
  const analysis = analyzeUnifiedMileageAnomalies(sorted);
  const pts: Array<{
    row: UnifiedMileageRow;
    km: number;
  }> = [];
  for (const r of sorted) {
    const km = parseOdometerKm(r.odometer);
    if (km == null) continue;
    // Novecojuša dokumenta atkārtojums nav salīdzināšanas punkts (kā grafikā), citādi nākamais
    // rādījums tiek mērīts pret to, nevis pret īsto iepriekšējo maksimumu, un kritums pazūd.
    if (analysis.staleDocumentSourceOrders.has(r.sourceOrder)) continue;
    pts.push({ row: r, km });
  }

  const out: ClassifiedOdometerAnomaly[] = [];
  const seen = new Set<number>();

  const push = (
    row: UnifiedMileageRow,
    cls: OdometerAnomalyClass,
    fromDate: string,
    fromKm: number,
    toKm: number,
  ) => {
    if (seen.has(row.sourceOrder)) return;
    seen.add(row.sourceOrder);
    out.push({
      key: odometerAnomalyKey(row),
      sourceOrder: row.sourceOrder,
      class: cls,
      labelLv: ODOMETER_ANOMALY_LABEL_LV[cls],
      fromDate,
      toDate: row.date,
      fromKm,
      toKm,
      dropKm: fromKm - toKm,
    });
  };

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i]!;
    const prev = i > 0 ? pts[i - 1]! : null;
    const next = i < pts.length - 1 ? pts[i + 1]! : null;
    const src = curr.row;

    if (analysis.dataEntryErrorSourceOrders.has(src.sourceOrder)) {
      push(src, "typo_outlier", prev?.row.date ?? src.date, prev?.km ?? curr.km, curr.km);
      continue;
    }

    if (
      prev &&
      isIsolatedMileageDrop(curr.km, prev.km, next?.km ?? null, src.sortableTime, next?.row.sortableTime) &&
      !isListingMileageSource(src)
    ) {
      push(src, "typo_outlier", prev.row.date, prev.km, curr.km);
      continue;
    }

    if (prev == null) continue;
    const drop = prev.km - curr.km;
    if (drop < UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) continue;
    if (isListingMileageSource(src)) continue;
    if (analysis.staleDocumentSourceOrders.has(src.sourceOrder)) continue;
    if (src.visitOdometer) continue;

    const sameMonth = sameCalendarMonthMs(prev.row.sortableTime, src.sortableTime);
    if (sameMonth && (looksArtificialMonthDay(prev.row) || looksArtificialMonthDay(src))) {
      push(src, "date_precision", prev.row.date, prev.km, curr.km);
      continue;
    }

    if (laterPointsStayBelow(pts, i, prev.km)) {
      push(src, "rollback", prev.row.date, prev.km, curr.km);
    }
  }

  return out;
}

export function applyOdometerAnomalyOverrides(
  anomalies: ClassifiedOdometerAnomaly[],
  overrides?: OdometerAnomalyOverride[] | null,
): ClassifiedOdometerAnomaly[] {
  if (!overrides?.length) return anomalies;
  const byKey = new Map(overrides.map((o) => [o.key, o]));
  return anomalies.filter((a) => byKey.get(a.key)?.action !== "dismiss");
}

export function hasActiveRollbackAnomaly(
  rows: UnifiedMileageRow[],
  overrides?: OdometerAnomalyOverride[] | null,
): boolean {
  const active = applyOdometerAnomalyOverrides(classifyOdometerAnomalies(rows), overrides);
  return active.some((a) => a.class === "rollback");
}

export function countChartMileageReadings(rows: UnifiedMileageRow[]): number {
  const exclude = analyzeUnifiedMileageAnomalies(rows).chartExcludeSourceOrders;
  let n = 0;
  for (const r of sortMileageChronological(rows)) {
    if (exclude.has(r.sourceOrder)) continue;
    if (parseOdometerKm(r.odometer) == null) continue;
    if (r.sortableTime === Number.NEGATIVE_INFINITY) continue;
    n += 1;
  }
  return n;
}

/** Pēdējais grafika / verificētais punkts (ne sludinājums, ne izslēgtais izlēcējs). */
export function selectNewestChartMileageRow<T extends UnifiedMileageRow>(rows: T[]): T | null {
  const exclude = analyzeUnifiedMileageAnomalies(rows).chartExcludeSourceOrders;
  const visible = sortMileageChronological(rows).filter((r) => {
    if (exclude.has(r.sourceOrder)) return false;
    if (parseOdometerKm(r.odometer) == null) return false;
    if (r.sortableTime === Number.NEGATIVE_INFINITY) return false;
    return !isListingMileageSource(r);
  }) as T[];
  if (visible.length === 0) {
    const any = sortMileageChronological(rows).filter(
      (r) => !exclude.has(r.sourceOrder) && parseOdometerKm(r.odometer) != null,
    ) as T[];
    return any[any.length - 1] ?? null;
  }
  return visible[visible.length - 1] ?? null;
}
