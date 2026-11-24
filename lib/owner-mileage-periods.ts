/**
 * Bloks «Īpašnieki un nobraukums» (Nils 24.11.2026, makets F9 + baneri).
 *
 * Aprēķins: CSDD «Transportlīdzekļa reģistrācija» (pirmā reģ. LV + īpašnieku maiņas), iepriekšējās
 * reģistrācijas valsts, pirmā reģistrācija / izlaiduma gads + visi nobraukuma rādījumi (CSDD LV un
 * ārvalstīs, dīleris, izsoles, AutoDNA, CarVertical u.c. - vienotā nobraukuma rindas).
 *
 * - Ilgums: no maiņas līdz nākamajai maiņai (pašreizējam - līdz šodienai).
 * - Nobraukums periodā: rādījums perioda sākumā/beigās (± 31 d.) vai lineāri interpolēts starp
 *   tuvākajiem rādījumiem («~»). Ja to nevar noteikt vai odometrs periodā samazinājies - null («-»).
 * - Ārvalstu periods: no pirmās reģistrācijas (vai izlaiduma gada) līdz ievešanai Latvijā.
 *
 * Paskaidrojumi (samazinājums, trūkstoši rādījumi, īsi periodi) blokā netiek rakstīti -
 * tie iet AI faktu lapā (`formatOwnerMileageFactLines`).
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { CsddOwnerChangeRow } from "@/lib/csdd-extended-parse";
import { isCsddFirstRegistrationInLatviaLabel } from "@/lib/csdd-extended-parse";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
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
};

export type OwnerMileageInput = {
  ownerEvents: readonly CsddOwnerChangeRow[];
  ownerCountLatvia?: string;
  /** Agrākā reģistrācija jebkurā valstī (ISO vai DD.MM.YYYY). */
  firstRegistration?: string;
  firstRegistrationLatvia?: string;
  modelYear?: string;
  previousRegistrationCountry?: string;
  readings: readonly OwnerMileageReading[];
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
  /** Ārvalstīm: valsts LV nosaukums (vai tukšs). */
  country: string;
};

export type OwnerMileageResult = {
  abroad: OwnerMileagePeriod | null;
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
    out.push({ t, km, foreign: iso != null && iso !== "LV" });
  }
  return out;
}

/** CSDD formas lauki → ievade (rādījumi atsevišķi). */
export function ownerMileageInputFromCsdd(
  csdd: CsddFormFields | null | undefined,
  readings: readonly OwnerMileageReading[],
  nowMs?: number,
): OwnerMileageInput | null {
  if (!csdd) return null;
  return {
    ownerEvents: csdd.ownerRegistrationEvents ?? [],
    ownerCountLatvia: csdd.ownerCountLatvia,
    firstRegistration: csdd.firstRegistration,
    firstRegistrationLatvia: csdd.firstRegistrationLatvia,
    modelYear: csdd.modelYear,
    previousRegistrationCountry: csdd.previousRegistrationCountry,
    readings,
    nowMs,
  };
}

type KmPoint = { km: number; approx: boolean; loT: number; hiT: number; idx: number | null };

function kmAt(t: number, rs: readonly OwnerMileageReading[]): KmPoint | null {
  if (rs.length === 0) return null;
  let best = -1;
  let bestDt = Infinity;
  for (let i = 0; i < rs.length; i++) {
    const dt = Math.abs(rs[i]!.t - t);
    if (dt < bestDt) {
      bestDt = dt;
      best = i;
    }
  }
  if (best >= 0 && bestDt <= OWNER_MILEAGE_SNAP_DAYS * DAY_MS) {
    const r = rs[best]!;
    return { km: r.km, approx: false, loT: r.t, hiT: r.t, idx: best };
  }
  let prev = -1;
  let next = -1;
  for (let i = 0; i < rs.length; i++) {
    if (rs[i]!.t < t) prev = i;
    else if (rs[i]!.t > t && next < 0) next = i;
  }
  if (prev < 0 || next < 0) return null;
  const a = rs[prev]!;
  const b = rs[next]!;
  const km = a.km + ((b.km - a.km) * (t - a.t)) / (b.t - a.t);
  return { km, approx: true, loT: a.t, hiT: b.t, idx: null };
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

function periodKm(
  t0: number,
  t1: number,
  open: boolean,
  rs: readonly OwnerMileageReading[],
): { km: number | null; approx: boolean; drop: OwnerMileageDropFact | null } {
  const a = kmAt(t0, rs);
  let b: KmPoint | null;
  if (open) {
    const after = rs.filter((r) => r.t > t0);
    const last = after.length ? after[after.length - 1]! : null;
    const lastIdx = last ? rs.lastIndexOf(last) : -1;
    b = last && lastIdx !== a?.idx ? { km: last.km, approx: true, loT: last.t, hiT: last.t, idx: lastIdx } : null;
  } else {
    b = kmAt(t1, rs);
  }
  if (!a || !b) return { km: null, approx: false, drop: null };
  const drop = findDrop(rs, Math.min(a.loT, b.loT), Math.max(a.hiT, b.hiT));
  if (drop) return { km: null, approx: false, drop };
  if (a.idx != null && a.idx === b.idx) return { km: null, approx: false, drop: null };
  const diff = b.km - a.km;
  if (diff < 0) return { km: null, approx: false, drop: null };
  const approx = a.approx || b.approx;
  return { km: approx ? Math.round(diff / 10) * 10 : Math.round(diff), approx, drop: null };
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

  let abroad: OwnerMileagePeriod | null = null;
  if (hasAbroad && abroadStartT) {
    const k = periodKm(abroadStartT, importT, false, series);
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
      country,
    };
  }

  const owners: OwnerMileagePeriod[] = [];
  for (let i = 0; i < evTs.length; i++) {
    const t0 = evTs[i]!;
    const isLast = i === evTs.length - 1;
    const t1 = isLast ? nowT : evTs[i + 1]!;
    const k = periodKm(t0, t1, isLast, series);
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
      country: "",
    });
  }

  const lastForeign = foreignBefore.length ? foreignBefore[foreignBefore.length - 1]!.t : null;
  return {
    abroad,
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

export type OwnerMileageFacts = {
  drops: { who: string; drop: OwnerMileageDropFact }[];
  missing: number[];
  currentWithoutReading: boolean;
  short: OwnerMileagePeriod[];
  abroadKnownUntilYear: number | null;
  abroadWithoutReadings: boolean;
};

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
  return {
    drops: uniq,
    missing,
    currentWithoutReading: Boolean(cur && cur.km == null && !cur.drop),
    short,
    abroadKnownUntilYear,
    abroadWithoutReadings,
  };
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
  const f = collectOwnerMileageFacts(r);
  for (const d of f.drops) {
    lines.push(
      `- Odometrs samazinājās ${d.who}: ${fmtDate(d.drop.fromT)} ${fmtKm(d.drop.fromKm)} → ${fmtDate(d.drop.toT)} ${fmtKm(d.drop.toKm)} (par ${fmtKm(d.drop.fromKm - d.drop.toKm)}); blokā šim periodam km nav rādīts`,
    );
  }
  if (f.missing.length) {
    lines.push(
      f.missing.length === 1
        ? `- Nobraukums nav nosakāms ${f.missing[0]}. īpašnieka periodā (trūkst odometra rādījuma perioda sākumā vai beigās)`
        : `- Nobraukums nav nosakāms ${ordList(f.missing)} īpašnieka periodos (trūkst odometra rādījumu perioda sākumā vai beigās)`,
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
