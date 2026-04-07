/**
 * PDF / UI — nobraukuma līknes SVG (zila līnija; anomāliju punkti sarkani).
 */

import { sortMileageChronological, parseOdometerKm, type UnifiedMileageRow } from "@/lib/unified-mileage";

const PDF_MILEAGE_CHART_LINE = "#0061D2";
const PDF_MILEAGE_CHART_GRID = "#e8eaed";
const PDF_MILEAGE_CHART_AXIS = "#9ca3af";

function catmullRomSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y}`;
  }
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1]! : points[0]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = i + 2 < points.length ? points[i + 2]! : p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

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
      return { t: r.sortableTime, km, sourceOrder: r.sourceOrder };
    })
    .filter((x): x is { t: number; km: number; sourceOrder: number } => x != null);

  if (series.length === 0) return "";

  const tMin = series[0]!.t;
  const tMax = series[series.length - 1]!.t;
  let kmMin = Math.min(...series.map((s) => s.km));
  let kmMax = Math.max(...series.map((s) => s.km));
  if (kmMin === kmMax) {
    kmMin = Math.max(0, kmMin - 1);
    kmMax += 1;
  }
  const kmPad = (kmMax - kmMin) * 0.06;
  kmMin -= kmPad;
  kmMax += kmPad;

  const W = compact ? 480 : 520;
  const H = compact ? 86 : 132;
  const padL = 12;
  const padR = 12;
  const padT = compact ? 10 : 14;
  const padB = compact ? 22 : 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xOf = (t: number) => {
    if (tMax === tMin) return padL + plotW / 2;
    return padL + ((t - tMin) / (tMax - tMin)) * plotW;
  };
  const yOf = (km: number) => padT + plotH - ((km - kmMin) / (kmMax - kmMin)) * plotH;

  const pts = series.map((s) => ({
    x: xOf(s.t),
    y: yOf(s.km),
    sourceOrder: s.sourceOrder,
  }));
  const pathPts = pts.map((p) => ({ x: p.x, y: p.y }));
  const pathD = catmullRomSvgPath(pathPts);

  const yStart = new Date(tMin).getUTCFullYear();
  const yEnd = new Date(tMax).getUTCFullYear();
  const yearSpan = Math.max(0, yEnd - yStart);
  const yearStep = yearSpan <= 10 ? 1 : 2;
  const tickSet = new Set<number>();
  for (let y = yStart; y <= yEnd; y += yearStep) {
    tickSet.add(y);
  }
  tickSet.add(yEnd);
  const tickYears = [...tickSet].sort((a, b) => a - b);

  const gridLines: string[] = [];
  const yearLabels: string[] = [];
  for (const y of tickYears) {
    const tx = Date.UTC(y, 0, 1);
    let gx = xOf(tx);
    gx = Math.min(padL + plotW, Math.max(padL, gx));
    gridLines.push(
      `<line class="pdf-mileage-chart-grid" x1="${gx.toFixed(1)}" y1="${padT}" x2="${gx.toFixed(1)}" y2="${padT + plotH}" />`,
    );
    yearLabels.push(
      `<text class="pdf-mileage-chart-year" x="${gx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${y}</text>`,
    );
  }

  const dotR = series.length === 1 ? 4 : 3;
  const dots = pts
    .map((p) => {
      const anom = anomalyBySourceOrder.get(p.sourceOrder) === true;
      const cls = anom ? "pdf-mileage-chart-dot pdf-mileage-chart-dot--anomaly" : "pdf-mileage-chart-dot";
      return `<circle class="${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dotR}" />`;
    })
    .join("");

  const pathHtml =
    series.length === 1 ? "" : `<path class="pdf-mileage-chart-path" fill="none" d="${pathD}" />`;

  const svgInner = `
<svg class="pdf-mileage-chart-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Nobraukuma līkne pēc gada">
  ${gridLines.join("\n  ")}
  ${pathHtml}
  ${dots}
  ${yearLabels.join("\n  ")}
</svg>
<div class="pdf-mileage-chart-legend">
  <span class="pdf-mileage-chart-legend-line" aria-hidden="true"></span>
  <span class="pdf-mileage-chart-legend-text">Nobraukums</span>
</div>`.trim();

  const wrapCls = compact ? "pdf-mileage-chart-wrap pdf-mileage-chart-wrap--compact" : "pdf-mileage-chart-wrap";
  return `<div class="${wrapCls}">${svgInner}</div>`;
}

export { PDF_MILEAGE_CHART_LINE, PDF_MILEAGE_CHART_GRID, PDF_MILEAGE_CHART_AXIS };
