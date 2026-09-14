/**
 * Deterministiska nobraukuma forenzika ✨ promptam.
 * Temps, avotu neatkarība un odometra krituma robežas tiek rēķinātas kodā,
 * lai modelim nebūtu jādala km ar dienām un jāizvēlas viena versija.
 */
import {
  UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM,
  collectUnifiedMileageRows,
  parseOdometerKm,
  prepareUnifiedMileageDisplayRows,
  sortMileageChronological,
  type UnifiedMileageRow,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";

const MS_DAY = 86_400_000;

/** Īsāki intervāli nav „noturēts temps” (servisa vizītes vienā nedēļā). */
export const MILEAGE_RATE_MIN_INTERVAL_DAYS = 14;

/** ~50 000 km gadā: komerciālas izmantošanas slieksnis. */
export const MILEAGE_RATE_COMMERCIAL_KM_PER_YEAR = 50_000;

/** ~91 000 km gadā: ekstrēms temps privātai ekspluatācijai. */
export const MILEAGE_RATE_EXTREME_KM_PER_DAY = 250;

/** Pēc intensīva perioda: gandrīz stāvēšana. */
export const MILEAGE_IDLE_MAX_KM_PER_YEAR = 8_000;
export const MILEAGE_IDLE_MIN_DAYS = 180;

/** Cik pārklājošos rādījumu vajag, lai avoti nebūtu neatkarīgi. */
export const SOURCE_INDEPENDENCE_MIN_PAIRS = 4;
export const SOURCE_INDEPENDENCE_MAX_KM_MATCH = 200;
export const SOURCE_INDEPENDENCE_OFFSET_STABLE_KM = 10;

export function formatForensicsInt(n: number): string {
  return Math.round(n)
    .toLocaleString("lv-LV")
    .replace(/\u00A0/g, " ")
    .replace(/[\u202F]/g, " ");
}

function daysBetween(a: number, b: number): number {
  return Math.max(0, Math.round((b - a) / MS_DAY));
}

function kmPerYear(kmPerDay: number): number {
  return kmPerDay * 365.25;
}

export type MileageRateClass = "normal" | "commercial" | "extreme";

export type MileageRateInterval = {
  fromDate: string;
  toDate: string;
  fromKm: number;
  toKm: number;
  days: number;
  deltaKm: number;
  kmPerDay: number;
  kmPerYear: number;
  rateClass: MileageRateClass;
};

function classifyRate(kmPerDay: number): MileageRateClass {
  if (kmPerDay >= MILEAGE_RATE_EXTREME_KM_PER_DAY) return "extreme";
  if (kmPerYear(kmPerDay) >= MILEAGE_RATE_COMMERCIAL_KM_PER_YEAR) return "commercial";
  return "normal";
}

function datedKm(rows: UnifiedMileageRow[]): Array<{
  date: string;
  km: number;
  t: number;
  sourceLabel: string;
}> {
  const out: Array<{ date: string; km: number; t: number; sourceLabel: string }> = [];
  for (const row of sortMileageChronological(rows)) {
    const km = parseOdometerKm(row.odometer);
    const t = row.sortableTime;
    if (km == null || !Number.isFinite(t) || t === Number.NEGATIVE_INFINITY) continue;
    out.push({
      date: row.date,
      km,
      t,
      sourceLabel: row.sourceLabel.trim() || "Nezināms avots",
    });
  }
  return out;
}

function positiveIntervals(points: ReturnType<typeof datedKm>): MileageRateInterval[] {
  const out: MileageRateInterval[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    const days = daysBetween(prev.t, next.t);
    const deltaKm = next.km - prev.km;
    if (days < MILEAGE_RATE_MIN_INTERVAL_DAYS || deltaKm <= 0) continue;
    const perDay = deltaKm / days;
    out.push({
      fromDate: prev.date,
      toDate: next.date,
      fromKm: prev.km,
      toKm: next.km,
      days,
      deltaKm,
      kmPerDay: perDay,
      kmPerYear: kmPerYear(perDay),
      rateClass: classifyRate(perDay),
    });
  }
  return out;
}

export function analyzeMileageRates(rows: UnifiedMileageRow[]): {
  intervals: MileageRateInterval[];
  notable: MileageRateInterval[];
  idleAfterIntense: MileageRateInterval[];
} {
  const merged = prepareUnifiedMileageDisplayRows(rows);
  const intervals = positiveIntervals(datedKm(merged));
  const notable = intervals.filter((x) => x.rateClass !== "normal");
  const idleAfterIntense: MileageRateInterval[] = [];
  let sawIntense = false;
  for (const interval of intervals) {
    if (interval.rateClass !== "normal") {
      sawIntense = true;
      continue;
    }
    if (
      sawIntense &&
      interval.days >= MILEAGE_IDLE_MIN_DAYS &&
      interval.kmPerYear < MILEAGE_IDLE_MAX_KM_PER_YEAR
    ) {
      idleAfterIntense.push(interval);
    }
  }
  return { intervals, notable, idleAfterIntense };
}

export function buildMileageRateBrief(rows: UnifiedMileageRow[]): string {
  const { notable, idleAfterIntense } = analyzeMileageRates(rows);
  if (notable.length === 0 && idleAfterIntense.length === 0) return "";
  const lines = [
    "### Nobraukuma temps (deterministisks - NEIZDOMĀ pretējo)",
    "- Šie cipari ir KODA aprēķins. NEDALI no jauna. Nelieto tos kā pierādītu manipulāciju.",
  ];
  for (const x of notable) {
    const label = x.rateClass === "extreme" ? "EKSTRĒMS" : "KOMERCIĀLS";
    lines.push(
      `- ${x.fromDate} (${formatForensicsInt(x.fromKm)} km) → ${x.toDate} (${formatForensicsInt(x.toKm)} km): ${x.days} dienas, ${formatForensicsInt(x.deltaKm)} km, ${formatForensicsInt(x.kmPerDay)} km/dienā (~${formatForensicsInt(x.kmPerYear)} km gadā). Statuss: ${label}.`,
    );
  }
  if (notable.some((x) => x.rateClass === "extreme")) {
    lines.push(
      "- EKSTRĒMS temps (ap 250+ km/dienā) privātam auto nav ticams kā ikdiena. Tas ir fakta aprēķins, ne izskaidrojums. Klientam saki, ka šo tempu līdz galam izskaidrot nevaram.",
    );
  }
  for (const x of idleAfterIntense) {
    lines.push(
      `- Pēc intensīva perioda: ${x.fromDate} → ${x.toDate} tikai ${formatForensicsInt(x.deltaKm)} km ${x.days} dienās (~${formatForensicsInt(x.kmPerYear)} km gadā). Arī šis temps nav loģisks turpinājums iepriekšējam. Neizvēlies vienu versiju kā patiesību.`,
    );
  }
  return lines.join("\n");
}

export type SourceIndependencePair = {
  sourceA: string;
  sourceB: string;
  pairCount: number;
  medianOffsetKm: number;
  minOffsetKm: number;
  maxOffsetKm: number;
};

function sourceKey(raw: string): string {
  return raw.trim().toLowerCase();
}

function pairKey(a: string, b: string): string {
  const x = sourceKey(a);
  const y = sourceKey(b);
  return x < y ? `${x}||${y}` : `${y}||${x}`;
}

function displayPairSources(a: string, b: string): [string, string] {
  return sourceKey(a) < sourceKey(b) ? [a.trim(), b.trim()] : [b.trim(), a.trim()];
}

function sameUtcMonth(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[mid - 1]! + s[mid]!) / 2;
  return s[mid]!;
}

export function analyzeSourceIndependence(rows: UnifiedMileageRow[]): SourceIndependencePair[] {
  const points = datedKm(rows);
  const buckets = new Map<string, { a: string; b: string; offsets: number[] }>();

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const left = points[i]!;
      const right = points[j]!;
      if (sourceKey(left.sourceLabel) === sourceKey(right.sourceLabel)) continue;
      if (!sameUtcMonth(left.t, right.t)) continue;
      const diff = right.km - left.km;
      if (Math.abs(diff) > SOURCE_INDEPENDENCE_MAX_KM_MATCH) continue;
      const [nameA, nameB] = displayPairSources(left.sourceLabel, right.sourceLabel);
      const key = pairKey(left.sourceLabel, right.sourceLabel);
      const signed =
        sourceKey(left.sourceLabel) === sourceKey(nameA) ? right.km - left.km : left.km - right.km;
      const bucket = buckets.get(key) ?? { a: nameA, b: nameB, offsets: [] };
      bucket.offsets.push(signed);
      buckets.set(key, bucket);
    }
  }

  const out: SourceIndependencePair[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.offsets.length < SOURCE_INDEPENDENCE_MIN_PAIRS) continue;
    const minOffsetKm = Math.min(...bucket.offsets);
    const maxOffsetKm = Math.max(...bucket.offsets);
    if (maxOffsetKm - minOffsetKm > SOURCE_INDEPENDENCE_OFFSET_STABLE_KM) continue;
    out.push({
      sourceA: bucket.a,
      sourceB: bucket.b,
      pairCount: bucket.offsets.length,
      medianOffsetKm: median(bucket.offsets),
      minOffsetKm,
      maxOffsetKm,
    });
  }
  return out;
}

export function buildSourceIndependenceBrief(rows: UnifiedMileageRow[]): string {
  const pairs = analyzeSourceIndependence(rows);
  if (pairs.length === 0) return "";
  const lines = [
    "### Avotu neatkarība nobraukumā (deterministisks - NEIZDOMĀ pretējo)",
    "- Šie avoti NAV neatkarīgi odometra apstiprinājumi. NERAKSTI, ka viens apstiprina otru vai ka „divi avoti rāda to pašu”.",
  ];
  for (const p of pairs) {
    const offset = formatForensicsInt(Math.abs(p.medianOffsetKm));
    lines.push(
      `- ${p.sourceA} un ${p.sourceB}: ${p.pairCount} rādījumi vienā mēnesī ar gandrīz konstantu nobīdi ~${offset} km. Tas ir viens un tas pats nolasījums divos izrakstos.`,
    );
  }
  return lines.join("\n");
}

export type OdometerRollbackBound = {
  fromDate: string;
  toDate: string;
  fromKm: number;
  toKm: number;
  gapDays: number;
  minDropKm: number;
  previousKmPerDay: number | null;
  previousRateClass: MileageRateClass | null;
  ceilingAdditionalKm: number | null;
  maxDropKm: number | null;
};

export function analyzeOdometerRollbackBounds(rows: UnifiedMileageRow[]): OdometerRollbackBound[] {
  const merged = prepareUnifiedMileageDisplayRows(rows);
  const points = datedKm(merged);
  const intervals = positiveIntervals(points);
  const out: OdometerRollbackBound[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    const drop = prev.km - next.km;
    if (drop < UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) continue;
    const gapDays = daysBetween(prev.t, next.t);
    const previous = [...intervals].reverse().find((x) => x.toDate === prev.date || x.toKm === prev.km);
    const previousKmPerDay = previous?.kmPerDay ?? null;
    const ceilingAdditionalKm =
      previousKmPerDay != null && gapDays > 0 ? Math.round(previousKmPerDay * gapDays) : null;
    out.push({
      fromDate: prev.date,
      toDate: next.date,
      fromKm: prev.km,
      toKm: next.km,
      gapDays,
      minDropKm: drop,
      previousKmPerDay,
      previousRateClass: previous?.rateClass ?? null,
      ceilingAdditionalKm,
      maxDropKm: ceilingAdditionalKm != null ? drop + ceilingAdditionalKm : null,
    });
  }
  return out;
}

export function buildOdometerRollbackBoundsBrief(rows: UnifiedMileageRow[]): string {
  const bounds = analyzeOdometerRollbackBounds(rows);
  if (bounds.length === 0) return "";
  const lines = [
    "### Odometra krituma robežas (deterministisks - NEIZDOMĀ pretējo)",
    "- Minimums ir novērotais kritums. Maksimums ir aritmētiska robeža, JA iepriekšējais temps turpinājās tukšuma laikā. Neviens no tiem NAV pierādīta manipulācija.",
    "- Ja ekstrēmais temps UN gandrīz stāvēšana abi nav ticami, saki klientam, ka neatbilstību līdz galam izskaidrot nevaram. Drīkst dot vairākas interpretācijas. Aizliegts pārvērst „nezinām” par „ļoti iespējams, ka odometrs koriģēts”.",
  ];
  for (const b of bounds) {
    lines.push(
      `- ${b.fromDate} (${formatForensicsInt(b.fromKm)} km) → ${b.toDate} (${formatForensicsInt(b.toKm)} km): minimums ${formatForensicsInt(b.minDropKm)} km, tukšums ${b.gapDays} dienas.`,
    );
    if (b.previousKmPerDay != null && b.ceilingAdditionalKm != null && b.maxDropKm != null) {
      lines.push(
        `- Iepriekš novērotais temps: ${formatForensicsInt(b.previousKmPerDay)} km/dienā${b.previousRateClass === "extreme" ? " (EKSTRĒMS)" : b.previousRateClass === "commercial" ? " (komerciāls)" : ""}. Aritmētiskie griesti, ja tas turpinājās tukšumā: +${formatForensicsInt(b.ceilingAdditionalKm)} km; kopējā korekcijas robeža ~${formatForensicsInt(b.maxDropKm)} km. Tā ir APRĒĶINA robeža, ne apgalvojums, ka auto tik tālu brauca.`,
      );
    }
  }
  return lines.join("\n");
}

/** Visi trīs brīfi vienā blokā order-context. Tukšs, ja nav ko teikt. */
export function buildMileageForensicsBrief(payload: UnifiedMileageSourcePayload): string {
  const raw = collectUnifiedMileageRows(payload);
  if (raw.length === 0) return "";
  return [
    buildMileageRateBrief(raw),
    buildSourceIndependenceBrief(raw),
    buildOdometerRollbackBoundsBrief(raw),
  ]
    .filter(Boolean)
    .join("\n\n");
}
