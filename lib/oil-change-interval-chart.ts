/**
 * Eļļas intervālu grafiks: strukturēti dati adminā + tā pati sērija kā PDF.
 */
import type { AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import {
  collectEngineOilChangeRows,
  buildOilChangeIntervalSeries,
  type OilChangeIntervalSeries,
} from "@/lib/oil-change-intervals";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { parseOemOilIntervalFromText, type OemOilInterval } from "@/lib/oem-oil-interval";
import { oneautoDisplayToServiceWorks } from "@/lib/oneauto-dealer";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { outvinDealerServiceRowHasData } from "@/lib/outvin-data-bundle";

export type OilIntervalChartRow = {
  id: string;
  date: string;
  odometer: string;
  works: string;
};

export type OilIntervalChartState = {
  rows: OilIntervalChartRow[];
  oemKm: number | null;
  oemMonths: number | null;
  highlightOverOem: boolean;
  /** Kad true, PDF un admin izmanto `rows`, nevis automātisko importu no servisa. */
  useSavedRows: boolean;
};

export function emptyOilIntervalChartRow(): OilIntervalChartRow {
  return { id: newOilIntervalRowId(), date: "", odometer: "", works: "Eļļas maiņa" };
}

export function newOilIntervalRowId(): string {
  return `oil_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyOilIntervalChart(): OilIntervalChartState {
  return {
    rows: [],
    oemKm: null,
    oemMonths: null,
    highlightOverOem: true,
    useSavedRows: false,
  };
}

function clampOemKm(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < 3_000 || v > 40_000) return null;
  return v;
}

function clampOemMonths(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < 6 || v > 36) return null;
  return v;
}

export function normalizeOilIntervalChart(raw: unknown): OilIntervalChartState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const rowsIn = Array.isArray(o.rows) ? o.rows : [];
  const rows: OilIntervalChartRow[] = rowsIn
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const date = typeof r.date === "string" ? r.date.slice(0, 32) : "";
      const odometer = typeof r.odometer === "string" ? r.odometer.slice(0, 32) : "";
      const works = typeof r.works === "string" ? r.works.slice(0, 240) : "Eļļas maiņa";
      const id = typeof r.id === "string" && r.id.trim() ? r.id.slice(0, 48) : newOilIntervalRowId();
      if (!date.trim() && !odometer.trim() && !works.trim()) return null;
      return { id, date, odometer, works: works.trim() || "Eļļas maiņa" };
    })
    .filter((r): r is OilIntervalChartRow => r != null);
  const oemKm = clampOemKm(typeof o.oemKm === "number" ? o.oemKm : null);
  const oemMonths = clampOemMonths(typeof o.oemMonths === "number" ? o.oemMonths : null);
  const highlightOverOem = o.highlightOverOem !== false;
  const useSavedRows = o.useSavedRows === true;
  if (
    rows.length === 0 &&
    oemKm == null &&
    oemMonths == null &&
    highlightOverOem &&
    !useSavedRows
  ) {
    return undefined;
  }
  return { rows, oemKm, oemMonths, highlightOverOem, useSavedRows };
}

/** Tās pašas rindas kā `dealerOilIntervalSourceRows` client-report-html. */
export function dealerOilIntervalSourceRows(b: AutoRecordsBlockState): AutoRecordsServiceWorkRow[] {
  const original = oneautoDisplayToServiceWorks({
    equipment: [],
    powertrain: [],
    serviceTimeline: b.oneautoIngest?.serviceTimelineOriginal ?? [],
  });
  const log = getAutoRecordsOutvinBundle(b)
    .dealerServiceLog.filter(outvinDealerServiceRowHasData)
    .map((r) => ({
      date: r.date,
      odometer: r.odometer,
      location: r.country,
      works: r.serviceNotes,
    }));
  return [...(b.serviceWorks ?? []), ...original, ...log];
}

export function oilRowsFromServiceWorks(block: AutoRecordsBlockState): OilIntervalChartRow[] {
  return collectEngineOilChangeRows(dealerOilIntervalSourceRows(block)).map((r) => ({
    id: newOilIntervalRowId(),
    date: r.date,
    odometer: r.odometer,
    works: r.works.trim() || "Eļļas maiņa",
  }));
}

export function chartRowsToServiceWorks(rows: OilIntervalChartRow[]): AutoRecordsServiceWorkRow[] {
  return rows
    .filter((r) => r.date.trim() || r.odometer.trim())
    .map((r) => ({
      date: r.date.trim(),
      odometer: r.odometer.trim(),
      location: "",
      works: r.works.trim() || "Eļļas maiņa",
    }));
}

export function resolveOilIntervalChartRows(block: AutoRecordsBlockState): OilIntervalChartRow[] {
  const chart = block.oilIntervalChart;
  if (chart?.useSavedRows && chart.rows.length > 0) {
    return chart.rows;
  }
  const imported = oilRowsFromServiceWorks(block);
  return imported;
}

export function oemFallbackText(block: AutoRecordsBlockState): string {
  return `${block.oilChangeIntervalNotes ?? ""}\n${block.comments ?? ""}\n${block.serviceHistoryNotes ?? ""}`;
}

export function resolveOilIntervalOem(block: AutoRecordsBlockState): OemOilInterval | null {
  const chart = block.oilIntervalChart;
  if (chart?.oemKm != null) {
    return {
      km: chart.oemKm,
      kmMin: null,
      months: chart.oemMonths,
    };
  }
  return parseOemOilIntervalFromText(oemFallbackText(block));
}

export function withOilIntervalHighlight(
  series: OilChangeIntervalSeries,
  highlightOverOem: boolean,
): OilChangeIntervalSeries {
  if (highlightOverOem) return series;
  return {
    ...series,
    points: series.points.map((p) => ({
      ...p,
      tone: p.tone === "stretch" ? "ok" : p.tone,
      periodTone: p.periodTone === "stretch" ? "ok" : p.periodTone,
    })),
  };
}

export function buildOilIntervalSeriesForBlock(
  block: AutoRecordsBlockState,
): OilChangeIntervalSeries {
  const chart = block.oilIntervalChart;
  const rows = chartRowsToServiceWorks(resolveOilIntervalChartRows(block));
  const oem = resolveOilIntervalOem(block);
  const series = buildOilChangeIntervalSeries(rows, oem);
  return withOilIntervalHighlight(series, chart?.highlightOverOem !== false);
}
