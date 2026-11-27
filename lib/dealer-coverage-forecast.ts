/**
 * Dīlera datu pārklājuma prognoze (Nila «jā» 27.11.2026): cik ticams, ka OneAuto / CheckThisReg /
 * auto-records.com dos servisa vēsturi konkrētai markai un gadu grupai.
 *
 * Bāze - statiska tabula no izpētes 27.11 (tikai agregāti: ar_datiem/kopā pa avotiem, markām un
 * gadu grupām; nekādu VIN). Dinamiskā daļa - Blob agregāts (lib/dealer-coverage-store.ts), ko papildina
 * katra pabeigta dīlera ielase; abas saskaita kopā.
 *
 * Formula: p = (ar_datiem + 4·p₀) / (kopā + 4). Markai p₀ = avota kopējais trāpījums, gadu grupai
 * p₀ = markas izlīdzinātais p. Sliekšņi: augsta ≥75%, vidēja 45-74%, zema <45%,
 * «nav zināms» - <2 novērojumi markai šajā avotā.
 *
 * Tīrs modulis (bez server-only) - lieto gan UI, gan serveris.
 */

import { vinModelYears } from "@/lib/vin-decode";

export const DEALER_FORECAST_SOURCES = ["oneauto", "checkthisreg", "autorecords"] as const;
export type DealerForecastSource = (typeof DEALER_FORECAST_SOURCES)[number];

export const DEALER_FORECAST_SOURCE_LABEL: Record<DealerForecastSource, string> = {
  oneauto: "OneAuto",
  checkthisreg: "CheckThisReg",
  autorecords: "auto-records",
};

export const DEALER_FORECAST_YEAR_GROUPS = ["le2012", "2013-2016", "2017-2019", "2020+"] as const;
export type DealerForecastYearGroup = (typeof DEALER_FORECAST_YEAR_GROUPS)[number];

export const DEALER_FORECAST_YEAR_GROUP_LABEL: Record<DealerForecastYearGroup, string> = {
  le2012: "≤2012",
  "2013-2016": "2013-2016",
  "2017-2019": "2017-2019",
  "2020+": "2020+",
};

export type DealerForecastLevel = "augsta" | "vidēja" | "zema" | "nav zināms";

/** [ar_datiem, kopā] */
export type DealerCoverageCell = readonly [number, number];
type SourceCells = Partial<Record<DealerForecastSource, DealerCoverageCell>>;
type MakeStats = { all: SourceCells; years?: Partial<Record<DealerForecastYearGroup, SourceCells>> };

/** Avota kopējais trāpījums izpētē (visas markas, arī «Cita»): p₀. */
export const DEALER_FORECAST_STATIC_TOTALS: Record<DealerForecastSource, DealerCoverageCell> = {
  oneauto: [159, 242],
  checkthisreg: [43, 59],
  autorecords: [47, 60],
};

/** Izpēte 27.11.2026 (uzdevumi/dilera-parklajums-prognoze-2026-11-27.csv): [ar_datiem, kopā]. */
export const DEALER_FORECAST_STATIC: Readonly<Record<string, MakeStats>> = {
  "BMW": { all: { oneauto: [66, 68], checkthisreg: [20, 20], autorecords: [24, 24] }, years: { "le2012": { oneauto: [24, 24], checkthisreg: [1, 1], autorecords: [8, 8] }, "2013-2016": { oneauto: [12, 12], checkthisreg: [1, 1], autorecords: [3, 3] }, "2017-2019": { oneauto: [7, 8], checkthisreg: [1, 1], autorecords: [1, 1] }, "2020+": { oneauto: [7, 7], checkthisreg: [1, 1], autorecords: [1, 1] } } },
  "Audi": { all: { oneauto: [14, 37], checkthisreg: [4, 12], autorecords: [1, 7] }, years: { "le2012": { oneauto: [0, 12], checkthisreg: [0, 1], autorecords: [0, 2] }, "2013-2016": { oneauto: [4, 13], checkthisreg: [1, 8], autorecords: [0, 4] }, "2017-2019": { oneauto: [4, 5], checkthisreg: [1, 1] }, "2020+": { oneauto: [6, 7], checkthisreg: [2, 2], autorecords: [1, 1] } } },
  "Mercedes-Benz": { all: { oneauto: [22, 29], checkthisreg: [4, 7], autorecords: [9, 13] }, years: { "le2012": { oneauto: [8, 10], autorecords: [0, 1] }, "2013-2016": { oneauto: [3, 3], autorecords: [3, 4] }, "2017-2019": { oneauto: [2, 2] }, "2020+": { oneauto: [1, 1] } } },
  "Volkswagen": { all: { oneauto: [14, 26], checkthisreg: [5, 6], autorecords: [4, 5] }, years: { "le2012": { oneauto: [1, 7] }, "2013-2016": { oneauto: [2, 8], checkthisreg: [0, 1], autorecords: [0, 1] }, "2017-2019": { oneauto: [5, 5], checkthisreg: [2, 2], autorecords: [1, 1] }, "2020+": { oneauto: [6, 6], checkthisreg: [3, 3], autorecords: [3, 3] } } },
  "Volvo": { all: { oneauto: [5, 19], autorecords: [7, 8] }, years: { "le2012": { oneauto: [1, 5], autorecords: [2, 2] }, "2013-2016": { oneauto: [4, 6], autorecords: [1, 1] }, "2017-2019": { oneauto: [0, 2], autorecords: [3, 4] }, "2020+": { oneauto: [0, 6], autorecords: [1, 1] } } },
  "Skoda": { all: { oneauto: [7, 8], checkthisreg: [4, 4] }, years: { "le2012": { oneauto: [0, 1] }, "2013-2016": { oneauto: [1, 1] }, "2017-2019": { oneauto: [1, 1], checkthisreg: [1, 1] }, "2020+": { oneauto: [5, 5], checkthisreg: [3, 3] } } },
  "Opel": { all: { oneauto: [6, 7], checkthisreg: [0, 1], autorecords: [2, 3] }, years: { "le2012": { oneauto: [3, 3] }, "2017-2019": { oneauto: [1, 2], checkthisreg: [0, 1], autorecords: [1, 2] }, "2020+": { oneauto: [2, 2], autorecords: [1, 1] } } },
  "Toyota": { all: { oneauto: [5, 7] }, years: { "2013-2016": { oneauto: [2, 2] }, "2020+": { oneauto: [2, 2] } } },
  "Kia": { all: { oneauto: [5, 6] }, years: { "2017-2019": { oneauto: [1, 1] }, "2020+": { oneauto: [1, 1] } } },
  "Renault": { all: { oneauto: [3, 5], checkthisreg: [3, 3] }, years: { "le2012": { oneauto: [0, 1], checkthisreg: [1, 1] }, "2020+": { oneauto: [0, 1], checkthisreg: [1, 1] } } },
  "Tesla": { all: { oneauto: [0, 4] }, years: { "2017-2019": { oneauto: [0, 1] } } },
  "Porsche": { all: { oneauto: [3, 4] }, years: { "le2012": { oneauto: [1, 1] }, "2013-2016": { oneauto: [0, 1] }, "2020+": { oneauto: [2, 2] } } },
  "Ford": { all: { oneauto: [0, 3] }, years: { "le2012": { oneauto: [0, 2] }, "2020+": { oneauto: [0, 1] } } },
  "Peugeot": { all: { oneauto: [3, 3] }, years: { "2017-2019": { oneauto: [1, 1] }, "2020+": { oneauto: [1, 1] } } },
  "Jeep": { all: { oneauto: [2, 2] }, years: { "le2012": { oneauto: [1, 1] }, "2013-2016": { oneauto: [1, 1] } } },
  "Mitsubishi": { all: { oneauto: [0, 2] }, years: { "2013-2016": { oneauto: [0, 2] } } },
  "Hyundai": { all: { oneauto: [0, 2] } },
  "SEAT": { all: { checkthisreg: [2, 2] }, years: { "2017-2019": { checkthisreg: [1, 1] }, "2020+": { checkthisreg: [1, 1] } } },
  "Smart": { all: { checkthisreg: [0, 2] } },
  "Mazda": { all: { oneauto: [1, 1] }, years: { "2013-2016": { oneauto: [1, 1] } } },
  "Lexus": { all: { oneauto: [0, 1] } },
  "Isuzu": { all: { oneauto: [0, 1] }, years: { "2017-2019": { oneauto: [0, 1] } } },
  "Jaguar": { all: { oneauto: [1, 1] }, years: { "2017-2019": { oneauto: [1, 1] } } },
  "Land Rover": { all: { checkthisreg: [1, 1] }, years: { "2013-2016": { checkthisreg: [1, 1] } } },
  "Honda": { all: { oneauto: [0, 1], checkthisreg: [0, 1] }, years: { "2013-2016": { oneauto: [0, 1], checkthisreg: [0, 1] } } },
  "Nissan": { all: { oneauto: [1, 1] } },
  "MAN": { all: { oneauto: [0, 1] } },
  "Alfa Romeo": { all: { oneauto: [1, 1] }, years: { "2017-2019": { oneauto: [1, 1] } } },
  "Iveco": { all: { oneauto: [0, 1] }, years: { "2020+": { oneauto: [0, 1] } } },
};

/* ---------------- Markas normalizācija ---------------- */

/** Markas aizstājvārdi (lielie burti, bez diakritikas, vārdu virknes) -> tabulas nosaukums. */
const MAKE_ALIASES: ReadonlyArray<readonly [string, readonly (readonly string[])[]]> = [
  ["BMW", [["BMW"]]],
  ["MINI", [["MINI"]]],
  ["Alpina", [["ALPINA"]]],
  ["Audi", [["AUDI"]]],
  ["Mercedes-Benz", [["MERCEDES"], ["MERCEDESBENZ"], ["MB"]]],
  ["Volkswagen", [["VOLKSWAGEN"], ["VW"]]],
  ["Volvo", [["VOLVO"]]],
  ["Skoda", [["SKODA"]]],
  ["SEAT", [["SEAT"]]],
  ["Cupra", [["CUPRA"]]],
  ["Opel", [["OPEL"], ["VAUXHALL"]]],
  ["Toyota", [["TOYOTA"]]],
  ["Kia", [["KIA"]]],
  ["Renault", [["RENAULT"]]],
  ["Dacia", [["DACIA"]]],
  ["Tesla", [["TESLA"]]],
  ["Porsche", [["PORSCHE"]]],
  ["Ford", [["FORD"]]],
  ["Peugeot", [["PEUGEOT"]]],
  ["Jeep", [["JEEP"]]],
  ["Mitsubishi", [["MITSUBISHI"]]],
  ["Hyundai", [["HYUNDAI"]]],
  ["Smart", [["SMART"]]],
  ["Mazda", [["MAZDA"]]],
  ["Lexus", [["LEXUS"]]],
  ["Isuzu", [["ISUZU"]]],
  ["Jaguar", [["JAGUAR"]]],
  ["Land Rover", [["LAND", "ROVER"], ["LANDROVER"], ["RANGE", "ROVER"]]],
  ["Honda", [["HONDA"]]],
  ["Nissan", [["NISSAN"]]],
  ["MAN", [["MAN"]]],
  ["Alfa Romeo", [["ALFA", "ROMEO"], ["ALFA"]]],
  ["Iveco", [["IVECO"]]],
  ["Citroen", [["CITROEN"]]],
  ["Fiat", [["FIAT"]]],
  ["Subaru", [["SUBARU"]]],
  ["Suzuki", [["SUZUKI"]]],
];

/** Markas bez savas statistikas -> grupas marka (MINI/Alpina = BMW, Cupra = SEAT, Dacia = Renault). */
export const DEALER_FORECAST_MAKE_GROUP: Readonly<Record<string, string>> = {
  MINI: "BMW",
  Alpina: "BMW",
  Cupra: "SEAT",
  Dacia: "Renault",
};

/** VIN WMI -> marka (tikai, ja pasūtījumā nav markas teksta). */
const WMI_MAKE: Readonly<Record<string, string>> = {
  WBA: "BMW", WBS: "BMW", WBY: "BMW", WMW: "MINI",
  WAU: "Audi", WUA: "Audi", TRU: "Audi",
  WDD: "Mercedes-Benz", WDB: "Mercedes-Benz", WDC: "Mercedes-Benz", WDF: "Mercedes-Benz",
  W1K: "Mercedes-Benz", W1N: "Mercedes-Benz", W1V: "Mercedes-Benz",
  WVW: "Volkswagen", WV1: "Volkswagen", WV2: "Volkswagen", WVG: "Volkswagen",
  YV1: "Volvo", YV4: "Volvo", LVY: "Volvo",
  TMB: "Skoda", VSS: "SEAT",
  W0L: "Opel", W0V: "Opel",
  VF1: "Renault", VF2: "Renault", VF6: "Renault", VF8: "Renault", UU1: "Dacia", UU3: "Dacia",
  VF3: "Peugeot", VR3: "Peugeot",
  "5YJ": "Tesla", "7SA": "Tesla", LRW: "Tesla", XP7: "Tesla",
  WP0: "Porsche", WP1: "Porsche",
  WF0: "Ford", WF1: "Ford",
  SAL: "Land Rover", SAJ: "Jaguar",
  JTD: "Toyota", JTE: "Toyota", JTM: "Toyota", JTN: "Toyota", SB1: "Toyota", NMT: "Toyota",
  KNA: "Kia", KNE: "Kia", U5Y: "Kia",
  KMH: "Hyundai", TMA: "Hyundai", NLH: "Hyundai",
  JMZ: "Mazda", JMB: "Mitsubishi", JHM: "Honda", SHH: "Honda", SHS: "Honda",
  SJN: "Nissan", JN1: "Nissan", WME: "Smart", ZAR: "Alfa Romeo",
};

/** Markas, kuru Eiropas VIN 10. zīme droši kodē modeļa gadu (izpēte 27.11; BMW/Mercedes - nē). */
const VIN_YEAR_SAFE_MAKES = new Set([
  "Audi", "Volkswagen", "Skoda", "SEAT", "Cupra", "Porsche", "Volvo", "Opel", "Land Rover", "Honda", "Ford",
]);

function normWords(s: string): string[] {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** Marka no teksta («MERCEDES-BENZ E 220», «VW Golf», «Škoda»); agrākā atbilsme uzvar. */
export function dealerForecastMakeFromText(text: string | null | undefined): string | null {
  const words = normWords(text ?? "");
  if (!words.length) return null;
  let best: { make: string; at: number } | null = null;
  for (const [make, seqs] of MAKE_ALIASES) {
    for (const seq of seqs) {
      for (let i = 0; i + seq.length <= words.length; i++) {
        if (seq.every((w, j) => words[i + j] === w)) {
          if (!best || i < best.at) best = { make, at: i };
          break;
        }
      }
    }
  }
  return best?.make ?? null;
}

export function dealerForecastMakeFromVin(vin: string | null | undefined): string | null {
  const v = (vin ?? "").trim().toUpperCase();
  return v.length >= 3 ? (WMI_MAKE[v.slice(0, 3)] ?? null) : null;
}

/** Gads no teksta («2015-03-12», «12.03.2015», «2015») vai skaitļa. */
export function dealerForecastYearFrom(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 1950 && value <= 2100 ? Math.trunc(value) : null;
  const m = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec((value ?? "").trim());
  return m ? Number(m[1]) : null;
}

/** Modeļa gads pēc VIN 10. zīmes - tikai markām, kur tas ir drošs (jaunākais iespējamais gads). */
export function dealerForecastYearFromVin(vin: string | null | undefined, make: string | null, now = new Date()): number | null {
  const v = (vin ?? "").trim().toUpperCase();
  if (v.length !== 17 || !make || !VIN_YEAR_SAFE_MAKES.has(make)) return null;
  return vinModelYears(v[9], now)[0] ?? null;
}

export function dealerForecastYearGroup(year: number | null | undefined): DealerForecastYearGroup | null {
  if (year == null || !Number.isFinite(year)) return null;
  if (year <= 2012) return "le2012";
  if (year <= 2016) return "2013-2016";
  if (year <= 2019) return "2017-2019";
  return "2020+";
}

/* ---------------- Dinamiskais agregāts (Blob) ---------------- */

/**
 * Blob agregāts: atslēga `${marka}|${gadu grupa | "all"}|${avots}` -> [ar_datiem, kopā].
 * Marka «?» - nezināma (skaitās tikai avota kopsummā p₀). Bez VIN un personas datiem.
 */
export type DealerCoverageCounts = Readonly<Record<string, DealerCoverageCell>>;

export type DealerCoverageAggregate = {
  v: 1;
  updatedAt: string;
  counts: Record<string, [number, number]>;
  /** Jau ieskaitīto pasūtījumu+avotu jaucējvērtības (16 hex), lai atkārtota ielase neskaitās divreiz. */
  seen: string[];
};

export const DEALER_COVERAGE_SEEN_CAP = 5000;
export const DEALER_COVERAGE_UNKNOWN_MAKE = "?";

export function emptyDealerCoverageAggregate(): DealerCoverageAggregate {
  return { v: 1, updatedAt: "", counts: {}, seen: [] };
}

function cellOf(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const a = Number(raw[0]);
  const n = Number(raw[1]);
  if (!Number.isInteger(a) || !Number.isInteger(n) || a < 0 || n < 0 || a > n) return null;
  return [a, n];
}

export function parseDealerCoverageAggregate(raw: unknown): DealerCoverageAggregate {
  const out = emptyDealerCoverageAggregate();
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  if (typeof o.updatedAt === "string") out.updatedAt = o.updatedAt;
  if (o.counts && typeof o.counts === "object") {
    for (const [k, v] of Object.entries(o.counts as Record<string, unknown>)) {
      const c = cellOf(v);
      if (c && k.split("|").length === 3) out.counts[k] = c;
    }
  }
  if (Array.isArray(o.seen)) out.seen = o.seen.filter((s): s is string => typeof s === "string" && /^[0-9a-f]{16}$/.test(s)).slice(-DEALER_COVERAGE_SEEN_CAP);
  return out;
}

export function dealerCoverageKey(make: string, group: DealerForecastYearGroup | "all", source: DealerForecastSource): string {
  return `${make}|${group}|${source}`;
}

/**
 * Pieskaita vienu iznākumu (idempotenti pēc `seenId`). Marka - tabulas nosaukums (pēc grupas),
 * vai null (nezināma). Gadu grupa - ja zināma.
 */
export function applyDealerCoverageOutcome(
  agg: DealerCoverageAggregate,
  outcome: {
    seenId: string;
    source: DealerForecastSource;
    make: string | null;
    yearGroup: DealerForecastYearGroup | null;
    hasData: boolean;
    at?: string;
  },
): { next: DealerCoverageAggregate; changed: boolean } {
  if (agg.seen.includes(outcome.seenId)) return { next: agg, changed: false };
  const counts = { ...agg.counts };
  const bump = (key: string) => {
    const [a, n] = counts[key] ?? [0, 0];
    counts[key] = [a + (outcome.hasData ? 1 : 0), n + 1];
  };
  const make = outcome.make || DEALER_COVERAGE_UNKNOWN_MAKE;
  bump(dealerCoverageKey(make, "all", outcome.source));
  if (outcome.make && outcome.yearGroup) bump(dealerCoverageKey(make, outcome.yearGroup, outcome.source));
  const seen = [...agg.seen, outcome.seenId].slice(-DEALER_COVERAGE_SEEN_CAP);
  return { next: { v: 1, updatedAt: outcome.at ?? new Date().toISOString(), counts, seen }, changed: true };
}

/* ---------------- Prognoze ---------------- */

export const DEALER_FORECAST_PRIOR_WEIGHT = 4;
export const DEALER_FORECAST_HIGH = 0.75;
export const DEALER_FORECAST_MEDIUM = 0.45;
export const DEALER_FORECAST_MIN_N = 2;

export function dealerForecastLevel(p: number, n: number): DealerForecastLevel {
  if (n < DEALER_FORECAST_MIN_N) return "nav zināms";
  if (p >= DEALER_FORECAST_HIGH) return "augsta";
  if (p >= DEALER_FORECAST_MEDIUM) return "vidēja";
  return "zema";
}

function smooth(a: number, n: number, p0: number): number {
  return (a + DEALER_FORECAST_PRIOR_WEIGHT * p0) / (n + DEALER_FORECAST_PRIOR_WEIGHT);
}

function addCells(x: DealerCoverageCell | undefined, y: DealerCoverageCell | undefined): [number, number] {
  return [(x?.[0] ?? 0) + (y?.[0] ?? 0), (x?.[1] ?? 0) + (y?.[1] ?? 0)];
}

export type DealerForecastRow = {
  source: DealerForecastSource;
  label: string;
  /** 0..1 (izlīdzināts). */
  p: number;
  level: DealerForecastLevel;
  /** Novērojumi tajā līmenī, no kura ņemts p. */
  n: number;
  /** Ar datiem tajā pašā līmenī. */
  hits: number;
  /** «year» - marka + gadu grupa; «make» - marka; «prior» - tikai avota vidējais (marka nav zināma / nav datu). */
  scope: "year" | "make" | "prior";
};

export type DealerForecast = {
  /** Atpazītā marka (piem. «MINI»); null, ja nav zināma. */
  make: string | null;
  /** Marka, kuras statistika lietota (MINI -> BMW); null, ja nav. */
  statsMake: string | null;
  year: number | null;
  yearGroup: DealerForecastYearGroup | null;
  rows: DealerForecastRow[];
  /** Ieteicamā secība: 1. avots, ja tam nav datu - 2., tad 3. */
  order: DealerForecastSource[];
};

export type DealerForecastInput = {
  make?: string | null;
  /** Markas teksti (CSDD marka, «Marka, modelis» u.c.) - pirmais atpazītais uzvar. */
  makeTexts?: readonly (string | null | undefined)[];
  /** CSDD izlaiduma / 1. reģistrācijas gads; ja nav - VIN 10. zīme (tikai drošām markām). */
  year?: number | string | null;
  vin?: string | null;
  now?: Date;
};

function statsCells(make: string, group: DealerForecastYearGroup | "all", source: DealerForecastSource, dyn: DealerCoverageCounts | null): [number, number] {
  const st = DEALER_FORECAST_STATIC[make];
  const base = group === "all" ? st?.all[source] : st?.years?.[group]?.[source];
  return addCells(base, dyn?.[dealerCoverageKey(make, group, source)]);
}

function hasStats(make: string, dyn: DealerCoverageCounts | null): boolean {
  if (DEALER_FORECAST_STATIC[make]) return true;
  if (!dyn) return false;
  return DEALER_FORECAST_SOURCES.some((s) => (dyn[dealerCoverageKey(make, "all", s)]?.[1] ?? 0) > 0);
}

/** Avota p₀: statiskā kopsumma + visi dinamiskie «all» ieraksti (arī nezināmām markām). */
export function dealerForecastPrior(source: DealerForecastSource, dyn: DealerCoverageCounts | null = null): number {
  let [a, n] = DEALER_FORECAST_STATIC_TOTALS[source];
  if (dyn) {
    for (const [key, cell] of Object.entries(dyn)) {
      const parts = key.split("|");
      if (parts[1] === "all" && parts[2] === source) {
        a += cell[0];
        n += cell[1];
      }
    }
  }
  return n > 0 ? a / n : 0.5;
}

/** Marka no ievades: tiešā marka -> teksti -> VIN WMI (tikai, ja tekstu nav). */
export function resolveDealerForecastMake(input: DealerForecastInput): string | null {
  const direct = dealerForecastMakeFromText(input.make ?? "");
  if (direct) return direct;
  const texts = (input.makeTexts ?? []).map((t) => (t ?? "").trim()).filter(Boolean);
  for (const t of texts) {
    const m = dealerForecastMakeFromText(t);
    if (m) return m;
  }
  if (!texts.length && !(input.make ?? "").trim()) return dealerForecastMakeFromVin(input.vin);
  return null;
}

/** Statistikas marka: pati marka, ja tai ir dati; citādi grupa (MINI -> BMW). */
export function dealerForecastStatsMake(make: string | null, dyn: DealerCoverageCounts | null = null): string | null {
  if (!make) return null;
  if (hasStats(make, dyn)) return make;
  const parent = DEALER_FORECAST_MAKE_GROUP[make];
  if (parent && hasStats(parent, dyn)) return parent;
  return null;
}

/** Ieskaitīšanai (Blob): marka pēc grupas (MINI -> BMW), lai papildina to pašu statistiku, ko UI lasa. */
export function dealerForecastRecordMake(make: string | null): string | null {
  if (!make) return null;
  return DEALER_FORECAST_STATIC[make] ? make : (DEALER_FORECAST_MAKE_GROUP[make] ?? make);
}

/** p atšķirība, ko uzskata par vienādu (tad CheckThisReg pirms auto-records - bez datiem atmaksā). */
const DEALER_FORECAST_TIE = 0.02;

function rankOthers(rows: DealerForecastRow[]): DealerForecastRow[] {
  const known = (r: DealerForecastRow) => (r.level === "nav zināms" ? 0 : 1);
  const tie = (r: DealerForecastRow) => (r.source === "checkthisreg" ? 0 : 1);
  return [...rows].sort((x, y) => {
    if (known(y) !== known(x)) return known(y) - known(x);
    if (Math.abs(y.p - x.p) >= DEALER_FORECAST_TIE) return y.p - x.p;
    return tie(x) - tie(y);
  });
}

/**
 * Ieteicamā secība (izpēte 27.11): OneAuto pirmais (bez datiem netiek iekasēts), izņemot, ja markai
 * OneAuto ir «zema» un kāds cits avots «augsta» (piem. Volvo -> auto-records). Pārējie - pēc p.
 */
function recommendOrder(rows: DealerForecastRow[], makeLevel: Record<DealerForecastSource, DealerForecastLevel>): DealerForecastSource[] {
  const one = rows.find((r) => r.source === "oneauto")!;
  const others = rankOthers(rows.filter((r) => r.source !== "oneauto"));
  const strongOther = others.find((r) => makeLevel[r.source] === "augsta");
  if (makeLevel.oneauto === "zema" && strongOther) {
    return [strongOther.source, "oneauto", ...others.filter((r) => r !== strongOther).map((r) => r.source)];
  }
  return [one.source, ...others.map((r) => r.source)];
}

export function forecastDealerCoverage(input: DealerForecastInput, dyn: DealerCoverageCounts | null = null): DealerForecast {
  const now = input.now ?? new Date();
  const make = resolveDealerForecastMake(input);
  const statsMake = dealerForecastStatsMake(make, dyn);
  const year =
    dealerForecastYearFrom(input.year ?? null) ?? dealerForecastYearFromVin(input.vin, make, now);
  const yearGroup = dealerForecastYearGroup(year);

  const makeLevel = {} as Record<DealerForecastSource, DealerForecastLevel>;
  const rows: DealerForecastRow[] = DEALER_FORECAST_SOURCES.map((source) => {
    const p0 = dealerForecastPrior(source, dyn);
    const label = DEALER_FORECAST_SOURCE_LABEL[source];
    if (!statsMake) {
      makeLevel[source] = "nav zināms";
      return { source, label, p: p0, level: "nav zināms", n: 0, hits: 0, scope: "prior" };
    }
    const [ma, mn] = statsCells(statsMake, "all", source, dyn);
    const pMake = smooth(ma, mn, p0);
    makeLevel[source] = dealerForecastLevel(pMake, mn);
    if (yearGroup) {
      const [ya, yn] = statsCells(statsMake, yearGroup, source, dyn);
      if (yn >= DEALER_FORECAST_MIN_N) {
        const p = smooth(ya, yn, pMake);
        return { source, label, p, level: dealerForecastLevel(p, yn), n: yn, hits: ya, scope: "year" };
      }
    }
    return { source, label, p: pMake, level: makeLevel[source], n: mn, hits: ma, scope: mn > 0 ? "make" : "prior" };
  });
  const order = recommendOrder(rows, makeLevel);
  const sorted = order.map((s) => rows.find((r) => r.source === s)!);
  return { make, statsMake, year, yearGroup, rows: sorted, order };
}

/** Īsā forma: forecast("BMW", 2015) -> rindas (ieteicamajā secībā) + secība. */
export function forecast(make: string | null | undefined, year?: number | string | null, dyn: DealerCoverageCounts | null = null): DealerForecast {
  return forecastDealerCoverage({ make: make ?? "", year: year ?? null }, dyn);
}

/** Nākamais avots pēc OneAuto «datu nav» (pirmais ne-OneAuto ieteicamajā secībā). */
export function dealerForecastNextAfterOneautoNoData(fc: DealerForecast): DealerForecastSource | null {
  return fc.order.find((s) => s !== "oneauto") ?? null;
}

/** Ievade no pasūtījuma avotu blokiem (CSDD API marka + gads, CSDD forma). */
export type DealerForecastBlocksLike = {
  csdd?: {
    makeModel?: string;
    firstRegistration?: string;
    registry?: { data?: { make?: string; year?: string; firstRegistrationIso?: string } };
  } | null;
} | null | undefined;

export function dealerForecastInputFromBlocks(blocks: DealerForecastBlocksLike, vin: string | null | undefined): DealerForecastInput {
  const r = blocks?.csdd?.registry?.data;
  const year =
    dealerForecastYearFrom(r?.year) ??
    dealerForecastYearFrom(r?.firstRegistrationIso) ??
    dealerForecastYearFrom(blocks?.csdd?.firstRegistration) ??
    null;
  return {
    makeTexts: [r?.make ?? "", blocks?.csdd?.makeModel ?? ""].filter((s) => s.trim()),
    year,
    vin: vin ?? "",
  };
}
