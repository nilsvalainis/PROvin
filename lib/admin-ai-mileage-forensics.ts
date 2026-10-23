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
  type UnifiedMileageDisplayRow,
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

type DatedKmPoint = {
  date: string;
  km: number;
  t: number;
  sourceLabel: string;
  /** Apvienotajā rindā visi avoti (viens nolasījums vairākos izrakstos). */
  sourceLabels: string[];
  /** Tikai reģistra/dīlera valsts; sludinājuma pieņēmums un „Nezināmā” ir "". */
  verifiedCountry: string;
  country: string;
};

const UNKNOWN_COUNTRY_RE = /^(?:nezinām\w*|-|\u2014)?$/i;

function datedKm(rows: UnifiedMileageRow[]): DatedKmPoint[] {
  const out: DatedKmPoint[] = [];
  for (const row of sortMileageChronological(rows)) {
    const km = parseOdometerKm(row.odometer);
    const t = row.sortableTime;
    if (km == null || !Number.isFinite(t) || t === Number.NEGATIVE_INFINITY) continue;
    const sourceLabel = row.sourceLabel.trim() || "Nezināms avots";
    const labels = (row as Partial<UnifiedMileageDisplayRow>).sourceLabels;
    const country = row.country.trim();
    out.push({
      date: row.date,
      km,
      t,
      sourceLabel,
      sourceLabels: labels && labels.length > 0 ? labels.map((l) => l.trim()).filter(Boolean) : [sourceLabel],
      verifiedCountry: row.countryUnverified || UNKNOWN_COUNTRY_RE.test(country) ? "" : country,
      country: UNKNOWN_COUNTRY_RE.test(country) ? "" : country,
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

/**
 * „real” - kritums jāraksta kā iespējama odometra korekcija.
 * „suspectedEntryError” - viens izolēts rādījums ārpus secības (visticamāk ievades kļūda).
 */
export type OdometerDropKind = "real" | "suspectedEntryError";

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
  /** Avots(-i) un valsts abiem krituma punktiem (faktu lapai un validatoram). */
  fromSource?: string;
  toSource?: string;
  fromCountry?: string;
  toCountry?: string;
  kind?: OdometerDropKind;
  /** Tikai `suspectedEntryError`: kurš rādījums ir ārpus secības. */
  suspect?: { date: string; km: number; source: string };
};

/** Starp kaimiņiem bez aizdomīgā punkta: ticams temps (km/dienā). */
export const ENTRY_ERROR_MAX_KM_PER_DAY = 150;
/** Cits avots ar to pašu zemo/augsto vērtību ±km ±dienās = apstiprināts, nav ievades kļūda. */
export const ENTRY_ERROR_CONFIRM_KM = 1_000;
export const ENTRY_ERROR_CONFIRM_DAYS = 60;

/** Servisa vēsturē mērinstrumentu paneļa / odometra nomaiņa = reālas korekcijas pazīme. */
export const ODOMETER_REPLACEMENT_RE =
  /instrument(?:en)?\s*cluster|kombiinstrument|tachometer\s*(?:replace|tausch)|tacho\w*\s*(?:getauscht|ersetzt|tausch)|speedometer\s*(?:replace|repair)|odomet\w*\s*(?:replace|repair|nomai|maiņ|remont)|(?:nomai\w*|maiņ\w*|remont\w*)\s+odometr|mērinstrumentu\s+panel\w*\s*(?:nomai|maiņ|remont)|spidometr\w*\s*(?:nomai|maiņ|remont)/i;

export type OdometerDropAnalysisOptions = {
  /** Servisa vēsturē ir mērinstrumentu paneļa / odometra nomaiņa. */
  odometerReplacementNoted?: boolean;
};

function pointSources(p: DatedKmPoint): string {
  return [...new Set(p.sourceLabels)].join(", ");
}

function withoutIndexIsAscending(points: DatedKmPoint[], skip: number): boolean {
  let prev: DatedKmPoint | null = null;
  for (let j = 0; j < points.length; j++) {
    if (j === skip) continue;
    const p = points[j]!;
    if (prev && prev.km - p.km >= UNIFIED_MILEAGE_ANOMALY_MIN_DROP_KM) return false;
    prev = p;
  }
  return true;
}

/** Cik citu (neatkarīgu) avotu rāda to pašu vērtību ±1 000 km ±60 dienās. */
function confirmingSourceCount(p: DatedKmPoint, raw: DatedKmPoint[]): number {
  const own = new Set(p.sourceLabels.map(sourceKey));
  const others = new Set<string>();
  for (const r of raw) {
    if (own.has(sourceKey(r.sourceLabel))) continue;
    if (Math.abs(r.km - p.km) > ENTRY_ERROR_CONFIRM_KM) continue;
    if (Math.abs(r.t - p.t) > ENTRY_ERROR_CONFIRM_DAYS * MS_DAY) continue;
    others.add(sourceKey(r.sourceLabel));
  }
  return own.size - 1 + others.size;
}

/**
 * Vai punkts `c` ir izolēta ievades kļūda (visi 5 nosacījumi). Šaubu gadījumā - nē.
 * Atgriež novirzi no kaimiņu līnijas (izšķiršanai, ja der abi krituma punkti) vai null.
 */
function isolatedEntryErrorScore(
  points: DatedKmPoint[],
  raw: DatedKmPoint[],
  c: number,
  dropPair: [DatedKmPoint, DatedKmPoint],
  opts: OdometerDropAnalysisOptions,
): { deviation: number; confirmations: number } | null {
  if (opts.odometerReplacementNoted) return null;
  const before = points[c - 1];
  const after = points[c + 1];
  // 2) vajag gan iepriekšējo, gan vēlāku rādījumu; pēdējais rādījums nekad nav izolēts.
  if (!before || !after) return null;
  if (after.km < before.km) return null;
  // 1) bez šī punkta visa secība ir augoša.
  if (!withoutIndexIsAscending(points, c)) return null;
  // 3) ticams temps starp kaimiņiem.
  const days = (after.t - before.t) / MS_DAY;
  const delta = after.km - before.km;
  if (days <= 0) {
    if (delta > ENTRY_ERROR_CONFIRM_KM) return null;
  } else if (delta / days > ENTRY_ERROR_MAX_KM_PER_DAY) {
    return null;
  }
  // 4) neviens cits avots neapstiprina šo vērtību.
  const confirmations = confirmingSourceCount(points[c]!, raw);
  if (confirmations > 0) return null;
  // 5) valsts maiņa tieši krituma brīdī = iespējama reāla korekcija importā.
  const [a, b] = dropPair;
  if (a.verifiedCountry && b.verifiedCountry && sourceKey(a.verifiedCountry) !== sourceKey(b.verifiedCountry)) {
    return null;
  }
  const span = after.t - before.t;
  const expected =
    span > 0 ? before.km + ((points[c]!.t - before.t) / span) * delta : (before.km + after.km) / 2;
  return { deviation: Math.abs(points[c]!.km - expected), confirmations };
}

function classifyDrop(
  points: DatedKmPoint[],
  raw: DatedKmPoint[],
  i: number,
  opts: OdometerDropAnalysisOptions,
): Pick<OdometerRollbackBound, "kind" | "suspect"> {
  const pair: [DatedKmPoint, DatedKmPoint] = [points[i - 1]!, points[i]!];
  // Reāla korekcija: pēc krituma neviens rādījums neatgriežas līdz iepriekšējam līmenim
  // (jauna, zemāka bāze vai kritums pēdējā rādījumā), vai zemo vērtību apstiprina cits avots.
  const recovered = points.slice(i + 1).some((p) => p.km >= pair[0].km);
  if (!recovered) return { kind: "real" };
  if (confirmingSourceCount(pair[1], raw) > 0) return { kind: "real" };
  const high = isolatedEntryErrorScore(points, raw, i - 1, pair, opts);
  const low = isolatedEntryErrorScore(points, raw, i, pair, opts);
  if (!high && !low) return { kind: "real" };
  let pick = high ? i - 1 : i;
  if (high && low) pick = high.deviation > low.deviation ? i - 1 : i;
  const p = points[pick]!;
  return { kind: "suspectedEntryError", suspect: { date: p.date, km: p.km, source: pointSources(p) } };
}

export function analyzeOdometerRollbackBounds(
  rows: UnifiedMileageRow[],
  opts: OdometerDropAnalysisOptions = {},
): OdometerRollbackBound[] {
  const merged = prepareUnifiedMileageDisplayRows(rows);
  const points = datedKm(merged);
  const raw = datedKm(rows);
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
      fromSource: pointSources(prev),
      toSource: pointSources(next),
      fromCountry: prev.country,
      toCountry: next.country,
      ...classifyDrop(points, raw, i, opts),
    });
  }
  return out;
}

export function isRealOdometerDrop(b: OdometerRollbackBound): boolean {
  return b.kind !== "suspectedEntryError";
}

function suspectedEntryErrorLine(b: OdometerRollbackBound): string {
  return `- ${b.suspect!.date}, ${formatForensicsInt(b.suspect!.km)} km (${b.suspect!.source}): viens rādījums ārpus secības, pārējie rādījumi turpina trendu. Visticamāk ievades kļūda. Nobraukuma laukā drīkst vienu neitrālu teikumu, citur nepiemin.`;
}

export function buildOdometerRollbackBoundsBrief(
  rows: UnifiedMileageRow[],
  opts: OdometerDropAnalysisOptions = {},
): string {
  const all = analyzeOdometerRollbackBounds(rows, opts);
  const bounds = all.filter(isRealOdometerDrop);
  const suspected = all.filter((b) => !isRealOdometerDrop(b) && b.suspect);
  if (bounds.length === 0) {
    if (suspected.length === 0) return "";
    return [
      "### Atsevišķs neatbilstošs rādījums (deterministisks - NAV odometra korekcija)",
      ...suspected.map(suspectedEntryErrorLine),
    ].join("\n");
  }
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
  if (suspected.length > 0) {
    lines.push("- Atsevišķs neatbilstošs rādījums (NAV odometra korekcija):");
    lines.push(...suspected.map(suspectedEntryErrorLine));
  }
  return lines.join("\n");
}

export const OFFICIAL_DEALER_MILEAGE_LABEL = "OFICIĀLĀ DĪLERA DATI";
/** Cita avota rādījums zem agrāka dīlera rādījuma par vismaz šo — pretruna ar dīleri. */
export const DEALER_CONFLICT_MIN_KM = 1_000;

function isOfficialDealerLabel(label: string): boolean {
  return sourceKey(label) === sourceKey(OFFICIAL_DEALER_MILEAGE_LABEL);
}

export type DealerOdometerConflict = {
  dealerDate: string;
  dealerKm: number;
  otherDate: string;
  otherKm: number;
  otherSource: string;
  diffKm: number;
};

/**
 * Oficiālā dīlera (OneAuto) rādījumi ir augstākās ticamības atskaites punkts.
 * Atgriež citu avotu rādījumus, kas ir zemāki par AGRĀKU dīlera rādījumu.
 */
export function analyzeDealerOdometerConflicts(rows: UnifiedMileageRow[]): DealerOdometerConflict[] {
  const points = datedKm(rows);
  const out: DealerOdometerConflict[] = [];
  let maxDealer: { date: string; km: number; t: number } | null = null;
  for (const p of points) {
    if (isOfficialDealerLabel(p.sourceLabel)) {
      if (!maxDealer || p.km > maxDealer.km) maxDealer = { date: p.date, km: p.km, t: p.t };
      continue;
    }
    if (maxDealer && p.t > maxDealer.t && maxDealer.km - p.km >= DEALER_CONFLICT_MIN_KM) {
      out.push({
        dealerDate: maxDealer.date,
        dealerKm: maxDealer.km,
        otherDate: p.date,
        otherKm: p.km,
        otherSource: p.sourceLabel,
        diffKm: maxDealer.km - p.km,
      });
    }
  }
  return out;
}

function suspectKeys(rows: UnifiedMileageRow[], opts: OdometerDropAnalysisOptions): Set<string> {
  return new Set(
    analyzeOdometerRollbackBounds(rows, opts)
      .filter((b) => !isRealOdometerDrop(b) && b.suspect)
      .map((b) => `${b.suspect!.date}|${b.suspect!.km}`),
  );
}

export function buildDealerOdometerReliabilityBrief(
  rows: UnifiedMileageRow[],
  opts: OdometerDropAnalysisOptions = {},
): string {
  const dealerPoints = datedKm(rows).filter((p) => isOfficialDealerLabel(p.sourceLabel));
  if (dealerPoints.length === 0) return "";
  const lines = [
    "### Oficiālā dīlera odometra rādījumi (augstākā ticamība - NEIZDOMĀ pretējo)",
    `- ${dealerPoints.length} rādījumi no OFICIĀLĀ DĪLERA DATI (OneAuto). Tie ir augstākās ticamības atskaites punkts nobraukuma vēsturē. Pretrunā ar citu avotu par atskaiti ņem dīlera rādījumu un pretrunu nosauc ar abiem skaitļiem un datumiem.`,
    "- Dīlera dokumentā rādījums var būt saglabāts no pasūtījuma atvēršanas brīža, tāpēc datums dažkārt ir vēlāks par nolasījumu. Tā nav manipulācija.",
  ];
  const last = dealerPoints[dealerPoints.length - 1]!;
  lines.push(`- Pēdējais dīlera rādījums: ${last.date}, ${formatForensicsInt(last.km)} km.`);
  const suspects = suspectKeys(rows, opts);
  for (const c of analyzeDealerOdometerConflicts(rows)) {
    // Izolēta ievades kļūda nav pretruna ar dīleri.
    if (suspects.has(`${c.otherDate}|${c.otherKm}`) || suspects.has(`${c.dealerDate}|${c.dealerKm}`)) continue;
    lines.push(
      `- Pretruna: ${c.otherSource} ${c.otherDate} rāda ${formatForensicsInt(c.otherKm)} km, bet dīleris jau ${c.dealerDate} fiksēja ${formatForensicsInt(c.dealerKm)} km (starpība ${formatForensicsInt(c.diffKm)} km). Fakts, ne pierādīta manipulācija.`,
    );
  }
  return lines.join("\n");
}

/** Visi trīs brīfi vienā blokā order-context. Tukšs, ja nav ko teikt. */
export function buildMileageForensicsBrief(payload: UnifiedMileageSourcePayload): string {
  const raw = collectUnifiedMileageRows(payload);
  if (raw.length === 0) return "";
  const opts: OdometerDropAnalysisOptions = {
    odometerReplacementNoted: ODOMETER_REPLACEMENT_RE.test(JSON.stringify(payload)),
  };
  return [
    buildMileageRateBrief(raw),
    buildSourceIndependenceBrief(raw),
    buildOdometerRollbackBoundsBrief(raw, opts),
    buildDealerOdometerReliabilityBrief(raw, opts),
  ]
    .filter(Boolean)
    .join("\n\n");
}
