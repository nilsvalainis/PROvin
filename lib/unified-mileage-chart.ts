/**
 * PDF / UI — nobraukuma līknes SVG (zila līnija; anomāliju punkti sarkani).
 */

import { reconstructTheoreticalMileagePath } from "@/lib/average-annual-mileage";
import { sortMileageChronological, parseOdometerKm, type UnifiedMileageRow } from "@/lib/unified-mileage";

import { PDF_BRAND_BLUE_HEX } from "@/lib/client-report-pdf-layout-draft";

const PDF_MILEAGE_CHART_LINE = PDF_BRAND_BLUE_HEX;
const PDF_MILEAGE_CHART_GRID = "#e8eaed";
const PDF_MILEAGE_CHART_AXIS = "#9ca3af";

/** Minimālā horizontālā atstarpe starp gada etiķetēm (px viewBox), lai „2016”/„2017” nepārklājas. */
const YEAR_LABEL_MIN_GAP_PX = 34;

function linearSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
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
  yTrend: number;
  yRaw: number;
  sourceOrder: number;
  isAnomaly: boolean;
};

/**
 * @param anomalyBySourceOrder — no `computeOdometerAnomalyBySourceOrder`
 */
export function buildUnifiedMileageChartWrapHtml(
  rows: UnifiedMileageRow[],
  anomalyBySourceOrder: Map<number, boolean>,
  opts?: { compact?: boolean },
): string {
  const compact = opts?.compact === true;
  const chrono = sortMileageChronological(rows);
  const series = chrono
    .map((r) => {
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

  const { path: theoreticalPath, correctedForAnomaly } = reconstructTheoreticalMileagePath(
    series.map((s) => ({ t: s.time, km: s.km, dateDisplay: s.dateDisplay, country: "" })),
  );

  const tMin = series[0]!.time;
  const tMax = series[series.length - 1]!.time;
  const yStart = series[0]!.year;
  const yEnd = series[series.length - 1]!.year;

  let kmMin = Number.POSITIVE_INFINITY;
  let kmMax = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < series.length; i++) {
    const raw = series[i]!.km;
    const theoretical = theoreticalPath[i]?.theoreticalKm ?? raw;
    kmMin = Math.min(kmMin, raw, theoretical);
    kmMax = Math.max(kmMax, raw, theoretical);
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

  const plotPoints: ChartPlotPoint[] = series.map((s, i) => {
    const theoretical = theoreticalPath[i]?.theoreticalKm ?? s.km;
    const trendKm = correctedForAnomaly ? theoretical : s.km;
    return {
      x: xOf(s.time),
      yTrend: yOf(trendKm),
      yRaw: yOf(s.km),
      sourceOrder: s.sourceOrder,
      isAnomaly: anomalyBySourceOrder.get(s.sourceOrder) === true,
    };
  });

  const pathPts = plotPoints.map((p) => ({ x: p.x, y: p.yTrend }));
  const pathD = linearSvgPath(pathPts);
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

  const rollbackOverlays: string[] = [];
  const anomalyMarkers: string[] = [];
  for (let i = 0; i < plotPoints.length; i++) {
    const p = plotPoints[i]!;
    if (!p.isAnomaly) continue;
    const prev = i > 0 ? plotPoints[i - 1]! : null;
    if (prev) {
      rollbackOverlays.push(
        `<line class="pdf-mileage-chart-rollback" x1="${prev.x.toFixed(1)}" y1="${prev.yRaw.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.yRaw.toFixed(1)}" />`,
      );
    }
    const haloR = compact ? 10 : 11;
    const dotR = compact ? 5.5 : 6;
    anomalyMarkers.push(
      `<line class="pdf-mileage-chart-anomaly-pin" x1="${p.x.toFixed(1)}" y1="${(p.yRaw + haloR + 2).toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${(padT + plotH).toFixed(1)}" />`,
      `<circle class="pdf-mileage-chart-anomaly-halo" cx="${p.x.toFixed(1)}" cy="${p.yRaw.toFixed(1)}" r="${haloR}" />`,
      `<circle class="pdf-mileage-chart-dot pdf-mileage-chart-dot--anomaly" cx="${p.x.toFixed(1)}" cy="${p.yRaw.toFixed(1)}" r="${dotR}" />`,
    );
  }

  const dotR = series.length === 1 ? 4 : 3;
  const maxNormalDots = compact ? 6 : 7;
  const visibleDotSourceOrders = new Set<number>();
  if (hasAnomaly || plotPoints.length <= maxNormalDots) {
    for (const p of plotPoints) visibleDotSourceOrders.add(p.sourceOrder);
  } else {
    visibleDotSourceOrders.add(plotPoints[0]!.sourceOrder);
    visibleDotSourceOrders.add(plotPoints[plotPoints.length - 1]!.sourceOrder);
    const midSlots = Math.max(0, maxNormalDots - 2);
    for (let i = 1; i <= midSlots; i++) {
      const idx = Math.round((i * (plotPoints.length - 1)) / (midSlots + 1));
      visibleDotSourceOrders.add(plotPoints[idx]!.sourceOrder);
    }
  }
  for (const p of plotPoints) {
    if (p.isAnomaly) visibleDotSourceOrders.add(p.sourceOrder);
  }

  const normalDots = plotPoints
    .filter((p) => visibleDotSourceOrders.has(p.sourceOrder) && !p.isAnomaly)
    .map((p) => {
      return `<circle class="pdf-mileage-chart-dot" cx="${p.x.toFixed(1)}" cy="${p.yTrend.toFixed(1)}" r="${dotR}" />`;
    })
    .join("");

  const pathHtml =
    series.length === 1 ? "" : `<path class="pdf-mileage-chart-path" fill="none" d="${pathD}" />`;

  const legendAnomaly = hasAnomaly
    ? `<span class="pdf-mileage-chart-legend-anomaly" aria-hidden="true"><span class="pdf-mileage-chart-legend-anomaly-dot"></span><span class="pdf-mileage-chart-legend-text">Odometra anomālija</span></span>`
    : "";

  const svgInner = `
<svg class="pdf-mileage-chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nobraukuma līkne pēc gada">
  ${gridLines.join("\n  ")}
  ${rollbackOverlays.join("\n  ")}
  ${pathHtml}
  ${normalDots}
  ${anomalyMarkers.join("\n  ")}
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
