/**
 * PDF / UI — nobraukuma līknes SVG (plūdaina zila līnija pa reālajiem km).
 * Odometra kritums: taisns sarkans posms + gada josla (ne halo/punkts).
 * Teoretiskā korekcija (`reconstructTheoreticalMileagePath`) paliek vidējā gada nobraukumam, ne grafikam.
 */

import {
  analyzeUnifiedMileageAnomalies,
  sortMileageChronological,
  parseOdometerKm,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

import { PDF_BRAND_BLUE_HEX } from "@/lib/client-report-pdf-layout-draft";

const PDF_MILEAGE_CHART_LINE = PDF_BRAND_BLUE_HEX;
const PDF_MILEAGE_CHART_GRID = "#e8eaed";
const PDF_MILEAGE_CHART_AXIS = "#9ca3af";

/** Minimālā horizontālā atstarpe starp gada etiķetēm (px viewBox), lai „2016”/„2017” nepārklājas. */
const YEAR_LABEL_MIN_GAP_PX = 34;

type ChartXY = { x: number; y: number };

function linearSvgPath(points: ChartXY[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Fritsch–Carlson monotone cubic — līkne iet caur punktiem bez km pāršaušanas.
 * Divi punkti paliek taisni; viens punkts — tukšs path.
 */
export function monotoneCubicSvgPath(points: ChartXY[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) return linearSvgPath(points);

  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dxi = points[i + 1]!.x - points[i]!.x;
    const dyi = points[i + 1]!.y - points[i]!.y;
    dx.push(dxi);
    slope.push(Math.abs(dxi) < 1e-9 ? 0 : dyi / dxi);
  }

  const m: number[] = new Array(n);
  m[0] = slope[0]!;
  m[n - 1] = slope[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1]! * slope[i]! <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i]! + dx[i - 1]!;
      const w2 = dx[i]! + 2 * dx[i - 1]!;
      const den = w1 / slope[i - 1]! + w2 / slope[i]!;
      m[i] = den === 0 ? 0 : (w1 + w2) / den;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slope[i]!) < 1e-12) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / slope[i]!;
    const b = m[i + 1]! / slope[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i]!;
      m[i + 1] = t * b * slope[i]!;
    }
  }

  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const dxi = dx[i]!;
    if (Math.abs(dxi) < 1e-9) {
      d += ` L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
      continue;
    }
    const c1x = p0.x + dxi / 3;
    const c1y = p0.y + (m[i]! * dxi) / 3;
    const c2x = p1.x - dxi / 3;
    const c2y = p1.y - (m[i + 1]! * dxi) / 3;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

/** Zilās līknes gabali — pārtraukums pie anomālijas, lai kritums nebūtu nogludināts. */
export function splitMileageChartRuns(points: { x: number; y: number; isAnomaly: boolean }[]): ChartXY[][] {
  const runs: ChartXY[][] = [];
  let current: ChartXY[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (p.isAnomaly && i > 0) {
      if (current.length > 0) runs.push(current);
      current = [{ x: p.x, y: p.y }];
    } else {
      current.push({ x: p.x, y: p.y });
    }
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

/**
 * Gada X = kalendārā gada un datu diapazona `[tMin, tMax]` krustpunkta vidus.
 * Tādējādi etiķete nepaliek pie kreisās malas, ja dati sākas gada beigās.
 */
export function yearLabelXInRange(
  year: number,
  tMin: number,
  tMax: number,
  xOf: (time: number) => number,
  padL: number,
  plotW: number,
): number | null {
  const y0 = Date.UTC(year, 0, 1);
  const y1 = Date.UTC(year + 1, 0, 1);
  const from = Math.max(tMin, y0);
  const to = Math.min(tMax, y1);
  if (to < from) return null;
  const mid = from === to ? from : (from + to) / 2;
  const gx = xOf(mid);
  return Math.min(padL + plotW, Math.max(padL, gx));
}

/** Atstāj etiķetes ar min. atstarpi; vienmēr mēģina saglabāt pirmo un pēdējo gadu. */
export function pickNonOverlappingYearTicks(
  candidates: { year: number; x: number }[],
  minGapPx: number = YEAR_LABEL_MIN_GAP_PX,
): { year: number; x: number }[] {
  if (candidates.length <= 1) return candidates;
  const sorted = [...candidates].sort((a, b) => a.x - b.x || a.year - b.year);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (sorted.length === 2) {
    return last.x - first.x >= minGapPx ? sorted : [first];
  }

  const kept: { year: number; x: number }[] = [first];
  for (let i = 1; i < sorted.length - 1; i++) {
    const c = sorted[i]!;
    const prev = kept[kept.length - 1]!;
    if (c.x - prev.x < minGapPx) continue;
    if (last.x - c.x < minGapPx) continue;
    kept.push(c);
  }
  if (last.x - kept[kept.length - 1]!.x >= minGapPx || kept[kept.length - 1]!.year === last.year) {
    if (kept[kept.length - 1]!.year !== last.year) kept.push(last);
  } else if (kept.length > 1) {
    kept[kept.length - 1] = last;
  } else {
    kept.push(last);
  }
  return kept;
}

type ChartPlotPoint = {
  x: number;
  /** SVG Y no reālā odometra (km ↓ → Y ↑). */
  y: number;
  sourceOrder: number;
  isAnomaly: boolean;
};

/**
 * @param anomalyBySourceOrder — no `analyzeUnifiedMileageAnomalies` / `computeOdometerAnomalyBySourceOrder`
 */
export function buildUnifiedMileageChartWrapHtml(
  rows: UnifiedMileageRow[],
  anomalyBySourceOrder: Map<number, boolean>,
  opts?: { compact?: boolean; chartExcludeSourceOrders?: Set<number> },
): string {
  const compact = opts?.compact === true;
  const chartExclude =
    opts?.chartExcludeSourceOrders ?? analyzeUnifiedMileageAnomalies(rows).chartExcludeSourceOrders;
  const chrono = sortMileageChronological(rows);
  const series = chrono
    .map((r) => {
      if (chartExclude.has(r.sourceOrder)) return null;
      const km = parseOdometerKm(r.odometer);
      if (km == null || r.sortableTime === Number.NEGATIVE_INFINITY) return null;
      const display = r.date.trim();
      return {
        year: new Date(r.sortableTime).getUTCFullYear(),
        time: r.sortableTime,
        km,
        sourceOrder: r.sourceOrder,
        dateDisplay: display,
      };
    })
    .filter((x): x is { year: number; time: number; km: number; sourceOrder: number; dateDisplay: string } => x != null);

  if (series.length === 0) return "";

  const tMin = series[0]!.time;
  const tMax = series[series.length - 1]!.time;
  const yStart = series[0]!.year;
  const yEnd = series[series.length - 1]!.year;

  let kmMin = Number.POSITIVE_INFINITY;
  let kmMax = Number.NEGATIVE_INFINITY;
  for (const s of series) {
    kmMin = Math.min(kmMin, s.km);
    kmMax = Math.max(kmMax, s.km);
  }
  if (kmMin === kmMax) {
    kmMin = Math.max(0, kmMin - 1);
    kmMax += 1;
  }
  const kmPad = (kmMax - kmMin) * 0.06;
  kmMin -= kmPad;
  kmMax += kmPad;

  const W = compact ? 480 : 520;
  const H = compact ? 112 : 172;
  const padL = 12;
  const padR = 12;
  const padT = compact ? 10 : 14;
  const padB = compact ? 22 : 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xOf = (time: number) => {
    if (tMax === tMin) return padL + plotW / 2;
    return padL + ((time - tMin) / (tMax - tMin)) * plotW;
  };
  const yOf = (km: number) => padT + plotH - ((km - kmMin) / (kmMax - kmMin)) * plotH;

  const plotPoints: ChartPlotPoint[] = series.map((s) => ({
    x: xOf(s.time),
    y: yOf(s.km),
    sourceOrder: s.sourceOrder,
    isAnomaly: anomalyBySourceOrder.get(s.sourceOrder) === true,
  }));

  const hasAnomaly = plotPoints.some((p) => p.isAnomaly);

  const yearSpan = Math.max(0, yEnd - yStart);
  const yearStep = yearSpan <= 10 ? 1 : yearSpan <= 20 ? 2 : 3;
  const tickSet = new Set<number>();
  for (let y = yStart; y <= yEnd; y += yearStep) {
    tickSet.add(y);
  }
  tickSet.add(yEnd);
  const tickYears = [...tickSet].sort((a, b) => a - b);

  const candidates: { year: number; x: number }[] = [];
  for (const y of tickYears) {
    const gx = yearLabelXInRange(y, tMin, tMax, xOf, padL, plotW);
    if (gx == null) continue;
    candidates.push({ year: y, x: gx });
  }
  const placed = pickNonOverlappingYearTicks(candidates, compact ? 30 : YEAR_LABEL_MIN_GAP_PX);

  const gridLines: string[] = [];
  const yearLabels: string[] = [];
  for (const { year: y, x: gx } of placed) {
    gridLines.push(
      `<line class="pdf-mileage-chart-grid" x1="${gx.toFixed(1)}" y1="${padT}" x2="${gx.toFixed(1)}" y2="${padT + plotH}" />`,
    );
    yearLabels.push(
      `<text class="pdf-mileage-chart-year" x="${gx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${y}</text>`,
    );
  }

  const yearBands: string[] = [];
  const anomalyYears = new Set<number>();
  for (let i = 0; i < plotPoints.length; i++) {
    if (plotPoints[i]!.isAnomaly) anomalyYears.add(series[i]!.year);
  }
  for (const year of [...anomalyYears].sort((a, b) => a - b)) {
    const y0 = Date.UTC(year, 0, 1);
    const y1 = Date.UTC(year + 1, 0, 1);
    const from = Math.max(tMin, y0);
    const to = Math.min(tMax, y1);
    if (to < from) continue;
    const x1 = xOf(from);
    const x2 = xOf(to);
    const w = Math.max(x2 - x1, compact ? 8 : 10);
    yearBands.push(
      `<rect class="pdf-mileage-chart-year-band" x="${x1.toFixed(1)}" y="${padT}" width="${w.toFixed(1)}" height="${plotH}" />`,
    );
  }

  const rollbackOverlays: string[] = [];
  for (let i = 0; i < plotPoints.length; i++) {
    const p = plotPoints[i]!;
    if (!p.isAnomaly) continue;
    const prev = i > 0 ? plotPoints[i - 1]! : null;
    if (prev) {
      rollbackOverlays.push(
        `<line class="pdf-mileage-chart-rollback" x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" />`,
      );
    }
  }

  const pathHtml = splitMileageChartRuns(plotPoints)
    .map((run) => monotoneCubicSvgPath(run))
    .filter((d) => d.length > 0)
    .map((d) => `<path class="pdf-mileage-chart-path" fill="none" d="${d}" />`)
    .join("\n  ");

  const loneDot =
    series.length === 1
      ? `<circle class="pdf-mileage-chart-dot" cx="${plotPoints[0]!.x.toFixed(1)}" cy="${plotPoints[0]!.y.toFixed(1)}" r="4" />`
      : "";

  const legendAnomaly = hasAnomaly
    ? `<span class="pdf-mileage-chart-legend-anomaly" aria-hidden="true"><span class="pdf-mileage-chart-legend-rollback"></span><span class="pdf-mileage-chart-legend-text">Odometra anomālija</span></span>`
    : "";

  const svgInner = `
<svg class="pdf-mileage-chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nobraukuma līkne pēc gada">
  ${yearBands.join("\n  ")}
  ${gridLines.join("\n  ")}
  ${pathHtml}
  ${rollbackOverlays.join("\n  ")}
  ${loneDot}
  ${yearLabels.join("\n  ")}
</svg>
<div class="pdf-mileage-chart-legend">
  <span class="pdf-mileage-chart-legend-line" aria-hidden="true"></span>
  <span class="pdf-mileage-chart-legend-text">Nobraukums</span>
  ${legendAnomaly}
</div>`.trim();

  const wrapCls = compact ? "pdf-mileage-chart-wrap pdf-mileage-chart-wrap--compact" : "pdf-mileage-chart-wrap";
  const anomalyCls = hasAnomaly ? " pdf-mileage-chart-wrap--has-anomaly" : "";
  return `<div class="${wrapCls}${anomalyCls}">${svgInner}</div>`;
}

export { PDF_MILEAGE_CHART_LINE, PDF_MILEAGE_CHART_GRID, PDF_MILEAGE_CHART_AXIS };
