/**
 * Bloks «Īpašnieki un nobraukums» (Nils 24.11.2026, makets F9 + baneri).
 *
 * Aprēķins: CSDD «Transportlīdzekļa reģistrācija» (pirmā reģ. LV + īpašnieku maiņas), iepriekšējās
 * reģistrācijas valsts, pirmā reģistrācija / izlaiduma gads + visi nobraukuma rādījumi (CSDD LV un
 * ārvalstīs, dīleris, izsoles, AutoDNA, CarVertical u.c. - vienotā nobraukuma rindas).
 *
 * - Ilgums: no maiņas līdz nākamajai maiņai (pašreizējam - līdz šodienai).
 * - Nobraukums periodā = odometrs perioda beigās - odometrs perioda sākumā. Odometru katrā maiņas
 *   datumā rēķina no VISIEM rādījumiem (arī CSDD pēdējās TA): rādījums ± 31 d. (precīzs), citādi
 *   lineāri starp tuvākajiem rādījumiem, bez rādījuma pēc datuma - pēdējais rādījums + vidējais
 *   nobraukums gadā, bez rādījuma pirms datuma - no pirmā zināmā («~»). Pašreizējam - līdz pēdējam
 *   rādījumam. «-» tikai, ja odometrs periodā samazinās vai nav atbalsta vērtību.
 * - Ārvalstu periods: no pirmās reģistrācijas (vai izlaiduma gada) līdz ievešanai Latvijā.
 *   26.11 (Nils, BMW X5): CSDD «Iepriekšējā reģistrācijas valsts» ir tikai pēdējā valsts pirms Latvijas.
 *   Valsti periodam piešķir tikai no agrākā datētā ieraksta ar šo valsti («Austrija (pierādāms no 2015)»);
 *   laiks pirms tam - «Iepriekš - valsts nav zināma». Bez neviena datēta ieraksta valsti nerāda.
 *
 * Paskaidrojumi (samazinājums, trūkstoši rādījumi, īsi periodi) blokā netiek rakstīti -
 * tie iet AI faktu lapā (`formatOwnerMileageFactLines`).
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { CsddOwnerChangeRow } from "@/lib/csdd-extended-parse";
import { isCsddFirstRegistrationInLatviaLabel } from "@/lib/csdd-extended-parse";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { countryLabelToIso2, countryNameLvLocative, normalizeCountryNameLv } from "@/lib/country-names-lv";
import {
  analyzeUnifiedMileageAnomalies,
  isListingMileageSource,
  parseOdometerKm,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rādījums, kas tuvāk par šo perioda robežai, skaitās precīzs robežas rādījums. */
export const OWNER_MILEAGE_SNAP_DAYS = 31;
/** Mazāks kritums starp blakus rādījumiem ir avotu nobīde, ne odometra samazinājums. */
export const OWNER_MILEAGE_DROP_TOLERANCE_KM = 200;
/** Īss turēšanas periods AI faktiem. */
export const OWNER_MILEAGE_SHORT_DAYS = 365;
/** Ārvalstu rādījumu robeža: ja pēdējais ir vairāk par 2 gadiem pirms ievešanas - «zināms tikai līdz». */
const ABROAD_KNOWN_GAP_MS = 2 * 365.25 * DAY_MS;

export type OwnerMileageReading = {
  t: number;
  km: number;
  /** Ārvalstu rādījums (valsts zināma un nav Latvija). */
  foreign?: boolean;
  /** Virtuāls 0 km pirmajā reģistrācijā (jauns auto). */
  origin?: boolean;
  /** Rādījuma valsts (ISO2), ja avots to tieši norāda. */
  iso?: string;
};

/** Datēts ieraksts ar avota norādītu valsti (arī bez odometra). */
export type OwnerMileageCountryRecord = { t: number; iso: string };

/** Ja valsts pierādāma ne vēlāk kā gadu pēc ārvalstu perioda sākuma - visu periodu rāda ar šo valsti. */
const ABROAD_COUNTRY_SPLIT_MIN_MS = 365 * DAY_MS;

export type OwnerMileageInput = {
  ownerEvents: readonly CsddOwnerChangeRow[];
  ownerCountLatvia?: string;
  /** Agrākā reģistrācija jebkurā valstī (ISO vai DD.MM.YYYY). */
  firstRegistration?: string;
  firstRegistrationLatvia?: string;
  modelYear?: string;
  previousRegistrationCountry?: string;
  readings: readonly OwnerMileageReading[];
  /** Datēti ieraksti ar valsti (laikjosla + avotu rindas bez km); rādījumu valstis pieskaita automātiski. */
  countryRecords?: readonly OwnerMileageCountryRecord[];
  nowMs?: number;
};

export type OwnerMileageDropFact = { fromT: number; fromKm: number; toT: number; toKm: number };

export type OwnerMileagePeriod = {
  kind: "abroad" | "owner";
  /** Īpašnieka nr. Latvijā (1..N); ārvalstīm 0. */
  n: number;
  current: boolean;
  t0: number;
  /** Beigas (pašreizējam - šodiena). */
  t1: number;
  /** Sākums zināms tikai gada precizitātē (ārvalstis pēc izlaiduma gada). */
  startYearOnly: boolean;
  /** Ilgums: kalendāra gadi/mēneši vai dienas (< 1 mēn.). */
  duration: { years: number; months: number; days?: number };
  /** Ilgums aptuvens («~7 g.»). */
  durationApprox: boolean;
  days: number;
  km: number | null;
  kmApprox: boolean;
  /** Periodā odometrs samazinājās (km = null). */
  drop: OwnerMileageDropFact | null;
  /** Odometra vērtība perioda sākumā / beigās un kā tā iegūta (AI faktiem un pārbaudei). */
  start: OwnerMileageBoundary | null;
  end: OwnerMileageBoundary | null;
  /** Ārvalstīm: valsts LV nosaukums (vai tukšs) - tikai, ja tā pierādāma visam periodam / posmam. */
  country: string;
  /** Ārvalstu posmam: valsts pierādāma tikai no šī datuma (agrākais ieraksts ar valsti). */
  countryProvenFromT?: number;
  /** Ārvalstu posms pirms pierādītās valsts - valsts nav zināma. */
  countryUnknown?: boolean;
};

export type OwnerMileageResult = {
  /** Viss ārvalstu periods (ilgums banerī, km). */
  abroad: OwnerMileagePeriod | null;
  /**
   * Ārvalstu kolonnas: viens posms (valsts pierādāma visam periodam vai nav zināma) vai divi -
   * «Iepriekš - valsts nav zināma» + «<valsts> (pierādāms no GGGG)».
   */
  abroadSegments: OwnerMileagePeriod[];
  /** CSDD iepriekšējā valsts (pēdējā pirms Latvijas), LV nosaukums vai tukšs. */
  abroadLastCountry: string;
  owners: OwnerMileagePeriod[];
  ownerCount: number;
  /** Ievešana / pirmā reģistrācija Latvijā. */
  importT: number;
  /** Lietošanas sākums (joslas kreisā mala). */
  lifeStartT: number;
  nowT: number;
  /** Pēdējā ārvalstu rādījuma laiks pirms ievešanas (null - nav). */
  lastForeignReadingT: number | null;
};

function startOfDayUtc(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseDate(raw: string | undefined | null): number {
  const t = String(raw ?? "").trim();
  if (!t) return 0;
  const ms = parseDotOrIsoDateToMs(t.replace(/\//g, "."));
  return ms > 0 ? ms : 0;
}

/** Kalendāra ilgums starp diviem datumiem: < 1 mēn. → dienas, citādi gadi + mēneši (≥ 15 d. → +1 mēn.). */
export function ownerMileageCalendarDuration(t0: number, t1: number): { years: number; months: number; days?: number } {
  const a = new Date(startOfDayUtc(t0));
  const b = new Date(startOfDayUtc(Math.max(t0, t1)));
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  const anchor = Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + months, a.getUTCDate());
  const restDays = Math.round((b.getTime() - anchor) / DAY_MS);
  if (months <= 0) {
    const days = Math.round((b.getTime() - a.getTime()) / DAY_MS);
    if (days < 28) return { years: 0, months: 0, days };
    return { years: 0, months: 1 };
  }
  if (restDays >= 15) months += 1;
  return { years: Math.floor(months / 12), months: months % 12 };
}

/** Rādījumi no vienotā nobraukuma rindām: bez sludinājumiem un bez grafika izslēgtajiem (ievades kļūdas). */
export function ownerMileageReadingsFromUnifiedRows(rows: readonly UnifiedMileageRow[]): OwnerMileageReading[] {
  if (rows.length === 0) return [];
  let exclude = new Set<number>();
  try {
    exclude = analyzeUnifiedMileageAnomalies([...rows]).chartExcludeSourceOrders;
  } catch {
    exclude = new Set();
  }
  const out: OwnerMileageReading[] = [];
  for (const r of rows) {
    if (exclude.has(r.sourceOrder)) continue;
    if (isListingMileageSource(r) || r.countryUnverified) continue;
    const t = r.sortableTime;
    if (!Number.isFinite(t) || t <= 0) continue;
    const km = parseOdometerKm(r.odometer);
    if (km == null) continue;
    const iso = r.countryInferred ? null : countryLabelToIso2(r.country ?? "");
    out.push({ t, km, foreign: iso != null && iso !== "LV", ...(iso ? { iso } : null) });
  }
  return out;
}

/** CSDD formas lauki → ievade (rādījumi atsevišķi). */
export function ownerMileageInputFromCsdd(
  csdd: CsddFormFields | null | undefined,
  readings: readonly OwnerMileageReading[],
  nowMs?: number,
  countryRecords?: readonly OwnerMileageCountryRecord[],
): OwnerMileageInput | null {
  if (!csdd) return null;
  return {
    ownerEvents: csdd.ownerRegistrationEvents ?? [],
    ownerCountLatvia: csdd.ownerCountLatvia,
    firstRegistration: csdd.firstRegistration,
    firstRegistrationLatvia: csdd.firstRegistrationLatvia,
    modelYear: csdd.modelYear,
    previousRegistrationCountry: csdd.previousRegistrationCountry,
    readings: withCsddInspectionReading(csdd, readings),
    ...(countryRecords ? { countryRecords } : null),
    nowMs,
  };
}

/**
 * CSDD «Pēdējā tehniskā apskate» odometrs ar datumu - arī rādījums (ja CSDD nobraukuma vēsturē
 * tas vēl nav, piem. API dati bez pēdējās TA rindas).
 */
export function withCsddInspectionReading(
  csdd: CsddFormFields,
  readings: readonly OwnerMileageReading[],
): OwnerMileageReading[] {
  const out = [...readings];
  const block = csdd.prevInspectionBlock;
  const km = Number(String(block?.odometer ?? "").replace(/\D/g, ""));
  const t = parseDate(block?.inspectionDateText) || parseDate(csdd.prevInspectionDate);
  if (!t || !Number.isFinite(km) || km < 100) return out;
  const dup = out.some((r) => Math.abs(r.t - t) <= 2 * DAY_MS && Math.abs(r.km - km) <= 5);
  if (!dup) out.push({ t, km });
  return out;
}

/** Kā iegūta odometra vērtība perioda robežā. */
export type OwnerMileageBoundaryMethod =
  /** Rādījums ± 31 d. no datuma (precīzs). */
  | "reading"
  /** Virtuāls 0 km (jauns auto / ārvalstu sākums). */
  | "origin"
  /** Lineāri starp tuvākajiem rādījumiem pirms un pēc datuma. */
  | "interpolated"
  /** Pēc datuma rādījumu nav - pēdējais rādījums + vidējais nobraukums gadā. */
  | "extrapolated"
  /** Pirms datuma rādījumu nav - skaitīts no pirmā zināmā rādījuma. */
  | "firstReading"
  /** Pašreizējam īpašniekam - līdz pēdējam rādījumam (nākotne netiek izdomāta). */
  | "lastReading";

export type OwnerMileageBoundary = {
  t: number;
  km: number;
  method: OwnerMileageBoundaryMethod;
  /** Rādījumu laiki, uz kuriem vērtība balstās (kritumu meklēšanai). */
  loT: number;
  hiT: number;
  /** Precīza rādījuma indekss sērijā (tikai «reading» / «origin»). */
  idx: number | null;
  /** Ekstrapolācijai: km gadā. */
  ratePerYear?: number;
  /** Interpolācijas apakšējais punkts ir virtuālais 0 km (izlaiduma gads / pirmā reģistrācija). */
  fromOrigin?: boolean;
};

const YEAR_MS = 365.25 * DAY_MS;
/** Vidējā nobraukuma logs ekstrapolācijai (pēdējie ~3 gadi). */
const EXTRAPOLATION_WINDOW_MS = 3 * YEAR_MS;
const EXTRAPOLATION_MIN_SPAN_MS = 180 * DAY_MS;

function isPreciseMethod(m: OwnerMileageBoundaryMethod): boolean {
  return m === "reading" || m === "origin";
}

/** Vidējais nobraukums gadā no pēdējiem rādījumiem (null - nevar noteikt). */
function recentRatePerYear(rs: readonly OwnerMileageReading[]): number | null {
  if (rs.length < 2) return null;
  const last = rs[rs.length - 1]!;
  let ref: OwnerMileageReading | null = null;
  for (let i = rs.length - 2; i >= 0; i--) {
    const r = rs[i]!;
    if (last.t - r.t < EXTRAPOLATION_MIN_SPAN_MS) continue;
    ref = r;
    if (last.t - r.t >= EXTRAPOLATION_WINDOW_MS) break;
  }
  if (!ref) return null;
  const rate = ((last.km - ref.km) / (last.t - ref.t)) * YEAR_MS;
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

function interpolateAt(t: number, rs: readonly OwnerMileageReading[]): OwnerMileageBoundary | null {
  let prev = -1;
  let next = -1;
  for (let i = 0; i < rs.length; i++) {
    if (rs[i]!.t <= t) prev = i;
    else if (next < 0) next = i;
  }
  if (prev >= 0 && next >= 0) {
    const a = rs[prev]!;
    const b = rs[next]!;
    const km = b.t === a.t ? a.km : a.km + ((b.km - a.km) * (t - a.t)) / (b.t - a.t);
    return { t, km, method: "interpolated", loT: a.t, hiT: b.t, idx: null, ...(a.origin ? { fromOrigin: true } : null) };
  }
  if (prev >= 0) {
    const a = rs[prev]!;
    const rate = recentRatePerYear(rs);
    if (rate == null) return null;
    return { t, km: a.km + (rate * (t - a.t)) / YEAR_MS, method: "extrapolated", loT: a.t, hiT: a.t, idx: null, ratePerYear: rate };
  }
  if (next >= 0) {
    const b = rs[next]!;
    return { t, km: b.km, method: "firstReading", loT: b.t, hiT: b.t, idx: null };
  }
  return null;
}

/**
 * Odometra vērtība katrā perioda robežā no VISIEM rādījumiem.
 * Rādījums ± 31 d. piesaistās tuvākajai robežai (viens rādījums - vienai robežai); pārējās robežas
 * interpolē starp tuvākajiem rādījumiem, bez rādījuma pēc datuma - ekstrapolē ar vidējo nobraukumu
 * gadā, bez rādījuma pirms datuma - skaita no pirmā zināmā.
 */
export function ownerMileageBoundaryValues(
  times: readonly number[],
  rs: readonly OwnerMileageReading[],
): Map<number, OwnerMileageBoundary | null> {
  const uniq = [...new Set(times)].sort((a, b) => a - b);
  const snap = OWNER_MILEAGE_SNAP_DAYS * DAY_MS;
  const nearest = new Map<number, { idx: number; dt: number }>();
  for (const t of uniq) {
    let best = -1;
    let bestDt = Infinity;
    for (let i = 0; i < rs.length; i++) {
      const dt = Math.abs(rs[i]!.t - t);
      // Vienādā attālumā - lielākais (tās pašas dienas pēdējais) rādījums.
      if (dt < bestDt || (dt === bestDt && best >= 0 && rs[i]!.km >= rs[best]!.km)) {
        bestDt = dt;
        best = i;
      }
    }
    if (best >= 0 && bestDt <= snap) nearest.set(t, { idx: best, dt: bestDt });
  }
  // Viens rādījums var būt precīzs tikai vienai robežai - tuvākajai.
  const owner = new Map<number, number>();
  for (const [t, n] of nearest) {
    const cur = owner.get(n.idx);
    if (cur == null || n.dt < nearest.get(cur)!.dt) owner.set(n.idx, t);
  }
  const out = new Map<number, OwnerMileageBoundary | null>();
  for (const t of uniq) {
    const n = nearest.get(t);
    if (n && owner.get(n.idx) === t) {
      const r = rs[n.idx]!;
      out.set(t, { t, km: r.km, method: r.origin ? "origin" : "reading", loT: r.t, hiT: r.t, idx: n.idx });
    } else {
      out.set(t, interpolateAt(t, rs));
    }
  }
  return out;
}

function findDrop(rs: readonly OwnerMileageReading[], loT: number, hiT: number): OwnerMileageDropFact | null {
  const inRange = rs.filter((r) => r.t >= loT && r.t <= hiT);
  let worst: OwnerMileageDropFact | null = null;
  for (let i = 1; i < inRange.length; i++) {
    const a = inRange[i - 1]!;
    const b = inRange[i]!;
    // Tajā pašā dienā secība nav zināma - salīdzina ar dienas lielāko.
    const prevMax = Math.max(...inRange.slice(0, i).map((r) => r.km));
    if (b.km < prevMax - OWNER_MILEAGE_DROP_TOLERANCE_KM) {
      const from = inRange.slice(0, i).reduce((m, r) => (r.km >= m.km ? r : m), a);
      const d = { fromT: from.t, fromKm: from.km, toT: b.t, toKm: b.km };
      if (!worst || d.fromKm - d.toKm > worst.fromKm - worst.toKm) worst = d;
    }
  }
  return worst;
}

type PeriodKm = {
  km: number | null;
  approx: boolean;
  drop: OwnerMileageDropFact | null;
  start: OwnerMileageBoundary | null;
  end: OwnerMileageBoundary | null;
};

function periodKm(
  a: OwnerMileageBoundary | null,
  bClosed: OwnerMileageBoundary | null,
  open: boolean,
  rs: readonly OwnerMileageReading[],
): PeriodKm {
  let b: OwnerMileageBoundary | null = bClosed;
  if (open) {
    // Pašreizējais īpašnieks: līdz pēdējam rādījumam pēc perioda sākuma (nākotni neizdomā).
    const last = rs.length ? rs[rs.length - 1]! : null;
    const lastIdx = rs.length - 1;
    b =
      a && last && last.t > a.t && lastIdx !== a.idx && !(a.idx != null && last.t <= a.hiT)
        ? { t: last.t, km: last.km, method: "lastReading", loT: last.t, hiT: last.t, idx: lastIdx }
        : null;
  }
  const none = { km: null, approx: false, drop: null, start: a, end: b };
  if (!a || !b) return none;
  // «No pirmā zināmā» abās robežās - atbalsta vērtības nav.
  if (a.method === "firstReading" && b.method === "firstReading") return none;
  if (a.idx != null && a.idx === b.idx) return none;
  const drop = findDrop(rs, Math.min(a.loT, b.loT), Math.max(a.hiT, b.hiT));
  if (drop) return { ...none, drop };
  const diff = b.km - a.km;
  if (diff < 0) return none;
  // Pašreizējam īpašniekam km ir līdz pēdējam rādījumam, ne līdz šodienai - vienmēr «~».
  const approx = open || !isPreciseMethod(a.method) || !isPreciseMethod(b.method);
  return { km: approx ? Math.round(diff / 10) * 10 : Math.round(diff), approx, drop: null, start: a, end: b };
}

function ownerEventTimes(events: readonly CsddOwnerChangeRow[]): number[] {
  const ts = events
    .filter((e) => e.date.trim())
    .map((e) => parseDate(e.date))
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
  return ts;
}

function parseOwnerCount(raw: string | undefined): number | null {
  const m = String(raw ?? "").match(/\d{1,2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return n > 0 ? n : null;
}

function cleanAbroadCountry(raw: string | undefined): string {
  const v = String(raw ?? "")
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, "")
    .trim();
  if (!v) return "";
  const iso = countryLabelToIso2(v);
  if (iso === "LV") return "";
  if (iso) return normalizeCountryNameLv(v);
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

/**
 * Agrākais datētais ieraksts ar CSDD iepriekšējo valsti pirms ievešanas, pēc kura auto nav fiksēts
 * citā ārvalstī. 0 - valsts nav pierādāma (nav neviena datēta ieraksta ar šo valsti).
 */
function abroadCountryProvenFrom(
  input: OwnerMileageInput,
  readings: readonly OwnerMileageReading[],
  country: string,
  abroadStartT: number,
  importT: number,
): number {
  const lastIso = countryLabelToIso2(country);
  if (!lastIso || lastIso === "LV") return 0;
  const recs: OwnerMileageCountryRecord[] = [
    ...(input.countryRecords ?? []),
    ...readings.filter((r) => r.iso && !r.origin).map((r) => ({ t: r.t, iso: r.iso! })),
  ].filter((r) => r.t > 0 && r.t < importT + OWNER_MILEAGE_SNAP_DAYS * DAY_MS && r.iso && r.iso !== "LV");
  const lastOtherT = recs.filter((r) => r.iso !== lastIso).reduce((m, r) => Math.max(m, r.t), 0);
  const known = recs.filter((r) => r.iso === lastIso && r.t > lastOtherT && r.t < importT);
  if (known.length === 0) return 0;
  return Math.max(abroadStartT, Math.min(...known.map((r) => r.t)));
}

/** Galvenais aprēķins. null - nav neviena īpašnieku maiņas datuma. */
export function buildOwnerMileagePeriods(input: OwnerMileageInput): OwnerMileageResult | null {
  const nowT = startOfDayUtc(input.nowMs ?? Date.now());
  const evTs = ownerEventTimes(input.ownerEvents);
  const firstLvEvent = input.ownerEvents.find((e) => e.date.trim() && isCsddFirstRegistrationInLatviaLabel(e.label));
  const importT =
    parseDate(firstLvEvent?.date) || evTs[0] || parseDate(input.firstRegistrationLatvia) || 0;
  const countParsed = parseOwnerCount(input.ownerCountLatvia);
  // Bez īpašnieku datumiem periodu nav (skaits jau ir kopsavilkuma kartītē).
  if (evTs.length === 0 || !importT) return null;

  const readings = [...input.readings]
    .filter((r) => Number.isFinite(r.t) && r.t > 0 && r.t <= nowT + DAY_MS && Number.isFinite(r.km))
    .sort((a, b) => a.t - b.t || a.km - b.km);

  // Ārvalstu periods.
  const country = cleanAbroadCountry(input.previousRegistrationCountry);
  const firstRegT = parseDate(input.firstRegistration);
  const yearM = String(input.modelYear ?? "").match(/\b(19|20)\d{2}\b/);
  const modelYear = yearM ? Number(yearM[0]) : null;
  const foreignBefore = readings.filter((r) => r.foreign && r.t < importT + OWNER_MILEAGE_SNAP_DAYS * DAY_MS);
  const firstRegAbroad = firstRegT > 0 && importT > 0 && firstRegT < importT - 60 * DAY_MS;
  const hasAbroad = importT > 0 && (Boolean(country) || firstRegAbroad || foreignBefore.length > 0);
  let abroadStartT = 0;
  let startYearOnly = false;
  if (hasAbroad) {
    if (firstRegAbroad) abroadStartT = firstRegT;
    else if (modelYear && Date.UTC(modelYear, 6, 1) < importT) {
      abroadStartT = Date.UTC(modelYear, 6, 1);
      startYearOnly = true;
    }
  }
  // Jauns auto Latvijā: pirmais īpašnieks sāk no 0 km.
  const newInLatvia = !hasAbroad && importT > 0 && (!firstRegT || Math.abs(firstRegT - importT) <= 60 * DAY_MS);
  const lifeStartT = abroadStartT || importT;
  const series: OwnerMileageReading[] = [...readings];
  if (abroadStartT || newInLatvia) {
    const originT = abroadStartT || importT;
    if (!series.some((r) => r.t <= originT)) series.unshift({ t: originT, km: 0, origin: true });
  }

  const provenFromT = hasAbroad && abroadStartT ? abroadCountryProvenFrom(input, readings, country, abroadStartT, importT) : 0;
  const splitT = provenFromT && provenFromT - abroadStartT > ABROAD_COUNTRY_SPLIT_MIN_MS ? provenFromT : 0;

  const bv = ownerMileageBoundaryValues(
    [...(hasAbroad && abroadStartT ? [abroadStartT, importT, ...(splitT ? [splitT] : [])] : []), ...evTs],
    series,
  );

  let abroad: OwnerMileagePeriod | null = null;
  const abroadSegments: OwnerMileagePeriod[] = [];
  if (hasAbroad && abroadStartT) {
    const k = periodKm(bv.get(abroadStartT) ?? null, bv.get(importT) ?? null, false, series);
    const duration = startYearOnly
      ? { years: Math.max(1, Math.round((importT - abroadStartT) / (365.25 * DAY_MS))), months: 0 }
      : ownerMileageCalendarDuration(abroadStartT, importT);
    abroad = {
      kind: "abroad",
      n: 0,
      current: false,
      t0: abroadStartT,
      t1: importT,
      startYearOnly,
      duration,
      durationApprox: startYearOnly,
      days: Math.round((importT - abroadStartT) / DAY_MS),
      km: k.km,
      kmApprox: k.approx,
      drop: k.drop,
      start: k.start,
      end: k.end,
      // Visam periodam valsti rāda tikai, ja tā pierādāma kopš perioda sākuma.
      country: provenFromT && !splitT ? country : "",
    };
    if (splitT) {
      const segment = (t0: number, t1: number, extra: Partial<OwnerMileagePeriod>): OwnerMileagePeriod => {
        const sk = periodKm(bv.get(t0) ?? null, bv.get(t1) ?? null, false, series);
        const yearOnly = startYearOnly && t0 === abroadStartT;
        return {
          ...abroad!,
          t0,
          t1,
          startYearOnly: yearOnly,
          duration: yearOnly
            ? { years: Math.max(1, Math.round((t1 - t0) / (365.25 * DAY_MS))), months: 0 }
            : ownerMileageCalendarDuration(t0, t1),
          durationApprox: yearOnly,
          days: Math.round((t1 - t0) / DAY_MS),
          km: sk.km,
          kmApprox: sk.approx,
          drop: sk.drop,
          start: sk.start,
          end: sk.end,
          country: "",
          ...extra,
        };
      };
      abroadSegments.push(segment(abroadStartT, splitT, { countryUnknown: true }));
      abroadSegments.push(segment(splitT, importT, { country, countryProvenFromT: splitT }));
    } else {
      abroadSegments.push(abroad);
    }
  }

  const owners: OwnerMileagePeriod[] = [];
  for (let i = 0; i < evTs.length; i++) {
    const t0 = evTs[i]!;
    const isLast = i === evTs.length - 1;
    const t1 = isLast ? nowT : evTs[i + 1]!;
    const k = periodKm(bv.get(t0) ?? null, isLast ? null : (bv.get(t1) ?? null), isLast, series);
    owners.push({
      kind: "owner",
      n: i + 1,
      current: isLast,
      t0,
      t1,
      startYearOnly: false,
      duration: ownerMileageCalendarDuration(t0, t1),
      durationApprox: false,
      days: Math.round((t1 - t0) / DAY_MS),
      km: k.km,
      kmApprox: k.approx,
      drop: k.drop,
      start: k.start,
      end: k.end,
      country: "",
    });
  }

  const lastForeign = foreignBefore.length ? foreignBefore[foreignBefore.length - 1]!.t : null;
  return {
    abroad,
    abroadSegments,
    abroadLastCountry: country,
    owners,
    ownerCount: countParsed ?? owners.length,
    importT,
    lifeStartT: lifeStartT || (owners[0]?.t0 ?? nowT),
    nowT,
    lastForeignReadingT: lastForeign,
  };
}

/** Kolonnu skaits rindā: ≤ 5, rindas vienādi piepildītas (10 → 5+5, 6 → 3+3, 7 → 4+3). */
export function ownerMileageColumns(n: number): number {
  if (n <= 0) return 1;
  const rows = Math.ceil(n / 5);
  return Math.ceil(n / rows);
}

/* ---------------- AI fakti ---------------- */

function fmtDate(t: number): string {
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function fmtKm(n: number): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}

function fmtDurLv(p: OwnerMileagePeriod): string {
  const d = p.duration;
  if (d.days != null) return `${d.days} d.`;
  return [d.years ? `${d.years} g.` : "", d.months ? `${d.months} mēn.` : ""].filter(Boolean).join(" ") || "0 mēn.";
}

function ordList(ns: number[]): string {
  if (ns.length === 1) return `${ns[0]}.`;
  return `${ns
    .slice(0, -1)
    .map((n) => `${n}.`)
    .join(", ")} un ${ns[ns.length - 1]}.`;
}

export type OwnerMileageApproxFact = { who: string; start: string; end: string };

export type OwnerMileageFacts = {
  /** Periodi ar «~» km un kā robežas aprēķinātas. */
  approx: OwnerMileageApproxFact[];
  drops: { who: string; drop: OwnerMileageDropFact }[];
  missing: number[];
  currentWithoutReading: boolean;
  short: OwnerMileagePeriod[];
  abroadKnownUntilYear: number | null;
  abroadWithoutReadings: boolean;
};

function boundaryHowLv(b: OwnerMileageBoundary | null): string {
  if (!b) return "nav";
  switch (b.method) {
    case "reading":
      return `rādījums ${fmtDate(b.loT)}`;
    case "origin":
      return "0 km (jauns)";
    case "interpolated":
      return b.fromOrigin
        ? `interpolēts starp 0 km (${new Date(b.loT).getUTCFullYear()}) un rādījumu ${fmtDate(b.hiT)}`
        : `interpolēts starp rādījumiem ${fmtDate(b.loT)} un ${fmtDate(b.hiT)}`;
    case "extrapolated":
      return `ekstrapolēts no ${fmtDate(b.loT)} ar ~${fmtKm(Math.round((b.ratePerYear ?? 0) / 100) * 100)} gadā`;
    case "firstReading":
      return `no pirmā zināmā rādījuma ${fmtDate(b.loT)}`;
    case "lastReading":
      return `līdz pēdējam rādījumam ${fmtDate(b.loT)}`;
  }
}

export function collectOwnerMileageFacts(r: OwnerMileageResult): OwnerMileageFacts {
  const drops: OwnerMileageFacts["drops"] = [];
  if (r.abroad?.drop) drops.push({ who: "ārvalstu periodā / ievešanas brīdī", drop: r.abroad.drop });
  for (const o of r.owners) if (o.drop) drops.push({ who: `${o.n}. īpašnieka periodā`, drop: o.drop });
  // Viens un tas pats kritums var skart divus blakus periodus - min vienreiz.
  const uniq = drops.filter(
    (d, i) => drops.findIndex((x) => x.drop.fromT === d.drop.fromT && x.drop.toT === d.drop.toT) === i,
  );
  const missing = r.owners.filter((o) => o.km == null && !o.drop && !o.current).map((o) => o.n);
  const cur = r.owners.find((o) => o.current);
  const short = r.owners.filter((o) => !o.current && o.days < OWNER_MILEAGE_SHORT_DAYS);
  let abroadKnownUntilYear: number | null = null;
  let abroadWithoutReadings = false;
  if (r.abroad) {
    if (r.lastForeignReadingT == null) abroadWithoutReadings = true;
    else if (r.importT - r.lastForeignReadingT > ABROAD_KNOWN_GAP_MS) {
      abroadKnownUntilYear = new Date(r.lastForeignReadingT).getUTCFullYear();
    }
  }
  const approx: OwnerMileageApproxFact[] = [];
  for (const p of [r.abroad, ...r.owners]) {
    if (!p || p.km == null || !p.kmApprox) continue;
    approx.push({
      who: p.kind === "abroad" ? "ārvalstu periods" : `${p.n}. īpašnieks`,
      start: boundaryHowLv(p.start),
      end: boundaryHowLv(p.end),
    });
  }
  return {
    approx,
    drops: uniq,
    missing,
    currentWithoutReading: Boolean(cur && cur.km == null && !cur.drop),
    short,
    abroadKnownUntilYear,
    abroadWithoutReadings,
  };
}

/** Ārvalstu perioda valsts AI faktiem: kas pierādāms un kas nav (nekad visu periodu vienai valstij bez ieraksta). */
function formatAbroadCountryFactLine(r: OwnerMileageResult): string {
  if (!r.abroad || !r.abroadLastCountry) return "";
  const last = r.abroadLastCountry;
  const lastLoc = countryNameLvLocative(last) || last;
  const proven = r.abroadSegments.find((p) => p.countryProvenFromT);
  if (proven) {
    return `- Ārvalstu valsts: ${last} pierādāma tikai no ${fmtDate(proven.countryProvenFromT!)} (agrākais ieraksts ar šo valsti) līdz ievešanai; laikā pirms tam valsts nav zināma - NERAKSTĪT, ka auto visu ārvalstu laiku bijis ${lastLoc} vai tur pirmo reizi reģistrēts`;
  }
  if (r.abroad.country) return "";
  return `- Ārvalstu valsts: CSDD iepriekšējā valsts ${last} ir tikai pēdējā valsts pirms Latvijas; datētu ierakstu ar šo valsti nav - NERAKSTĪT, cik ilgi auto bijis ${lastLoc} vai ka tur pirmo reizi reģistrēts`;
}

/**
 * AI faktu lapas rindas. Blokā šie paskaidrojumi netiek rakstīti, tāpēc komentāram tie jāpiemin.
 * Tukšs masīvs - nav ko pieminēt.
 */
export function formatOwnerMileageFactLines(r: OwnerMileageResult | null): string[] {
  if (!r || (r.owners.length === 0 && !r.abroad)) return [];
  const lines: string[] = [];
  const m = (t: number) => {
    const d = new Date(t);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  };
  const kmBit = (p: OwnerMileagePeriod) => (p.km != null ? `${p.kmApprox ? "~" : ""}${fmtKm(p.km)}` : "km -");
  const periods = [
    ...(r.abroad
      ? [
          `ārvalstīs${r.abroad.country ? ` (${r.abroad.country})` : ""} ${r.abroad.startYearOnly ? new Date(r.abroad.t0).getUTCFullYear() : m(r.abroad.t0)}-${fmtDate(r.abroad.t1)} ${r.abroad.durationApprox ? "~" : ""}${fmtDurLv(r.abroad)} ${kmBit(r.abroad)}`,
        ]
      : []),
    ...r.owners.map((o) => `${o.n}) ${m(o.t0)}-${o.current ? "šodien" : m(o.t1)} ${fmtDurLv(o)} ${kmBit(o)}`),
  ];
  lines.push(`- Periodi: ${periods.join("; ")}`);
  const abroadCountryLine = formatAbroadCountryFactLine(r);
  if (abroadCountryLine) lines.push(abroadCountryLine);
  const f = collectOwnerMileageFacts(r);
  for (const d of f.drops) {
    lines.push(
      `- Odometrs samazinājās ${d.who}: ${fmtDate(d.drop.fromT)} ${fmtKm(d.drop.fromKm)} → ${fmtDate(d.drop.toT)} ${fmtKm(d.drop.toKm)} (par ${fmtKm(d.drop.fromKm - d.drop.toKm)}); blokā šim periodam km nav rādīts`,
    );
  }
  if (f.approx.length) {
    lines.push(
      `- Aptuveni aprēķināts nobraukums («~», pēc visiem pieejamajiem rādījumiem): ${f.approx
        .map((a) => `${a.who} (sākums: ${a.start}; beigas: ${a.end})`)
        .join("; ")}`,
    );
  }
  if (f.missing.length) {
    lines.push(
      f.missing.length === 1
        ? `- Nobraukums nav nosakāms ${f.missing[0]}. īpašnieka periodā (nav odometra rādījumu, uz kuriem balstīt aprēķinu)`
        : `- Nobraukums nav nosakāms ${ordList(f.missing)} īpašnieka periodos (nav odometra rādījumu, uz kuriem balstīt aprēķinu)`,
    );
  }
  if (f.currentWithoutReading) {
    lines.push("- Pašreizējam īpašniekam pēc maiņas vēl nav odometra rādījuma");
  }
  if (f.short.length) {
    lines.push(
      `- Īsi turēšanas periodi (mazāk par gadu): ${f.short.map((o) => `${o.n}. īpašnieks ${fmtDurLv(o)}`).join(", ")}`,
    );
  }
  if (f.abroadKnownUntilYear != null) {
    lines.push(
      `- Ārvalstu nobraukums zināms tikai līdz ${f.abroadKnownUntilYear}. gadam; ievešanas brīža km - pēc pirmā rādījuma Latvijā`,
    );
  } else if (f.abroadWithoutReadings && r.abroad) {
    lines.push("- Ārvalstu periodā odometra rādījumu nav; ārvalstu km noteikts pēc pirmā rādījuma Latvijā");
  }
  return lines;
}
