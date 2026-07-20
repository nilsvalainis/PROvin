/**
 * Gada vidējais nobraukums — gudrāka rekonstrukcija ar odometra atskrūvēšanas korekciju
 * un intensīvākā perioda norādi.
 *
 * 1) Teorētiskā līkne: pie back-roll (≥1000 km kritums) pieskaita nobraukuma nobīdi.
 * 2) Vidējais = (teorētiskais pēdējais − pirmais) / gadi.
 * 3) Intensīvākais periods = intervāls ≥90 dienas ar augstāko gada likmi uz teorētiskās līknes
 *    (īsāki posmi = ceļojumi / datu kļūdas — neizmanto ikgadējai ekstrapolācijai).
 * 4) Rezerves: intervālu vidējais / pirmā reģistrācija — ja teorētiskā līkne nav pietiekama.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import { countryLabelToIso2 } from "@/lib/country-names-lv";
import {
  collectUnifiedMileageRows,
  filterDuplicateOdometerKmReadings,
  parseMileageDateForSort,
  UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";

/** Minimālais intervāls intensīvākā perioda / intervālu vidējā aprēķinam (dienas). */
export const MIN_INTENSIVE_INTERVAL_DAYS = 90;

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
  country: string;
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

function daysBetweenMs(fromMs: number, toMs: number): number {
  return Math.max(0, (toMs - fromMs) / 86_400_000);
}

function formatKmLv(n: number): string {
  return Math.round(n).toLocaleString("lv-LV");
}

function dayKeyUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/** ISO → lokatīvs teikumam „fiksēts Nīderlandē”. */
const ISO_LOCATIVE_LV: Record<string, string> = {
  NL: "Nīderlandē",
  LV: "Latvijā",
  LT: "Lietuvā",
  EE: "Igaunijā",
  DE: "Vācijā",
  BE: "Beļģijā",
  FR: "Francijā",
  DK: "Dānijā",
  ES: "Spānijā",
  IT: "Itālijā",
  FI: "Somijā",
  SE: "Zviedrijā",
  PL: "Polijā",
  AT: "Austrijā",
  GB: "Apvienotajā Karalistē",
  CH: "Šveicē",
  CZ: "Čehijā",
  SK: "Slovākijā",
  HU: "Ungārijā",
  US: "ASV",
};

function countryLocative(country: string): string | null {
  const iso = countryLabelToIso2(country);
  if (!iso) return null;
  return ISO_LOCATIVE_LV[iso] ?? null;
}

function isLatviaCountry(country: string): boolean {
  return countryLabelToIso2(country) === "LV";
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
    const country = (r.country ?? "").trim();
    const prev = byDay.get(key);
    if (!prev || km > prev.km) {
      byDay.set(key, { t: r.sortableTime, km, dateDisplay: display, country });
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
  /** Kritums tieši pirms LV ieraksta (tipiska importa atskrūvēšana). */
  rollbackBeforeLvRegistration: boolean;
} {
  const path: TheoreticalPoint[] = [];
  let offset = 0;
  let prevRaw: number | null = null;
  let prevCountry = "";
  let totalRollbackKm = 0;
  let rollbackBeforeLvRegistration = false;

  for (const p of points) {
    if (prevRaw !== null && p.km < prevRaw) {
      const drop = prevRaw - p.km;
      if (drop >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) {
        offset += drop;
        totalRollbackKm += drop;
        if (isLatviaCountry(p.country) && prevCountry && !isLatviaCountry(prevCountry)) {
          rollbackBeforeLvRegistration = true;
        }
      }
    }
    path.push({
      ...p,
      theoreticalKm: p.km + offset,
    });
    prevRaw = p.km;
    prevCountry = p.country;
  }

  return {
    path,
    correctedForAnomaly: totalRollbackKm > 0,
    totalRollbackKm,
    rollbackBeforeLvRegistration,
  };
}

type PeakInterval = {
  fromDisplay: string;
  toDisplay: string;
  fromMs: number;
  toMs: number;
  kmPerYear: number;
  dKm: number;
  country: string;
};

/**
 * Augstākā gada likme starp jebkuriem punktiem ar ≥ {@link MIN_INTENSIVE_INTERVAL_DAYS} dienu starplaiku.
 * Īsāki posmi (ceļojumi / kļūdas) netiek ņemti vērā — arī kā „kaimiņi”, kas sadala garāku posmu.
 * Formula: (Δkm / dienas) × 365.25
 */
function findMostIntensiveInterval(path: TheoreticalPoint[]): PeakInterval | null {
  let best: PeakInterval | null = null;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    for (let j = i + 1; j < path.length; j++) {
      const b = path[j]!;
      const days = daysBetweenMs(a.t, b.t);
      if (days < MIN_INTENSIVE_INTERVAL_DAYS) continue;
      const dKm = b.theoreticalKm - a.theoreticalKm;
      if (dKm <= 0) continue;
      const kmPerYear = (dKm / days) * 365.25;
      if (kmPerYear < 500 || kmPerYear > 200_000) continue;
      if (!best || kmPerYear > best.kmPerYear) {
        best = {
          fromDisplay: a.dateDisplay,
          toDisplay: b.dateDisplay,
          fromMs: a.t,
          toMs: b.t,
          kmPerYear,
          dKm,
          country: b.country || a.country,
        };
      }
    }
  }
  return best;
}

function buildSentence(args: {
  kmPerYear: number;
  correctedForAnomaly: boolean;
  totalRollbackKm: number;
  rollbackBeforeLvRegistration: boolean;
  peak: PeakInterval | null;
}): string {
  const avg = formatKmLv(args.kmPerYear);
  let sentence: string;
  if (args.correctedForAnomaly) {
    const where = args.rollbackBeforeLvRegistration ? " pirms reģistrācijas Latvijā" : "";
    sentence = `Saskaņā ar mūsu rīcībā esošajiem datiem un teorētiski koriģēto odometra vēsturi (ņemot vērā konstatēto nobraukuma samazināšanu par ${formatKmLv(args.totalRollbackKm)} km${where}), transportlīdzekļa vidējais gada nobraukums ir aptuveni ${avg} km.`;
  } else {
    sentence = `Saskaņā ar mūsu rīcībā esošajiem datiem transportlīdzekļa vidējais gada nobraukums ir aptuveni ${avg} km.`;
  }

  if (args.peak) {
    const peakRate = formatKmLv(args.peak.kmPerYear);
    const loc = countryLocative(args.peak.country);
    const place = loc ? ` fiksēts ${loc}` : "";
    sentence += ` Intensīvākais ticamais periods${place} no ${args.peak.fromDisplay} līdz ${args.peak.toDisplay} (aptuveni ${peakRate} km gadā).`;
  }

  return sentence;
}

function fromTheoreticalSpan(
  path: TheoreticalPoint[],
  correctedForAnomaly: boolean,
  totalRollbackKm: number,
  rollbackBeforeLvRegistration: boolean,
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
    sentence: buildSentence({
      kmPerYear,
      correctedForAnomaly,
      totalRollbackKm,
      rollbackBeforeLvRegistration,
      peak,
    }),
  };
}

/** Rezerves bez teorētiskās korekcijas: vidējais no katra punkta līdz nākamajam ≥90d punktam; peak = max pāris ≥90d. */
function fromIntervalMean(points: MileagePoint[]): AverageAnnualMileageResult | null {
  if (points.length < 2) return null;
  const consecutiveRates: number[] = [];
  let peak: PeakInterval | null = null;

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    let nextRateTaken = false;
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j]!;
      const days = daysBetweenMs(a.t, b.t);
      if (days < MIN_INTENSIVE_INTERVAL_DAYS) continue;
      const dKm = b.km - a.km;
      if (dKm <= 0) continue;
      const rate = (dKm / days) * 365.25;
      if (rate < 1 || rate > 150_000) continue;
      if (!nextRateTaken) {
        consecutiveRates.push(rate);
        nextRateTaken = true;
      }
      if (!peak || rate > peak.kmPerYear) {
        peak = {
          fromDisplay: a.dateDisplay,
          toDisplay: b.dateDisplay,
          fromMs: a.t,
          toMs: b.t,
          kmPerYear: rate,
          dKm,
          country: b.country || a.country,
        };
      }
    }
  }
  if (consecutiveRates.length === 0) return null;
  const kmPerYear = Math.round(
    consecutiveRates.reduce((s, x) => s + x, 0) / consecutiveRates.length,
  );
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
      rollbackBeforeLvRegistration: false,
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
  return {
    kmPerYear,
    method: "first_registration",
    correctedForAnomaly: false,
    sentence: buildSentence({
      kmPerYear,
      correctedForAnomaly: false,
      totalRollbackKm: 0,
      rollbackBeforeLvRegistration: false,
      peak: null,
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
  const { path, correctedForAnomaly, totalRollbackKm, rollbackBeforeLvRegistration } =
    reconstructTheoreticalMileagePath(points);

  return (
    fromTheoreticalSpan(path, correctedForAnomaly, totalRollbackKm, rollbackBeforeLvRegistration) ??
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
