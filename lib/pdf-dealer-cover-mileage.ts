/**
 * Dīlera vāka nobraukuma grafiks (06.11.2026 Dizaineris kanons):
 * kumulatīvā monotone cubic līkne + nobraukums pa kalendāra gadiem.
 * Nav `unified-mileage-chart` (tur ir cita līkne).
 */
import type { AutoRecordsServiceRow } from "@/lib/auto-records-paste-parse";
import {
  autoRecordsMileageRowHasData,
  formatAutoRecordsDateForOutput,
} from "@/lib/auto-records-paste-parse";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { formatServiceWorkOdometer } from "@/lib/auto-records-service-works";
import { PDF_BRAND_BLUE_HEX } from "@/lib/client-report-pdf-layout-draft";
import { translateClientReportStatic, type ClientReportLang } from "@/lib/client-report-i18n";
import {
  buildPdfFirstLastReadingSpanHtml,
  printableDealerServiceWorks,
} from "@/lib/pdf-dealer-service-visits";
import {
  analyzeUnifiedMileageAnomalies,
  parseMileageDateForSort,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";
import { monotoneCubicSvgPath } from "@/lib/unified-mileage-chart";

const MS_DAY = 86_400_000;
const PLOT_X0 = 48;
const PLOT_X1 = 704;
const PLOT_W = PLOT_X1 - PLOT_X0;
const CURVE_Y0 = 162;
const CURVE_Y1 = 24;
const CURVE_H = CURVE_Y0 - CURVE_Y1;
const BAR_BASE_Y = 300;
const BAR_H = 82;
const BAR_HEADING_Y = 191;
const VIEW_W = 720;
const VIEW_H_FULL = 340;
const VIEW_H_CURVE = 190;
const LINE_WIDTH = 2.05;
const BRAND = PDF_BRAND_BLUE_HEX;

export type DealerCoverMileagePoint = {
  day: number;
  ms: number;
  km: number;
  dateDisplay: string;
};

export type DealerCoverYearlyFlag = "precise" | "estimate" | "partial";

export type DealerCoverYearlyRow = {
  year: number;
  km: number;
  kmUnrounded: number;
  flag: DealerCoverYearlyFlag;
  readings: number;
  startMs: number;
  endMs: number;
  boundaryStartUncertain: boolean;
  boundaryEndUncertain: boolean;
};

export type DealerCoverMileageSeries = {
  precise: DealerCoverMileagePoint[];
  excludedCount: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function t(lv: string, lang: ClientReportLang): string {
  return translateClientReportStatic(lv, lang);
}

function pointTimeMs(date: string): number | null {
  const raw = date.trim();
  if (!raw) return null;
  const sorted = parseMileageDateForSort(raw);
  if (sorted !== Number.NEGATIVE_INFINITY) return sorted;
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) return Date.UTC(Number(yearOnly[1]), 0, 1);
  return null;
}

/** Vāka punkti: arī 0-99 km (pirmā reģistrācija), pretēji `parseOdometerKm` (≥100). */
export function parseDealerCoverOdometerKm(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function utcDay(ms: number): number {
  return Math.floor(ms / MS_DAY);
}

function yearOfDay(day: number): number {
  return new Date(day * MS_DAY).getUTCFullYear();
}

function yearStartDay(year: number): number {
  return utcDay(Date.UTC(year, 0, 1));
}

function toCoverPoint(date: string, odometer: string): DealerCoverMileagePoint | null {
  const ms = pointTimeMs(date);
  const km = parseDealerCoverOdometerKm(odometer);
  if (ms == null || km == null) return null;
  const dateDisplay = formatAutoRecordsDateForOutput(date) || date.trim();
  return { day: utcDay(ms), ms, km, dateDisplay };
}

function sortCoverPoints(points: DealerCoverMileagePoint[]): DealerCoverMileagePoint[] {
  return [...points].sort((a, b) => (a.day !== b.day ? a.day - b.day : a.km - b.km));
}

export function collectDealerCoverMileagePoints(
  serviceWorks: AutoRecordsServiceWorkRow[],
  mileageRows?: AutoRecordsServiceRow[] | null,
): DealerCoverMileagePoint[] {
  const fromHistory = (mileageRows ?? [])
    .filter(autoRecordsMileageRowHasData)
    .map((row) => toCoverPoint(row.date, row.odometer))
    .filter((p): p is DealerCoverMileagePoint => p != null);
  if (fromHistory.length > 0) return sortCoverPoints(fromHistory);

  return sortCoverPoints(
    printableDealerServiceWorks(serviceWorks, { includeKmOnly: true })
      .map((row) => toCoverPoint(row.date, row.odometer))
      .filter((p): p is DealerCoverMileagePoint => p != null),
  );
}

/**
 * Mākslīgie kritumi / adatas - ārā no līknes, nav viltojums.
 * Tā pati `analyzeUnifiedMileageAnomalies` filtrēšana kā pārējā atskaitē.
 */
export function filterDealerCoverPrecisePoints(
  points: DealerCoverMileagePoint[],
): DealerCoverMileageSeries {
  if (points.length === 0) return { precise: [], excludedCount: 0 };
  const rows: UnifiedMileageRow[] = points.map((p, i) => ({
    date: p.dateDisplay,
    odometer: String(p.km),
    country: "",
    sortableTime: p.ms,
    sourceOrder: i,
    sourceLabel: "OFICIĀLĀ DĪLERA DATI",
  }));
  const { chartExcludeSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
  const precise = points.filter((_, i) => !chartExcludeSourceOrders.has(i));
  return { precise, excludedCount: chartExcludeSourceOrders.size };
}

function bisectRightDay(days: number[], day: number): number {
  let lo = 0;
  let hi = days.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (days[mid]! <= day) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Lineāra interpolācija starp tuvākajiem precīzajiem ierakstiem.
 * Precīza robeža ņem pēdējo rādījumu tajā dienā. Robeža ir neskaidra, ja
 * iekļaujošie ieraksti izlaiž kalendāra gadu (`year[j] - year[i] > 1`).
 */
export function interpolateDealerCoverBoundary(
  points: DealerCoverMileagePoint[],
  day: number,
): { km: number; uncertain: boolean } {
  const days = points.map((p) => p.day);
  const i = bisectRightDay(days, day) - 1;
  const cur = points[i]!;
  if (cur.day === day) return { km: cur.km, uncertain: false };
  const next = points[i + 1]!;
  const span = next.day - cur.day;
  const km = span === 0 ? next.km : cur.km + ((next.km - cur.km) * (day - cur.day)) / span;
  return { km, uncertain: yearOfDay(next.day) - yearOfDay(cur.day) > 1 };
}

export function computeDealerCoverYearlyMileage(
  points: DealerCoverMileagePoint[],
): DealerCoverYearlyRow[] {
  if (points.length < 2) return [];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const y0 = yearOfDay(first.day);
  const y1 = yearOfDay(last.day);
  const rows: DealerCoverYearlyRow[] = [];
  for (let year = y0; year <= y1; year++) {
    const calendarStart = yearStartDay(year);
    const calendarEnd = yearStartDay(year + 1);
    const start = Math.max(first.day, calendarStart);
    const end = Math.min(last.day, calendarEnd);
    if (end <= start) continue;
    const a = interpolateDealerCoverBoundary(points, start);
    const b = interpolateDealerCoverBoundary(points, end);
    const readings = points.reduce((n, p) => n + (yearOfDay(p.day) === year ? 1 : 0), 0);
    const incomplete = start > calendarStart || end < calendarEnd;
    const flag: DealerCoverYearlyFlag = incomplete
      ? "partial"
      : !readings || a.uncertain || b.uncertain
        ? "estimate"
        : "precise";
    const kmUnrounded = b.km - a.km;
    rows.push({
      year,
      km: Math.round(kmUnrounded),
      kmUnrounded,
      flag,
      readings,
      startMs: start * MS_DAY,
      endMs: end * MS_DAY,
      boundaryStartUncertain: a.uncertain,
      boundaryEndUncertain: b.uncertain,
    });
  }
  return rows;
}

function niceAxis(maxValue: number, targetSteps: number): { max: number; step: number } {
  const minMax = Math.max(maxValue, 1);
  const raw = minMax / targetSteps;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 8 ? 8 : 10;
  let step = nice * pow;
  let max = step * targetSteps;
  if (max < minMax) {
    step *= 1.25;
    max = step * targetSteps;
  }
  if (max < minMax) {
    step = nice * pow * 2;
    max = step * targetSteps;
  }
  return { max, step };
}

function formatThousandsLabel(km: number): string {
  const thousands = km / 1000;
  if (Number.isInteger(thousands)) return String(thousands);
  return String(Number(thousands.toFixed(1)));
}

function formatKmPlain(km: number): string {
  return Math.round(km)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function readingCountLabel(n: number, lang: ClientReportLang): string {
  return n === 1
    ? t("1 ieraksts", lang)
    : t("{n} ieraksti", lang).replace("{n}", String(n));
}

function preciseCountLabel(n: number, lang: ClientReportLang): string {
  return n === 1
    ? t("1 precīzs ieraksts", lang)
    : t("{n} precīzi ieraksti", lang).replace("{n}", String(n));
}

function xOf(day: number, d0: number, d1: number): number {
  if (d1 === d0) return (PLOT_X0 + PLOT_X1) / 2;
  return PLOT_X0 + ((day - d0) / (d1 - d0)) * PLOT_W;
}

function jewelHtml(x: number, y: number, end: boolean): string {
  const halo = end ? 5.6 : 3.7;
  const disk = end ? 3.5 : 2.25;
  const core = end ? 2.5 : 1.55;
  const cx = x.toFixed(1);
  const cy = y.toFixed(1);
  return `<circle cx="${cx}" cy="${cy}" r="${halo}" fill="${BRAND}" fill-opacity="0.15"/><circle cx="${cx}" cy="${cy}" r="${disk}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${core}" fill="${BRAND}"/>`;
}

function barStyle(flag: DealerCoverYearlyFlag): string {
  if (flag === "precise") return `fill="${BRAND}" fill-opacity=".78"`;
  if (flag === "estimate") {
    return `fill="url(#pdfDealerCoverEstYear)" stroke="${BRAND}" stroke-opacity=".38" stroke-width=".8"`;
  }
  return `fill="${BRAND}" fill-opacity=".06" stroke="${BRAND}" stroke-opacity=".6" stroke-width="1"`;
}

function barPath(xx: number, w: number, yy: number): string {
  const h = BAR_BASE_Y - yy;
  const rad = Math.min(2, w / 2, Math.max(h / 2, 0));
  return `M ${xx.toFixed(2)} ${BAR_BASE_Y} V ${(yy + rad).toFixed(2)} Q ${xx.toFixed(2)} ${yy.toFixed(2)} ${(xx + rad).toFixed(2)} ${yy.toFixed(2)} H ${(xx + w - rad).toFixed(2)} Q ${(xx + w).toFixed(2)} ${yy.toFixed(2)} ${(xx + w).toFixed(2)} ${(yy + rad).toFixed(2)} V ${BAR_BASE_Y} Z`;
}

function excludedNote(count: number, lang: ClientReportLang): string {
  if (count <= 0) return "";
  const head =
    count === 1
      ? t("1 ieraksts ar mākslīgu kritumu grafikā nav rādīts - tāpat kā esošajā atskaitē.", lang)
      : t("{n} ieraksti ar mākslīgu kritumu grafikā nav rādīti - tāpat kā esošajā atskaitē.", lang).replace(
          "{n}",
          String(count),
        );
  return head;
}

function yearlyNote(
  first: DealerCoverMileagePoint,
  last: DealerCoverMileagePoint,
  excludedCount: number,
  lang: ClientReportLang,
): string {
  const firstYear = yearOfDay(first.day);
  const lastYear = yearOfDay(last.day);
  const base = t(
    "Gadu robežās nobraukums interpolēts lineāri starp tuvākajiem precīzajiem ierakstiem. Svītrotie stabiņi: aptuvens vairāku gadu intervāla sadalījums, nevis precīzs gada nobraukums. {y0}: no {d0}; {y1}: līdz {d1} - bez pārrēķina uz pilnu gadu.",
    lang,
  )
    .replace("{y0}", String(firstYear))
    .replace("{d0}", first.dateDisplay)
    .replace("{y1}", String(lastYear))
    .replace("{d1}", last.dateDisplay);
  const extra = excludedNote(excludedCount, lang);
  return extra ? `${base} ${extra}` : base;
}

function legendHtml(lang: ClientReportLang): string {
  return `<div class="pdf-dealer-cover-leg">
    <span><b></b>${escapeHtml(t("precīzs ieraksts", lang))}</span>
    <span><i></i>${escapeHtml(t("nepārtraukta līnija savieno precīzos ierakstus", lang))}</span>
    <span><em class="pdf-dealer-cover-bar-key"></em>${escapeHtml(t("precīzs gada nobraukums", lang))}</span>
    <span><em class="pdf-dealer-cover-bar-key pdf-dealer-cover-bar-key--estimated"></em>${escapeHtml(t("aptuveni (nav precīzu datu)", lang))}</span>
    <span><em class="pdf-dealer-cover-bar-key pdf-dealer-cover-bar-key--partial"></em>${escapeHtml(t("nepilns gads", lang))}</span>
  </div>`;
}

export function buildDealerCoverMileageChartHtml(
  series: DealerCoverMileageSeries,
  lang: ClientReportLang = "lv",
): string {
  const pts = series.precise;
  if (pts.length === 0) return "";

  const d0 = pts[0]!.day;
  const d1 = pts[pts.length - 1]!.day;
  const kmMaxData = Math.max(...pts.map((p) => p.km), 0);
  const curveAxis = niceAxis(kmMaxData, 4);
  const showLine = pts.length >= 2;
  const years = showLine ? computeDealerCoverYearlyMileage(pts) : [];
  const showBars = years.length > 0;
  const viewH = showBars ? VIEW_H_FULL : VIEW_H_CURVE;

  const xy = pts.map((p) => ({
    x: xOf(p.day, d0, d1),
    y: CURVE_Y0 - (p.km / curveAxis.max) * CURVE_H,
  }));

  const grid: string[] = [];
  for (let v = 0; v <= curveAxis.max + curveAxis.step / 2; v += curveAxis.step) {
    const y = CURVE_Y0 - (v / curveAxis.max) * CURVE_H;
    const zero = v === 0;
    const dash = zero ? "" : ` stroke-dasharray="2 4"`;
    const op = zero ? "0.14" : "0.07";
    grid.push(
      `<line x1="${PLOT_X0}" x2="${PLOT_X1}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#0f172a" stroke-opacity="${op}"${dash}/>`,
      `<text x="40" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="pdf-dealer-cover-ax">${escapeHtml(formatThousandsLabel(v))}</text>`,
    );
  }

  const pathD = showLine ? monotoneCubicSvgPath(xy) : "";
  const pathHtml = pathD
    ? `<path class="pdf-dealer-cover-curve-path" d="${pathD}" fill="none" stroke="${BRAND}" stroke-width="${LINE_WIDTH}" stroke-linecap="round"/>`
    : "";

  const jewels = xy
    .map((p, i) => jewelHtml(p.x, p.y, i === 0 || i === xy.length - 1))
    .join("");

  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const firstPt = xy[0]!;
  const lastPt = xy[xy.length - 1]!;
  const kmLabels =
    pts.length === 1
      ? `<text x="${(firstPt.x + 10).toFixed(1)}" y="${(firstPt.y - 10).toFixed(1)}" class="pdf-dealer-cover-pl">${escapeHtml(formatKmPlain(first.km))}</text>`
      : `<text x="${(firstPt.x + 10).toFixed(1)}" y="${(firstPt.y - 10).toFixed(1)}" class="pdf-dealer-cover-pl">${escapeHtml(formatKmPlain(first.km))}</text><text x="${(lastPt.x - 10).toFixed(1)}" y="${Math.min(lastPt.y - 12, 18.4).toFixed(1)}" text-anchor="end" class="pdf-dealer-cover-pl">${escapeHtml(formatKmPlain(last.km))}</text>`;

  let barsHtml = "";
  if (showBars) {
    const yearMax = Math.max(...years.map((r) => r.kmUnrounded), 1);
    const barAxis = niceAxis(yearMax, 3);
    const yBar = (km: number) => BAR_BASE_Y - (km / barAxis.max) * BAR_H;
    const barGrid: string[] = [];
    for (let v = 0; v <= barAxis.max + barAxis.step / 2; v += barAxis.step) {
      const y = yBar(v);
      const op = v === 0 ? "0.14" : "0.065";
      barGrid.push(
        `<line x1="${PLOT_X0}" x2="${PLOT_X1}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#0f172a" stroke-opacity="${op}"/>`,
        `<text x="40" y="${(y + 3.5).toFixed(2)}" text-anchor="end" class="pdf-dealer-cover-ax">${escapeHtml(formatThousandsLabel(v))}</text>`,
      );
    }
    const barShapes: string[] = [];
    for (const row of years) {
      const xa = xOf(utcDay(row.startMs), d0, d1);
      const xb = xOf(utcDay(row.endMs), d0, d1);
      const gap = xb - xa;
      const inset = gap > 12 ? 6 : Math.max(0.5, gap / 4);
      const xx = xa + inset;
      const w = Math.max(1, xb - xa - inset * 2);
      const yy = yBar(Math.max(0, row.kmUnrounded));
      barShapes.push(
        `<path data-year="${row.year}" data-status="${row.flag}" d="${barPath(xx, w, yy)}" ${barStyle(row.flag)}/>`,
        `<line x1="${xa.toFixed(2)}" x2="${xa.toFixed(2)}" y1="${BAR_BASE_Y}" y2="${BAR_BASE_Y + 4}" stroke="#94a3b8"/>`,
        `<text x="${((xa + xb) / 2).toFixed(2)}" y="319" text-anchor="middle" class="pdf-dealer-cover-year">${row.year}</text>`,
      );
      if (row.flag === "partial") {
        barShapes.push(
          `<text x="${((xa + xb) / 2).toFixed(2)}" y="331" text-anchor="middle" class="pdf-dealer-cover-partial">${escapeHtml(t("nepilns", lang))}</text>`,
        );
      }
    }
    barsHtml = `<text x="${PLOT_X0}" y="${BAR_HEADING_Y}" class="pdf-dealer-cover-year-heading">${escapeHtml(t("NOBRAUKUMS PA GADIEM", lang))}</text><text x="${PLOT_X1}" y="${BAR_HEADING_Y}" class="pdf-dealer-cover-ax" text-anchor="end">${escapeHtml(t("tūkst. km gadā", lang))}</text>${barGrid.join("")}${barShapes.join("")}`;
  }

  const aria = escapeHtml(t("Nobraukuma vēsture un nobraukums pa kalendāra gadiem", lang));
  const svg = `<svg class="pdf-dealer-cover-curve" viewBox="0 0 ${VIEW_W} ${viewH}" role="img" aria-label="${aria}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="pdfDealerCoverEstYear" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="5" height="5" fill="${BRAND}" fill-opacity=".035"/>
        <line x1="0" x2="0" y1="0" y2="5" stroke="${BRAND}" stroke-opacity=".35" stroke-width="1.4"/>
      </pattern>
    </defs>
    <text x="2" y="12" class="pdf-dealer-cover-ax">${escapeHtml(t("tūkst. km", lang))}</text>
    ${grid.join("")}
    ${pathHtml}
    ${jewels}
    ${kmLabels}
    ${barsHtml}
  </svg>`;

  const heading = `<div class="pdf-dealer-cover__lbl">${escapeHtml(t("Nobraukums", lang))} · ${escapeHtml(preciseCountLabel(pts.length, lang))}</div>`;
  const span =
    pts.length >= 2
      ? buildPdfFirstLastReadingSpanHtml({
          firstKm: formatServiceWorkOdometer(String(first.km)),
          lastKm: formatServiceWorkOdometer(String(last.km)),
          firstMeta: first.dateDisplay,
          lastMeta: [last.dateDisplay, readingCountLabel(pts.length, lang)].filter(Boolean).join(" · "),
        })
      : "";
  const note =
    pts.length >= 2
      ? `<div class="pdf-dealer-cover-note">${escapeHtml(yearlyNote(first, last, series.excludedCount, lang))}</div>`
      : series.excludedCount > 0
        ? `<div class="pdf-dealer-cover-note">${escapeHtml(excludedNote(series.excludedCount, lang))}</div>`
        : "";
  const legend = showLine ? legendHtml(lang) : "";

  return `${heading}${svg}${legend}${span}${note}`;
}
