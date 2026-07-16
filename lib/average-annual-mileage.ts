/**
 * Gada vidējais nobraukums — gudrāka rekonstrukcija ar odometra atskrūvēšanas korekciju
 * un intensīvākā perioda norādi.
 *
 * 1) Teorētiskā līkne: pie back-roll (≥1000 km kritums) pieskaita nobraukuma nobīdi.
 * 2) Vidējais = (teorētiskais pēdējais − pirmais) / gadi.
 * 3) Intensīvākais periods = intervāls ar augstāko gada likmi uz teorētiskās līknes.
 * 4) Rezerves: intervālu vidējais / pirmā reģistrācija — ja teorētiskā līkne nav pietiekama.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import {
  collectUnifiedMileageRows,
  filterDuplicateOdometerKmReadings,
  parseMileageDateForSort,
  UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";

export type AverageAnnualMileageMethod =
  | "theoretical_span"
  | "interval_mean"
  | "first_registration";

export type AverageAnnualMileageResult = {
  kmPerYear: number;
  method: AverageAnnualMileageMethod;
  sentence: string;
  /** Vai teorētiskajā līknē tika koriģēta odometra neatbilstība. */
  correctedForAnomaly: boolean;
  /** Intensīvākā intervāla gada likme (ja atrasta). */
  peakKmPerYear?: number;
  peakFromDisplay?: string;
  peakToDisplay?: string;
};

type MileagePoint = {
  t: number;
  km: number;
  dateDisplay: string;
};

type TheoreticalPoint = MileagePoint & {
  theoreticalKm: number;
};

function parseKmLoose(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 0 || n > 2_000_000) return null;
  return n;
}

function yearsBetweenMs(fromMs: number, toMs: number): number {
  return Math.max(0, (toMs - fromMs) / (365.25 * 86_400_000));
}

function formatKmLv(n: number): string {
  return Math.round(n).toLocaleString("lv-LV");
}

function dayKeyUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/** Viena diena → maksimālais odometra rādījums (vairāki avoti). */
function pointsFromRows(rows: UnifiedMileageRow[]): MileagePoint[] {
  const byDay = new Map<string, MileagePoint>();
  for (const r of rows) {
    if (r.sortableTime === Number.NEGATIVE_INFINITY) continue;
    const km = parseKmLoose(r.odometer);
    if (km === null) continue;
    const key = dayKeyUtc(r.sortableTime);
    const display = formatAutoRecordsDateForOutput(r.date) || r.date.trim();
    const prev = byDay.get(key);
    if (!prev || km > prev.km) {
      byDay.set(key, { t: r.sortableTime, km, dateDisplay: display });
    }
  }
  return [...byDay.values()].sort((a, b) => (a.t !== b.t ? a.t - b.t : a.km - b.km));
}

/**
 * Teorētiskā odometra līkne: katru būtisku kritumu (≥ ANOMALY_MIN) pieskaita kā
 * „pazaudēto” nobraukumu, lai turpmākie rādījumi atkal sakrīt ar reālo ekspluatāciju.
 */
export function reconstructTheoreticalMileagePath(points: MileagePoint[]): {
  path: TheoreticalPoint[];
  correctedForAnomaly: boolean;
  totalRollbackKm: number;
} {
  const path: TheoreticalPoint[] = [];
  let offset = 0;
  let prevRaw: number | null = null;
  let totalRollbackKm = 0;

  for (const p of points) {
    if (prevRaw !== null && p.km < prevRaw) {
      const drop = prevRaw - p.km;
      if (drop >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) {
        offset += drop;
        totalRollbackKm += drop;
      }
    }
    path.push({
      ...p,
      theoreticalKm: p.km + offset,
    });
    prevRaw = p.km;
  }

  return {
    path,
    correctedForAnomaly: totalRollbackKm > 0,
    totalRollbackKm,
  };
}

type PeakInterval = {
  fromDisplay: string;
  toDisplay: string;
  fromMs: number;
  toMs: number;
  kmPerYear: number;
  dKm: number;
};

function findMostIntensiveInterval(path: TheoreticalPoint[]): PeakInterval | null {
  let best: PeakInterval | null = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const years = yearsBetweenMs(a.t, b.t);
    const dKm = b.theoreticalKm - a.theoreticalKm;
    if (years < 14 / 365.25 || dKm <= 0) continue;
    const kmPerYear = dKm / years;
    if (kmPerYear < 500 || kmPerYear > 200_000) continue;
    if (!best || kmPerYear > best.kmPerYear) {
      best = {
        fromDisplay: a.dateDisplay,
        toDisplay: b.dateDisplay,
        fromMs: a.t,
        toMs: b.t,
        kmPerYear,
        dKm,
      };
    }
  }
  return best;
}

function buildSentence(args: {
  kmPerYear: number;
  correctedForAnomaly: boolean;
  totalRollbackKm: number;
  peak: PeakInterval | null;
}): string {
  const avg = formatKmLv(args.kmPerYear);
  let sentence = args.correctedForAnomaly
    ? `Saskaņā ar mūsu rīcībā esošajiem datiem un teorētiski koriģēto odometra vēsturi (ņemot vērā konstatētās nobraukuma neatbilstības aptuveni ${formatKmLv(args.totalRollbackKm)} km apmērā) transportlīdzekļa vidējais gada nobraukums ir aptuveni ${avg} km.`
    : `Saskaņā ar mūsu rīcībā esošajiem datiem transportlīdzekļa vidējais gada nobraukums ir aptuveni ${avg} km.`;

  if (args.peak) {
    const peakRate = formatKmLv(args.peak.kmPerYear);
    sentence += ` Intensīvākais periods: no ${args.peak.fromDisplay} līdz ${args.peak.toDisplay} (aptuveni ${peakRate} km gadā).`;
  }

  return sentence;
}

function fromTheoreticalSpan(
  path: TheoreticalPoint[],
  correctedForAnomaly: boolean,
  totalRollbackKm: number,
): AverageAnnualMileageResult | null {
  if (path.length < 2) return null;
  const first = path[0]!;
  const last = path[path.length - 1]!;
  const years = yearsBetweenMs(first.t, last.t);
  if (years < 30 / 365.25) return null;
  const dKm = last.theoreticalKm - first.theoreticalKm;
  if (dKm <= 0) return null;
  const kmPerYear = Math.round(dKm / years);
  if (kmPerYear < 1 || kmPerYear > 150_000) return null;
  const peak = findMostIntensiveInterval(path);
  return {
    kmPerYear,
    method: "theoretical_span",
    correctedForAnomaly,
    peakKmPerYear: peak ? Math.round(peak.kmPerYear) : undefined,
    peakFromDisplay: peak?.fromDisplay,
    peakToDisplay: peak?.toDisplay,
    sentence: buildSentence({ kmPerYear, correctedForAnomaly, totalRollbackKm, peak }),
  };
}

/** Rezerves bez teorētiskās korekcijas: intervālu aritmētiskais vidējais (tikai augoši posmi). */
function fromIntervalMean(points: MileagePoint[]): AverageAnnualMileageResult | null {
  if (points.length < 2) return null;
  const rates: number[] = [];
  let peak: PeakInterval | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const years = yearsBetweenMs(a.t, b.t);
    const dKm = b.km - a.km;
    if (years < 14 / 365.25 || dKm <= 0) continue;
    const rate = dKm / years;
    if (rate < 1 || rate > 150_000) continue;
    rates.push(rate);
    if (!peak || rate > peak.kmPerYear) {
      peak = {
        fromDisplay: a.dateDisplay,
        toDisplay: b.dateDisplay,
        fromMs: a.t,
        toMs: b.t,
        kmPerYear: rate,
        dKm,
      };
    }
  }
  if (rates.length === 0) return null;
  const kmPerYear = Math.round(rates.reduce((s, x) => s + x, 0) / rates.length);
  if (kmPerYear < 1) return null;
  return {
    kmPerYear,
    method: "interval_mean",
    correctedForAnomaly: false,
    peakKmPerYear: peak ? Math.round(peak.kmPerYear) : undefined,
    peakFromDisplay: peak?.fromDisplay,
    peakToDisplay: peak?.toDisplay,
    sentence: buildSentence({
      kmPerYear,
      correctedForAnomaly: false,
      totalRollbackKm: 0,
      peak,
    }),
  };
}

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
  const fromDisplay = formatAutoRecordsDateForOutput(firstReg) || firstReg;
  const peak: PeakInterval = {
    fromDisplay,
    toDisplay: latest.dateDisplay,
    fromMs: t0,
    toMs: end,
    kmPerYear,
    dKm: latest.km,
  };
  return {
    kmPerYear,
    method: "first_registration",
    correctedForAnomaly: false,
    peakKmPerYear: kmPerYear,
    peakFromDisplay: fromDisplay,
    peakToDisplay: latest.dateDisplay,
    sentence: buildSentence({
      kmPerYear,
      correctedForAnomaly: false,
      totalRollbackKm: 0,
      peak,
    }),
  };
}

export function computeAverageAnnualMileage(args: {
  unifiedMileageRows: UnifiedMileageRow[];
  csddForm?: CsddFormFields | null;
  referenceDate?: Date;
}): AverageAnnualMileageResult | null {
  const ref = args.referenceDate ?? new Date();
  const points = pointsFromRows(args.unifiedMileageRows);
  const { path, correctedForAnomaly, totalRollbackKm } = reconstructTheoreticalMileagePath(points);

  return (
    fromTheoreticalSpan(path, correctedForAnomaly, totalRollbackKm) ??
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
