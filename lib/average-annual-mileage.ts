/**
 * Gada vidējais nobraukums no apkopotajiem odometra ierakstiem.
 * 1) pirmā–pēdējā rādījuma starpība / gadi;
 * 2) intervālu gada likmju aritmētiskais vidējais;
 * 3) jaunākais km / gadi kopš pirmās reģistrācijas.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import {
  collectUnifiedMileageRows,
  filterDuplicateOdometerKmReadings,
  parseMileageDateForSort,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";

export type AverageAnnualMileageMethod = "span" | "interval_mean" | "first_registration";

export type AverageAnnualMileageResult = {
  kmPerYear: number;
  method: AverageAnnualMileageMethod;
  sentence: string;
};

type MileagePoint = { t: number; km: number };

function parseKmLoose(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 0 || n > 2_000_000) return null;
  return n;
}

function pointsFromRows(rows: UnifiedMileageRow[]): MileagePoint[] {
  const out: MileagePoint[] = [];
  for (const r of rows) {
    if (r.sortableTime === Number.NEGATIVE_INFINITY) continue;
    const km = parseKmLoose(r.odometer);
    if (km === null) continue;
    out.push({ t: r.sortableTime, km });
  }
  out.sort((a, b) => (a.t !== b.t ? a.t - b.t : a.km - b.km));
  const deduped: MileagePoint[] = [];
  for (const p of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.t === p.t && prev.km === p.km) continue;
    deduped.push(p);
  }
  return deduped;
}

function yearsBetweenMs(fromMs: number, toMs: number): number {
  return Math.max(0, (toMs - fromMs) / (365.25 * 86_400_000));
}

function formatKmLv(n: number): string {
  return Math.round(n).toLocaleString("lv-LV");
}

function sentenceFor(kmPerYear: number): string {
  return `Saskaņā ar mūsu rīcībā esošajiem datiem transportlīdzekļa vidējais gada nobraukums ir aptuveni ${formatKmLv(kmPerYear)} km.`;
}

/** Primārā metode: (pēdējais − pirmais km) / gadi starp datumiem. */
function fromSpan(points: MileagePoint[]): AverageAnnualMileageResult | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const years = yearsBetweenMs(first.t, last.t);
  if (years < 30 / 365.25) return null;
  const dKm = last.km - first.km;
  if (dKm <= 0) return null;
  const kmPerYear = Math.round(dKm / years);
  if (kmPerYear < 1 || kmPerYear > 150_000) return null;
  return { kmPerYear, method: "span", sentence: sentenceFor(kmPerYear) };
}

/** Rezerves: aritmētiskais vidējais no intervālu gada likmēm. */
function fromIntervalMean(points: MileagePoint[]): AverageAnnualMileageResult | null {
  if (points.length < 2) return null;
  const rates: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const years = yearsBetweenMs(a.t, b.t);
    const dKm = b.km - a.km;
    if (years < 14 / 365.25 || dKm <= 0) continue;
    const rate = dKm / years;
    if (rate >= 1 && rate <= 150_000) rates.push(rate);
  }
  if (rates.length === 0) return null;
  const kmPerYear = Math.round(rates.reduce((s, x) => s + x, 0) / rates.length);
  if (kmPerYear < 1) return null;
  return { kmPerYear, method: "interval_mean", sentence: sentenceFor(kmPerYear) };
}

/** Ja nav pietiekamu intervālu — jaunākais km / gadi kopš pirmās reģistrācijas. */
function fromFirstRegistration(
  points: MileagePoint[],
  csddForm: CsddFormFields | null | undefined,
  referenceDate: Date,
): AverageAnnualMileageResult | null {
  if (points.length === 0) return null;
  const latest = points.reduce((a, b) => (a.t >= b.t ? a : b));
  const firstReg = csddForm?.firstRegistration?.trim() ?? "";
  if (!firstReg) return null;
  const t0 = parseMileageDateForSort(firstReg);
  if (t0 === Number.NEGATIVE_INFINITY) return null;
  const end = Math.max(latest.t, referenceDate.getTime());
  const years = yearsBetweenMs(t0, end);
  if (years < 0.25 || latest.km <= 0) return null;
  const kmPerYear = Math.round(latest.km / years);
  if (kmPerYear < 1 || kmPerYear > 150_000) return null;
  return {
    kmPerYear,
    method: "first_registration",
    sentence: sentenceFor(kmPerYear),
  };
}

export function computeAverageAnnualMileage(args: {
  unifiedMileageRows: UnifiedMileageRow[];
  csddForm?: CsddFormFields | null;
  referenceDate?: Date;
}): AverageAnnualMileageResult | null {
  const ref = args.referenceDate ?? new Date();
  const points = pointsFromRows(args.unifiedMileageRows);
  return (
    fromSpan(points) ??
    fromIntervalMean(points) ??
    fromFirstRegistration(points, args.csddForm, ref)
  );
}

export function computeAverageAnnualMileageFromPayloadSlice(
  p: UnifiedMileageSourcePayload & { csddForm?: CsddFormFields | null },
  referenceDate?: Date,
): AverageAnnualMileageResult | null {
  const rows = filterDuplicateOdometerKmReadings(collectUnifiedMileageRows(p));
  return computeAverageAnnualMileage({
    unifiedMileageRows: rows,
    csddForm: p.csddForm,
    referenceDate,
  });
}
