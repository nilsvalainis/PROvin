/**
 * Slinka migrācija no esošajiem pasūtījuma teksta laukiem uz `IrissCriteriaV1`.
 * Esošie lauki netiek dzēsti vai pārdēvēti. Nederīgs teksts paliek `manual`.
 * Ja `criteria` jau ir derīga V1 shēma, tā netiek pārrakstīta.
 */

import { mapEngineCc } from "@/lib/iriss-listings-ecarstrade-criteria";
import { resolveMakeModelPairsFromBrand } from "@/lib/iriss-listings-ecarstrade-catalog";
import { filledIrissListingLinks } from "@/lib/iriss-listing-link-lists";
import { parseIrissOrderBudget } from "@/lib/iriss-listings-orders";
import {
  acceptedNormalization,
  foldCriterion,
  isElectricSub,
  isGasSub,
  isHybridSub,
  normalizeBody,
  normalizeDrive,
  normalizeEmission,
  normalizeFuel,
  normalizeGearbox,
  normalizePowerKw,
  splitCriterionTokens,
  type BodyGroup,
  type DriveGroup,
  type PowerKwRange,
} from "@/lib/iriss-criteria-taxonomy";
import {
  IRISS_CRITERIA_VERSION,
  parseIrissCriteriaV1,
  type IrissCriteriaFilter,
  type IrissCriteriaLinks,
  type IrissCriteriaV1,
  type IrissCriteriaValue,
  type IrissFuelChoice,
  type IrissGearboxChoice,
  type IrissPriceBasis,
} from "@/lib/iriss-criteria-types";

export type IrissCriteriaMigrationInput = {
  id?: string;
  brandModel?: string;
  productionYears?: string;
  maxMileage?: string;
  totalBudget?: string;
  engineType?: string;
  transmission?: string;
  bodyType?: string;
  driveType?: string;
  seatCount?: string;
  equipmentRequired?: string;
  equipmentDesired?: string;
  /** B2B piezīme. Netiek pārcelta uz kritērijiem. */
  note?: string;
  dealVat21Required?: boolean;
  listingLinkAuto1?: readonly string[] | string;
  listingLinkOpenline?: readonly string[] | string;
  listingLinkAutobid?: readonly string[] | string;
  listingLinkEcarstrade?: readonly string[] | string;
  listingLinkMobile?: readonly string[] | string;
  listingLinksOther?: readonly string[] | string;
  criteria?: unknown;
};

function slot<T>(value: T, manual = ""): IrissCriteriaValue<T> {
  return { value, manual, source: "migrated" };
}

function uniq(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const t = value.trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function parseYears(raw: string): { from: number | null; to: number | null; parsed: boolean } {
  const t = raw.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-").trim();
  if (!t) return { from: null, to: null, parsed: false };
  const years = [...t.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  if (years.length === 0) return { from: null, to: null, parsed: false };
  if (years.length === 1) {
    const year = years[0]!;
    if (new RegExp(`\\b${year}\\s*\\+`).test(t) || /\b(?:no|from|ab)\b/i.test(t)) {
      return { from: year, to: null, parsed: true };
    }
    return { from: year, to: year, parsed: true };
  }
  return { from: Math.min(...years), to: Math.max(...years), parsed: true };
}

function parseBoundRange(raw: string): { from: number | null; to: number | null; parsed: boolean } {
  const t = raw.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-").trim();
  if (!t) return { from: null, to: null, parsed: false };
  const range = t.match(/(\d[\d\s.\u00a0]*)\s*(?:-|lidz|līdz|to|bis)\s*(\d[\d\s.\u00a0]*)/i);
  if (range) {
    const nums = [parseIrissOrderBudget(range[1] ?? ""), parseIrissOrderBudget(range[2] ?? "")]
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b);
    if (nums.length === 0) return { from: null, to: null, parsed: false };
    return { from: nums[0] ?? null, to: nums[nums.length - 1] ?? null, parsed: true };
  }
  const fromOnly = t.match(/\b(?:no|from|min|ab)\b\s*(\d[\d\s.\u00a0]*)/i);
  if (fromOnly && !/\b(?:lidz|līdz|max|bis|until)\b/i.test(t)) {
    const n = parseIrissOrderBudget(fromOnly[1] ?? "");
    if (n == null) return { from: null, to: null, parsed: false };
    return { from: n, to: null, parsed: true };
  }
  const one = parseIrissOrderBudget(t);
  if (one == null) return { from: null, to: null, parsed: false };
  return { from: null, to: one, parsed: true };
}

function priceBasisOf(raw: string): IrissPriceBasis | null {
  const s = foldCriterion(raw);
  if (!s) return null;
  if (/\bnetto\b|\bnet\b|\bbez pvn\b|\bohne mwst\b/.test(s)) return "net";
  if (/\bbruto\b|\bgross\b|\bar pvn\b|\binkl mwst\b/.test(s)) return "gross";
  return null;
}

function fuelChoice(token: string): IrissFuelChoice | null {
  const n = normalizeFuel(token);
  if (!acceptedNormalization(n.confidence, n.group) || !n.group) return null;
  if (n.group === "hybrid") {
    if (n.sub && isHybridSub(n.sub)) return { group: "hybrid", sub: n.sub };
    return { group: "hybrid" };
  }
  if (n.group === "electric") {
    if (n.sub && isElectricSub(n.sub)) return { group: "electric", sub: n.sub };
    return { group: "electric" };
  }
  if (n.group === "gas") {
    if (n.sub && isGasSub(n.sub)) return { group: "gas", sub: n.sub };
    return { group: "gas" };
  }
  return { group: n.group };
}

function gearboxChoice(token: string): IrissGearboxChoice | null {
  const n = normalizeGearbox(token);
  if (!acceptedNormalization(n.confidence, n.group) || !n.group) return null;
  if (n.group === "automatic") {
    if (n.sub) return { group: "automatic", sub: n.sub };
    return { group: "automatic" };
  }
  return { group: "manual" };
}

function collectFuel(raw: string): { values: IrissFuelChoice[]; manual: string } {
  return collect(raw, fuelChoice, (item) => ("sub" in item && item.sub ? `${item.group}:${item.sub}` : item.group));
}

function collectGearbox(raw: string): { values: IrissGearboxChoice[]; manual: string } {
  return collect(raw, gearboxChoice, (item) => ("sub" in item && item.sub ? `${item.group}:${item.sub}` : item.group));
}

function collectBody(raw: string): { values: BodyGroup[]; manual: string } {
  return collect(
    raw,
    (token) => {
      const n = normalizeBody(token);
      return acceptedNormalization(n.confidence, n.group) && n.group ? n.group : null;
    },
    (item) => item,
  );
}

function collectDrive(raw: string): { values: DriveGroup[]; manual: string } {
  return collect(
    raw,
    (token) => {
      const n = normalizeDrive(token);
      return acceptedNormalization(n.confidence, n.group) && n.group ? n.group : null;
    },
    (item) => item,
  );
}

function collect<T>(raw: string, mapOne: (token: string) => T | null, keyOf: (item: T) => string): { values: T[]; manual: string } {
  const text = raw.trim();
  if (!text) return { values: [], manual: "" };
  const tokens = splitCriterionTokens(text);
  const values: T[] = [];
  const seen = new Set<string>();
  const missed: string[] = [];
  for (const token of tokens) {
    const hit = mapOne(token);
    if (!hit) {
      missed.push(token);
      continue;
    }
    const key = keyOf(hit);
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(hit);
  }
  return { values, manual: missed.join(", ") };
}

function makesFromBrand(brandModel: string): { makes: string[]; models: string[]; manual: string } {
  const text = brandModel.trim();
  if (!text) return { makes: [], models: [], manual: "" };
  const pairs = resolveMakeModelPairsFromBrand(text);
  const makes: string[] = [];
  const models: string[] = [];
  for (const pair of pairs) {
    if (!makes.includes(pair.make.name)) makes.push(pair.make.name);
    if (pair.models.length > 0) {
      for (const model of pair.models) {
        if (!models.includes(model.name)) models.push(model.name);
      }
    } else if (pair.modelText && !models.includes(pair.modelText)) {
      models.push(pair.modelText);
    }
  }
  if (makes.length === 0) return { makes: [], models: [], manual: text };
  return { makes, models, manual: "" };
}

function powerFrom(engineType: string, brandModel: string): PowerKwRange {
  const fromEngine = normalizePowerKw(engineType);
  if (fromEngine.from != null || fromEngine.to != null) return fromEngine;
  return normalizePowerKw(brandModel);
}

function seatsFrom(raw: string): { value: number | null; manual: string } {
  const text = raw.trim();
  if (!text) return { value: null, manual: "" };
  const nums = [...text.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n >= 2 && n <= 9);
  if (nums.length === 0) return { value: null, manual: text };
  return { value: Math.min(...nums), manual: "" };
}

function equipmentOf(raw: string): { values: string[]; manual: string } {
  const text = raw.trim();
  if (!text) return { values: [], manual: "" };
  return { values: uniq(splitCriterionTokens(text)), manual: "" };
}

function linksOf(input: IrissCriteriaMigrationInput): IrissCriteriaLinks {
  return {
    auto1: filledIrissListingLinks(input.listingLinkAuto1),
    openlane: filledIrissListingLinks(input.listingLinkOpenline),
    autobid: filledIrissListingLinks(input.listingLinkAutobid),
    ecarstrade: filledIrissListingLinks(input.listingLinkEcarstrade),
    mobile: filledIrissListingLinks(input.listingLinkMobile),
    other: filledIrissListingLinks(input.listingLinksOther),
  };
}

function formIsParsable(filter: IrissCriteriaFilter): boolean {
  return (
    filter.make.value.length > 0 ||
    filter.models.value.length > 0 ||
    filter.excludeModels.value.length > 0 ||
    filter.yearFrom.value != null ||
    filter.yearTo.value != null ||
    filter.mileageFrom.value != null ||
    filter.mileageTo.value != null ||
    filter.budgetFrom.value != null ||
    filter.budgetTo.value != null ||
    filter.priceBasis.value != null ||
    filter.vatRequired.value != null ||
    filter.fuel.value.length > 0 ||
    filter.gearbox.value.length > 0 ||
    filter.bodyTypes.value.length > 0 ||
    filter.ccFrom.value != null ||
    filter.ccTo.value != null ||
    filter.kwFrom.value != null ||
    filter.kwTo.value != null ||
    filter.drive.value.length > 0 ||
    filter.seatsFrom.value != null ||
    filter.doorsFrom.value != null ||
    filter.equipmentRequired.value.length > 0 ||
    filter.equipmentDesired.value.length > 0 ||
    filter.maxDamage.value != null ||
    filter.countries.value.length > 0 ||
    filter.emissionMin.value != null
  );
}

function linksExist(links: IrissCriteriaLinks): boolean {
  return IRISS_LINK_KEYS.some((key) => links[key].length > 0);
}

const IRISS_LINK_KEYS = ["auto1", "openlane", "autobid", "ecarstrade", "mobile", "other"] as const;

/** Viena noklusējuma filtra rinda no teksta laukiem un saišu masīviem. */
export function migrateIrissCriteria(input: IrissCriteriaMigrationInput): IrissCriteriaV1 {
  const brand = makesFromBrand(input.brandModel ?? "");
  const years = parseYears(input.productionYears ?? "");
  const mileage = parseBoundRange(input.maxMileage ?? "");
  const budgetRaw = input.totalBudget ?? "";
  const budget = parseBoundRange(budgetRaw);
  const fuel = collectFuel(input.engineType ?? "");
  const gearbox = collectGearbox(input.transmission ?? "");
  const body = collectBody(input.bodyType ?? "");
  const drive = collectDrive(input.driveType ?? "");
  const seats = seatsFrom(input.seatCount ?? "");
  const required = equipmentOf(input.equipmentRequired ?? "");
  const desired = equipmentOf(input.equipmentDesired ?? "");
  const power = powerFrom(input.engineType ?? "", input.brandModel ?? "");
  const cc = mapEngineCc(input.engineType ?? "");
  const emission = normalizeEmission(input.engineType ?? "");
  const emissionOk = acceptedNormalization(emission.confidence, emission.group) && emission.group ? emission.group : null;
  const links = linksOf(input);
  const basis = priceBasisOf(budgetRaw);

  const filter: IrissCriteriaFilter = {
    id: "flt-1",
    label: "Filtrs 1",
    enabled: true,
    useForm: false,
    useLinks: linksExist(links),
    make: slot(brand.makes, brand.manual),
    models: slot(brand.models),
    excludeModels: slot([]),
    yearFrom: slot(years.parsed ? years.from : null, years.parsed ? "" : (input.productionYears ?? "").trim()),
    yearTo: slot(years.parsed ? years.to : null),
    mileageFrom: slot(mileage.parsed ? mileage.from : null),
    mileageTo: slot(mileage.parsed ? mileage.to : null, mileage.parsed ? "" : (input.maxMileage ?? "").trim()),
    budgetFrom: slot(budget.parsed ? budget.from : null),
    budgetTo: slot(budget.parsed ? budget.to : null, budget.parsed ? "" : budgetRaw.trim()),
    priceBasis: slot(basis),
    vatRequired: slot(input.dealVat21Required ? true : null),
    fuel: slot(fuel.values, fuel.manual),
    gearbox: slot(gearbox.values, gearbox.manual),
    bodyTypes: slot(body.values, body.manual),
    ccFrom: slot(cc),
    ccTo: slot(cc),
    kwFrom: slot(power.from),
    kwTo: slot(power.to),
    drive: slot(drive.values, drive.manual),
    seatsFrom: slot(seats.value, seats.manual),
    doorsFrom: slot(null),
    equipmentRequired: slot(required.values, required.manual),
    equipmentDesired: slot(desired.values, desired.manual),
    maxDamage: slot(null),
    countries: slot([]),
    emissionMin: slot(emissionOk, emissionOk ? "" : emission.todo ? (input.engineType ?? "").trim() : ""),
    links: slot(links),
  };
  filter.useForm = formIsParsable(filter);
  return { version: IRISS_CRITERIA_VERSION, filters: [filter] };
}

/**
 * Lasīšana: derīga saglabātā shēma paliek. Ja tās nav, tiek izveidota atmiņā.
 * Šī funkcija neko neraksta.
 */
export function readIrissCriteria(input: IrissCriteriaMigrationInput): IrissCriteriaV1 {
  const parsed = parseIrissCriteriaV1(input.criteria);
  if (parsed) return parsed;
  return migrateIrissCriteria(input);
}

export function attachIrissCriteria<T extends IrissCriteriaMigrationInput>(record: T): T & { criteria: IrissCriteriaV1 } {
  return { ...record, criteria: readIrissCriteria(record) };
}
