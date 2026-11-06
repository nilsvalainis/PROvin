/**
 * Radara (IRISS SCAN) meklēšanas kritēriji reālos laukos.
 *
 * Shēma ir tā pati, kas pasūtījumam: `IrissCriteriaV1` (sk. docs/iriss-criteria-taxonomy.md).
 * - Jauns vai operatora labots radars glabā `criteria` ierakstā (avots `form`).
 * - Vecs radars bez `criteria`: kritēriji tiek nolasīti atmiņā no teksta laukiem un, ja tie ir tukši,
 *   no nosaukuma ("Audi 2.0D manuālis 2009-2015, 150-330k, 3000-12000 EUR"). Ieraksts netiek pārrakstīts.
 * Nosaukums paliek tikai nosaukums - meklēšana ņem saglabātos laukus.
 */

import { migrateIrissCriteria, type IrissCriteriaMigrationInput } from "@/lib/iriss-criteria-migrate";
import { BODY_GROUPS, type BodyGroup } from "@/lib/iriss-criteria-taxonomy";
import {
  irissCriteriaSlotHasStoredValue,
  parseIrissCriteriaV1,
  type IrissCriteriaFilter,
  type IrissCriteriaV1,
  type IrissCriteriaValue,
  type IrissFuelChoice,
  type IrissGearboxChoice,
} from "@/lib/iriss-criteria-types";
import type { OrderSearchFields } from "@/lib/iriss-listings-ecarstrade-search";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

/* ---------------- Nosaukuma lasītājs (tikai veciem ierakstiem) ---------------- */

export type IrissScanTitleParts = {
  /** Marka un modelis bez kritēriju daļām. */
  brandModel: string;
  productionYears: string;
  maxMileage: string;
  totalBudget: string;
  engineType: string;
  transmission: string;
  powerKw: string;
};

const NUM = String.raw`\d{1,3}(?:[ .\u00a0]?\d{3})*`;
const MULT = String.raw`(?:k|tūkst\.?|tukst\.?)`;

function dashes(raw: string): string {
  return raw.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-").replace(/\u00a0/g, " ");
}

function intOf(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw.replace(/[ .\u00a0]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function rangeText(from: number | null, to: number | null, word: "no" | "līdz" | ""): string {
  if (from != null && to != null) return `${Math.min(from, to)}-${Math.max(from, to)}`;
  if (word === "no" && from != null) return `no ${from}`;
  const one = to ?? from;
  return one != null ? String(one) : "";
}

type Cut = { text: string; rest: string };

function cut(rest: string, re: RegExp, build: (m: RegExpMatchArray) => string): Cut {
  const m = rest.match(re);
  if (!m || m.index == null) return { text: "", rest };
  const text = build(m);
  if (!text) return { text: "", rest };
  return { text, rest: `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}` };
}

function boundWord(raw: string | undefined): "no" | "līdz" | "" {
  const w = (raw ?? "").toLowerCase();
  if (w === "no" || w === "from" || w === "ab" || w === "min") return "no";
  if (w) return "līdz";
  return "";
}

/** Cena: "3000-12000 EUR", "līdz 12k €", "no 5000 eur". */
function cutPrice(rest: string): Cut {
  const re = new RegExp(
    String.raw`(?:\b(no|līdz|lidz|max|until|bis|ab|from)\s+)?(${NUM})\s*(${MULT})?\s*(?:-\s*(${NUM})\s*(${MULT})?\s*)?(?:€|\beur\b|\beuro\b)`,
    "i",
  );
  return cut(rest, re, (m) => {
    const multA = m[3] ? 1000 : 1;
    const multB = m[5] ? 1000 : m[3] && !m[4] ? 1000 : 1;
    let a = intOf(m[2]);
    const b = intOf(m[4]);
    if (a == null) return "";
    a *= multA;
    if (b == null) {
      const word = boundWord(m[1]);
      return word === "no" ? `no ${a}` : String(a);
    }
    const bb = b * multB;
    // "3-12k EUR": pirmajam skaitlim tā pati reizinātāja nozīme.
    const aa = !m[3] && m[5] && a < 1000 ? a * 1000 : a;
    return rangeText(aa, bb, "");
  });
}

/** Nobraukums: "150-330k", "līdz 200 000 km", "200tkm". "kW" netiek ņemts. */
function cutMileage(rest: string): Cut {
  const unit = String.raw`(?:k(?![wW])|tkm|tūkst\.?\s*km|tukst\.?\s*km|km)`;
  const re = new RegExp(
    String.raw`(?:\b(no|līdz|lidz|max|until|bis|ab|from)\s+)?\b(${NUM})\s*(${unit})?\s*(?:-\s*(${NUM})\s*)?(${unit})(?![a-zA-Z])`,
    "i",
  );
  return cut(rest, re, (m) => {
    const thousand = (u: string | undefined) => Boolean(u && !/^km$/i.test(u.trim()));
    let a = intOf(m[2]);
    let b = intOf(m[4]);
    if (a == null) return "";
    const tailK = thousand(m[5]);
    if (b == null) {
      if (tailK) a *= 1000;
      const word = boundWord(m[1]);
      return word === "no" ? `no ${a}` : String(a);
    }
    if (thousand(m[3]) || (tailK && a < 1000)) a *= 1000;
    if (tailK && b < 1000) b *= 1000;
    return rangeText(a, b, "");
  });
}

/** Jauda: "110 kW", "100-150kW", "no 110 kW". */
function cutPower(rest: string): Cut {
  const re = /(?:\b(no|līdz|lidz|from|ab|max)\s+)?\b(\d{2,3})\s*(?:-\s*(\d{2,3})\s*)?kw\b/i;
  return cut(rest, re, (m) => {
    const a = intOf(m[2]);
    const b = intOf(m[3]);
    if (a == null) return "";
    if (b != null) return rangeText(a, b, "");
    return boundWord(m[1]) === "no" ? `no ${a}` : String(a);
  });
}

/** Gadi: "2009-2015", "2018+", "no 2018". */
function cutYears(rest: string): Cut {
  const re = /(?:\b(no|from|ab)\s+)?\b((?:19|20)\d{2})\b\s*(?:(?:-|\/)\s*((?:19|20)\d{2})\b|(\+))?/i;
  return cut(rest, re, (m) => {
    const a = intOf(m[2]);
    const b = intOf(m[3]);
    if (a == null) return "";
    if (b != null) return `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (m[4] || m[1]) return `${a}+`;
    return String(a);
  });
}

const GEARBOX_WORDS: Array<[RegExp, string]> = [
  [/\b(?:manuāl\p{L}*|manual\p{L}*|mehānisk\p{L}*|mehanisk\p{L}*|schaltgetriebe|MT)\b/iu, "manuāla"],
  [/\b(?:automāt\p{L}*|automat\p{L}*|DSG|DCT|S[- ]?tronic|tiptronic|steptronic|AT)\b/iu, "automāts"],
];

function cutGearbox(rest: string): Cut {
  const found: string[] = [];
  let next = rest;
  for (const [re, label] of GEARBOX_WORDS) {
    const c = cut(next, re, () => label);
    if (c.text) {
      found.push(c.text);
      next = c.rest;
    }
  }
  return { text: found.join(", "), rest: next };
}

const FUEL_WORDS: Array<[RegExp, string]> = [
  [/\b(?:plug[- ]?in(?:[- ]?hybrid)?|phev)\b/i, "PHEV"],
  [/\b(?:hibrīd\p{L}*|hibrid\p{L}*|hybrid\p{L}*|mhev|hev)\b/iu, "hybrid"],
  [/\b(?:elektr\p{L}*|electric|bev|ev)\b/iu, "elektro"],
  [/\b(?:dīzel\p{L}*|dizel\p{L}*|diesel|tdi|cdi|crdi|hdi|dci|bluehdi|d4d|d5)\b/iu, "dīzelis"],
  [/\b(?:benzīn\p{L}*|benzin\p{L}*|petrol|gasoline|tfsi|tsi|fsi|gdi)\b/iu, "benzīns"],
  [/\b(?:lpg|gpl|autogas)\b/i, "LPG"],
  [/\bcng\b/i, "CNG"],
];

function cutFuel(rest: string): Cut {
  const found: string[] = [];
  let next = rest;
  // "2.0D" = 2.0 l dīzelis.
  let litres = "";
  const shortDiesel = cut(next, /\b(\d)[.,](\d)\s?d\b/i, (m) => `${m[1]}.${m[2]}`);
  if (shortDiesel.text) {
    litres = shortDiesel.text;
    found.push("dīzelis");
    next = shortDiesel.rest;
  }
  for (const [re, label] of FUEL_WORDS) {
    const c = cut(next, re, () => label);
    if (c.text) {
      if (!found.includes(c.text)) found.push(c.text);
      next = c.rest;
    }
  }
  // Tilpums "2.0" pieder dzinējam, ne modelim.
  const cc = litres ? { text: litres, rest: next } : cut(next, /\b(\d[.,]\d)\b(?:\s*l\b)?/i, (m) => (m[1] ?? "").replace(",", "."));
  return { text: [cc.text, ...found].filter(Boolean).join(" "), rest: cc.rest };
}

function tidy(raw: string): string {
  return raw
    .replace(/\s*[,;]\s*(?=[,;]|$)/g, "")
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, "")
    .replace(/\s*[,;]\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/(?:,\s*)+$/g, "")
    .trim();
}

/**
 * Atdala no radara nosaukuma kritēriju daļas. Ja nekas nav atrasts, `brandModel` ir viss nosaukums.
 * Neko neuzmin: nesaprotamie vārdi paliek `brandModel`.
 */
export function parseIrissScanTitle(title: string): IrissScanTitleParts {
  let rest = dashes(title ?? "");
  const price = cutPrice(rest);
  rest = price.rest;
  const power = cutPower(rest);
  rest = power.rest;
  const km = cutMileage(rest);
  rest = km.rest;
  const years = cutYears(rest);
  rest = years.rest;
  const gear = cutGearbox(rest);
  rest = gear.rest;
  const fuel = cutFuel(rest);
  rest = fuel.rest;
  return {
    brandModel: tidy(rest),
    productionYears: years.text,
    maxMileage: km.text,
    totalBudget: price.text,
    engineType: fuel.text,
    transmission: gear.text,
    powerKw: power.text,
  };
}

/* ---------------- Lasīšana (bez rakstīšanas) ---------------- */

/** Ieraksta teksta lauks uzvar; nosaukums aizpilda tikai tukšos. */
export function irissScanCriteriaMigrationInput(rec: IrissScanRecord): IrissCriteriaMigrationInput {
  const t = parseIrissScanTitle(rec.brandModel);
  const pick = (own: string, fromTitle: string) => (own.trim() ? own : fromTitle);
  return {
    id: rec.id,
    brandModel: t.brandModel || rec.brandModel,
    productionYears: pick(rec.productionYears, t.productionYears),
    maxMileage: t.maxMileage,
    totalBudget: t.totalBudget,
    engineType: pick(rec.engineType, t.engineType),
    transmission: pick(rec.transmission, t.transmission),
    bodyType: rec.bodyType,
    powerKw: t.powerKw,
    listingLinkAuto1: rec.listingLinkAuto1,
    listingLinkOpenline: rec.listingLinkOpenline,
    listingLinkAutobid: rec.listingLinkAutobid,
    listingLinkEcarstrade: rec.listingLinkEcarstrade,
    listingLinkMobile: rec.listingLinkMobile,
    listingLinksOther: rec.listingLinksOther,
  };
}

/** Saglabātie kritēriji, ja tie ir derīgi; citādi atmiņas atvasinājums no laukiem un nosaukuma. */
export function readIrissScanCriteria(rec: IrissScanRecord): IrissCriteriaV1 {
  const stored = parseIrissCriteriaV1(rec.criteria);
  if (stored && stored.filters.length > 0) return stored;
  const migrated = migrateIrissCriteria(irissScanCriteriaMigrationInput(rec));
  migrated.filters[0]!.label = "Radars";
  return migrated;
}

export function irissScanCriteriaIsStored(rec: Pick<IrissScanRecord, "criteria">): boolean {
  const stored = parseIrissCriteriaV1(rec.criteria);
  return Boolean(stored && stored.filters.length > 0);
}

export function irissScanCriteriaFilter(rec: IrissScanRecord): IrissCriteriaFilter {
  return readIrissScanCriteria(rec).filters[0]!;
}

/* ---------------- Labošana (operators) ---------------- */

export const IRISS_SCAN_FUEL_OPTIONS = [
  ["petrol", "Benzīns"],
  ["diesel", "Dīzelis"],
  ["hybrid", "Hibrīds"],
  ["electric", "Elektro"],
  ["gas", "Gāze"],
] as const;
export type IrissScanFuelOption = (typeof IRISS_SCAN_FUEL_OPTIONS)[number][0];

export const IRISS_SCAN_GEARBOX_OPTIONS = [
  ["manual", "Manuāla"],
  ["automatic", "Automāts"],
] as const;
export type IrissScanGearboxOption = (typeof IRISS_SCAN_GEARBOX_OPTIONS)[number][0];

export const IRISS_SCAN_BODY_OPTIONS: ReadonlyArray<readonly [BodyGroup, string]> = [
  ["sedan", "Sedans"],
  ["wagon", "Universālis"],
  ["hatchback", "Hečbeks"],
  ["suv", "Apvidus"],
  ["coupe", "Kupeja"],
  ["cabrio", "Kabriolets"],
  ["mpv", "Minivens"],
  ["van_bus", "Mikroautobuss"],
  ["pickup", "Pikaps"],
];

export type IrissScanCriteriaForm = {
  make: string;
  models: string;
  yearFrom: string;
  yearTo: string;
  budgetFrom: string;
  budgetTo: string;
  mileageFrom: string;
  mileageTo: string;
  kwFrom: string;
  kwTo: string;
  fuel: IrissScanFuelOption[];
  gearbox: IrissScanGearboxOption[];
  bodyTypes: BodyGroup[];
};

export type IrissScanCriteriaFormKey = keyof IrissScanCriteriaForm;

/** Lauki, kas nāk no vecā teksta (nevis no operatora) - formā rāda ar norādi "nolasīts". */
export type IrissScanCriteriaFormOrigin = Partial<Record<IrissScanCriteriaFormKey, "migrated">>;

function numText(v: number | null): string {
  return v == null ? "" : String(v);
}

function fuelOptionsOf(list: readonly IrissFuelChoice[]): IrissScanFuelOption[] {
  const out: IrissScanFuelOption[] = [];
  for (const c of list) {
    const g = c.group;
    if ((g === "petrol" || g === "diesel" || g === "hybrid" || g === "electric" || g === "gas") && !out.includes(g)) out.push(g);
  }
  return out;
}

function gearboxOptionsOf(list: readonly IrissGearboxChoice[]): IrissScanGearboxOption[] {
  const out: IrissScanGearboxOption[] = [];
  for (const c of list) if (!out.includes(c.group)) out.push(c.group);
  return out;
}

export function irissScanCriteriaForm(rec: IrissScanRecord): { form: IrissScanCriteriaForm; origin: IrissScanCriteriaFormOrigin } {
  const f = irissScanCriteriaFilter(rec);
  const form: IrissScanCriteriaForm = {
    make: f.make.value.join(", ") || f.make.manual,
    models: f.models.value.join(", "),
    yearFrom: numText(f.yearFrom.value),
    yearTo: numText(f.yearTo.value),
    budgetFrom: numText(f.budgetFrom.value),
    budgetTo: numText(f.budgetTo.value),
    mileageFrom: numText(f.mileageFrom.value),
    mileageTo: numText(f.mileageTo.value),
    kwFrom: numText(f.kwFrom.value),
    kwTo: numText(f.kwTo.value),
    fuel: fuelOptionsOf(f.fuel.value),
    gearbox: gearboxOptionsOf(f.gearbox.value),
    bodyTypes: f.bodyTypes.value.filter((b) => (BODY_GROUPS as readonly string[]).includes(b)),
  };
  const origin: IrissScanCriteriaFormOrigin = {};
  const slots: Array<[IrissScanCriteriaFormKey, IrissCriteriaValue<unknown>]> = [
    ["make", f.make],
    ["models", f.models],
    ["yearFrom", f.yearFrom],
    ["yearTo", f.yearTo],
    ["budgetFrom", f.budgetFrom],
    ["budgetTo", f.budgetTo],
    ["mileageFrom", f.mileageFrom],
    ["mileageTo", f.mileageTo],
    ["kwFrom", f.kwFrom],
    ["kwTo", f.kwTo],
    ["fuel", f.fuel],
    ["gearbox", f.gearbox],
    ["bodyTypes", f.bodyTypes],
  ];
  for (const [key, slot] of slots) {
    if (slot.source === "migrated" && irissCriteriaSlotHasStoredValue(slot)) origin[key] = "migrated";
  }
  return { form, origin };
}

const NUMBER_LIMITS: Record<"year" | "budget" | "mileage" | "kw", { min: number; max: number }> = {
  year: { min: 1950, max: 2100 },
  budget: { min: 0, max: 10_000_000 },
  mileage: { min: 0, max: 2_000_000 },
  kw: { min: 1, max: 2000 },
};

/** Formas skaitlis -> vērtība. Atstarpes un punkti kā tūkstošu atdalītāji; "150k" = 150000. Nederīgs -> null. */
export function parseIrissScanCriteriaNumber(raw: string, kind: keyof typeof NUMBER_LIMITS): number | null {
  const t = raw.replace(/\u00a0/g, " ").trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/^(\d{1,3}(?:[ .]\d{3})+|\d+)\s*(k)?\s*(?:€|eur|km|kw)?$/);
  if (!m) return null;
  let n = Number.parseInt(m[1]!.replace(/[ .]/g, ""), 10);
  if (!Number.isFinite(n)) return null;
  if (m[2]) n *= 1000;
  const lim = NUMBER_LIMITS[kind];
  if (n < lim.min || n > lim.max) return null;
  return n;
}

function listOf(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(/\s*[,;]\s*/)) {
    const t = part.trim().slice(0, 60);
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 12);
}

type NumericKey = "yearFrom" | "yearTo" | "budgetFrom" | "budgetTo" | "mileageFrom" | "mileageTo" | "kwFrom" | "kwTo";

function formSlot<T>(value: T): IrissCriteriaValue<T> {
  return { value, manual: "", source: "form" };
}

function cloneCriteria(c: IrissCriteriaV1): IrissCriteriaV1 {
  return JSON.parse(JSON.stringify(c)) as IrissCriteriaV1;
}

/**
 * Operatora labojums vienā laukā. Pirmais labojums saglabā visu filtru `criteria` laukā
 * (pārējie nolasītie lauki tiek fiksēti, kā operators tos redzēja formā). Teksta lauki un nosaukums netiek mainīti.
 */
export function patchIrissScanCriteria<K extends IrissScanCriteriaFormKey>(
  rec: IrissScanRecord,
  key: K,
  value: IrissScanCriteriaForm[K],
): IrissScanRecord {
  const criteria = cloneCriteria(readIrissScanCriteria(rec));
  const f = criteria.filters[0]!;
  switch (key) {
    case "make":
      f.make = formSlot(listOf(String(value)));
      break;
    case "models":
      f.models = formSlot(listOf(String(value)));
      break;
    case "yearFrom":
    case "yearTo":
      f[key as NumericKey] = formSlot(parseIrissScanCriteriaNumber(String(value), "year"));
      break;
    case "budgetFrom":
    case "budgetTo":
      f[key as NumericKey] = formSlot(parseIrissScanCriteriaNumber(String(value), "budget"));
      break;
    case "mileageFrom":
    case "mileageTo":
      f[key as NumericKey] = formSlot(parseIrissScanCriteriaNumber(String(value), "mileage"));
      break;
    case "kwFrom":
    case "kwTo":
      f[key as NumericKey] = formSlot(parseIrissScanCriteriaNumber(String(value), "kw"));
      break;
    case "fuel":
      f.fuel = formSlot((value as IrissScanFuelOption[]).map((group) => ({ group }) as IrissFuelChoice));
      break;
    case "gearbox":
      f.gearbox = formSlot((value as IrissScanGearboxOption[]).map((group) => ({ group }) as IrissGearboxChoice));
      break;
    case "bodyTypes":
      f.bodyTypes = formSlot((value as BodyGroup[]).filter((b) => (BODY_GROUPS as readonly string[]).includes(b)));
      break;
  }
  f.useForm = true;
  return { ...rec, criteria };
}

/* ---------------- Meklēšana un kartītes ---------------- */

const FUEL_SEARCH_TEXT: Record<string, string> = {
  petrol: "Benzīns",
  diesel: "Dīzelis",
  hybrid: "Hybrid",
  electric: "Elektro",
  gas: "LPG",
};
const GEARBOX_SEARCH_TEXT: Record<string, string> = { manual: "Manuāla", automatic: "Automāts" };
const BODY_SEARCH_TEXT: Record<BodyGroup, string> = {
  sedan: "Sedans",
  wagon: "Universālis",
  hatchback: "Hečbeks",
  suv: "SUV",
  coupe: "Kupeja",
  cabrio: "Kabriolets",
  mpv: "Minivens",
  van_bus: "Mikroautobuss",
  pickup: "Pikaps",
};

function yearsText(from: number | null, to: number | null): string {
  if (from != null && to != null) return from === to ? String(from) : `${Math.min(from, to)}-${Math.max(from, to)}`;
  if (from != null) return `${from}+`;
  if (to != null) return `1990-${to}`;
  return "";
}

function boundText(from: number | null, to: number | null): string {
  if (from != null && to != null) return `${Math.min(from, to)}-${Math.max(from, to)}`;
  if (from != null) return `no ${from}`;
  if (to != null) return String(to);
  return "";
}

/**
 * Saglabātie kritēriji kā meklēšanas teksta lauki (tie paši URL būvētāji kā pasūtījumam).
 * Tikai, ja `criteria` ir saglabāts; vecam ierakstam - null (meklēšana paliek kā līdz šim).
 */
export function irissScanStoredSearchFields(rec: IrissScanRecord): (OrderSearchFields & { kwFrom: number | null; kwTo: number | null }) | null {
  if (!irissScanCriteriaIsStored(rec)) return null;
  const f = irissScanCriteriaFilter(rec);
  const brand = [...f.make.value, ...f.models.value].join(" ").trim();
  return {
    brandModel: brand || f.make.manual || rec.brandModel,
    productionYears: yearsText(f.yearFrom.value, f.yearTo.value),
    maxMileage: boundText(f.mileageFrom.value, f.mileageTo.value),
    totalBudget: boundText(f.budgetFrom.value, f.budgetTo.value),
    engineType: fuelOptionsOf(f.fuel.value).map((g) => FUEL_SEARCH_TEXT[g]).join(", "),
    transmission: gearboxOptionsOf(f.gearbox.value).map((g) => GEARBOX_SEARCH_TEXT[g]).join(", "),
    bodyType: f.bodyTypes.value.map((b) => BODY_SEARCH_TEXT[b]).join(", "),
    kwFrom: f.kwFrom.value,
    kwTo: f.kwTo.value,
  };
}

/** Kartītes ✓/✕ un budžeta rinda: kritēriji teksta formā (saglabātie vai nolasītie). */
export function irissScanBriefCriteria(rec: IrissScanRecord): {
  productionYears: string;
  maxMileage: string;
  totalBudget: string;
  budget: number | null;
  engineType: string;
  transmission: string;
  bodyType: string;
} {
  const f = irissScanCriteriaFilter(rec);
  return {
    productionYears: yearsText(f.yearFrom.value, f.yearTo.value),
    maxMileage: f.mileageTo.value != null ? String(f.mileageTo.value) : "",
    totalBudget: f.budgetTo.value != null ? String(f.budgetTo.value) : "",
    budget: f.budgetTo.value != null && f.budgetTo.value > 0 ? f.budgetTo.value : null,
    engineType: fuelOptionsOf(f.fuel.value).map((g) => FUEL_SEARCH_TEXT[g]).join(", "),
    transmission: gearboxOptionsOf(f.gearbox.value).map((g) => GEARBOX_SEARCH_TEXT[g]).join(", "),
    bodyType: f.bodyTypes.value.map((b) => BODY_SEARCH_TEXT[b]).join(", "),
  };
}

/** Saglabājamais `criteria`: tikai derīga V1 shēma. Viss cits tiek izmests (atvasinājums netiek rakstīts). */
export function sanitizeIrissScanCriteria(raw: unknown): IrissCriteriaV1 | undefined {
  const parsed = parseIrissCriteriaV1(raw);
  if (!parsed || parsed.filters.length === 0) return undefined;
  return { version: parsed.version, filters: parsed.filters.slice(0, 5) };
}
