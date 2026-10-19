/**
 * IRISS pasūtījuma kritēriji, versija 1.
 * Viens pasūtījums var saturēt vairākus filtrus. Krāsas lauka šeit nav.
 * Katrs lauks ir rediģējams: strukturētā vērtība, manuālais teksts un avots.
 */

import {
  isAutomaticSub,
  isBodyGroup,
  isDriveGroup,
  isElectricSub,
  isFuelGroup,
  isGasSub,
  isGearboxGroup,
  isHybridSub,
  type AutomaticSub,
  type BodyGroup,
  type DriveGroup,
  type ElectricSub,
  type GasSub,
  type HybridSub,
} from "@/lib/iriss-criteria-taxonomy";

export const IRISS_CRITERIA_VERSION = 1 as const;

export const IRISS_CRITERIA_SOURCES = ["form", "url", "ai", "migrated"] as const;
export type IrissCriteriaSource = (typeof IRISS_CRITERIA_SOURCES)[number];

export const IRISS_PRICE_BASES = ["gross", "net"] as const;
export type IrissPriceBasis = (typeof IRISS_PRICE_BASES)[number];

export type IrissCriteriaValue<T> = {
  value: T;
  /** Operatora brīvais teksts. Tukšs, ja strukturētā vērtība pietiek. */
  manual: string;
  source: IrissCriteriaSource;
};

export type IrissFuelChoice =
  | { group: "petrol" }
  | { group: "diesel" }
  | { group: "hybrid"; sub?: HybridSub }
  | { group: "electric"; sub?: ElectricSub }
  | { group: "gas"; sub?: GasSub }
  | { group: "hydrogen" }
  | { group: "other" };

export type IrissGearboxChoice = { group: "manual" } | { group: "automatic"; sub?: AutomaticSub };

export type IrissCriteriaLinks = {
  auto1: string[];
  openlane: string[];
  autobid: string[];
  ecarstrade: string[];
  mobile: string[];
  other: string[];
};

export const IRISS_CRITERIA_LINK_KEYS = [
  "auto1",
  "openlane",
  "autobid",
  "ecarstrade",
  "mobile",
  "other",
] as const satisfies readonly (keyof IrissCriteriaLinks)[];

export type IrissCriteriaFilter = {
  id: string;
  label: string;
  enabled: boolean;
  /** Formas lauki piedalās meklēšanā. */
  useForm: boolean;
  /** Izsoļu saites piedalās meklēšanā. Abi slēdži var būt ieslēgti. */
  useLinks: boolean;
  make: IrissCriteriaValue<string[]>;
  models: IrissCriteriaValue<string[]>;
  excludeModels: IrissCriteriaValue<string[]>;
  yearFrom: IrissCriteriaValue<number | null>;
  yearTo: IrissCriteriaValue<number | null>;
  mileageFrom: IrissCriteriaValue<number | null>;
  mileageTo: IrissCriteriaValue<number | null>;
  budgetFrom: IrissCriteriaValue<number | null>;
  budgetTo: IrissCriteriaValue<number | null>;
  priceBasis: IrissCriteriaValue<IrissPriceBasis | null>;
  vatRequired: IrissCriteriaValue<boolean | null>;
  fuel: IrissCriteriaValue<IrissFuelChoice[]>;
  gearbox: IrissCriteriaValue<IrissGearboxChoice[]>;
  bodyTypes: IrissCriteriaValue<BodyGroup[]>;
  ccFrom: IrissCriteriaValue<number | null>;
  ccTo: IrissCriteriaValue<number | null>;
  kwFrom: IrissCriteriaValue<number | null>;
  kwTo: IrissCriteriaValue<number | null>;
  drive: IrissCriteriaValue<DriveGroup[]>;
  seatsFrom: IrissCriteriaValue<number | null>;
  doorsFrom: IrissCriteriaValue<number | null>;
  equipmentRequired: IrissCriteriaValue<string[]>;
  equipmentDesired: IrissCriteriaValue<string[]>;
  maxDamage: IrissCriteriaValue<string | null>;
  countries: IrissCriteriaValue<string[]>;
  emissionMin: IrissCriteriaValue<string | null>;
  links: IrissCriteriaValue<IrissCriteriaLinks>;
};

/** Obligātie lauki vēlākai grāmatzīmei un validācijai. Zvaigznīte specifikācijā. */
export const IRISS_CRITERIA_MANDATORY_FIELDS = [
  "make",
  "yearFrom",
  "mileageTo",
  "budgetTo",
  "fuel",
  "gearbox",
  "bodyTypes",
] as const satisfies readonly (keyof IrissCriteriaFilter)[];

export type IrissCriteriaMandatoryField = (typeof IRISS_CRITERIA_MANDATORY_FIELDS)[number];

export const IRISS_CRITERIA_FILTER_FIELDS = [
  "make",
  "models",
  "excludeModels",
  "yearFrom",
  "yearTo",
  "mileageFrom",
  "mileageTo",
  "budgetFrom",
  "budgetTo",
  "priceBasis",
  "vatRequired",
  "fuel",
  "gearbox",
  "bodyTypes",
  "ccFrom",
  "ccTo",
  "kwFrom",
  "kwTo",
  "drive",
  "seatsFrom",
  "doorsFrom",
  "equipmentRequired",
  "equipmentDesired",
  "maxDamage",
  "countries",
  "emissionMin",
  "links",
] as const satisfies readonly (keyof IrissCriteriaFilter)[];

export type IrissCriteriaV1 = {
  version: typeof IRISS_CRITERIA_VERSION;
  filters: IrissCriteriaFilter[];
};

export function emptyIrissCriteriaLinks(): IrissCriteriaLinks {
  return { auto1: [], openlane: [], autobid: [], ecarstrade: [], mobile: [], other: [] };
}

export function irissCriteriaValue<T>(value: T, source: IrissCriteriaSource = "form", manual = ""): IrissCriteriaValue<T> {
  return { value, manual, source };
}

export function emptyIrissCriteriaFilter(id = "flt-1", label = "Filtrs 1", source: IrissCriteriaSource = "form"): IrissCriteriaFilter {
  const v = <T>(value: T) => irissCriteriaValue(value, source);
  return {
    id,
    label,
    enabled: true,
    useForm: false,
    useLinks: false,
    make: v<string[]>([]),
    models: v<string[]>([]),
    excludeModels: v<string[]>([]),
    yearFrom: v<number | null>(null),
    yearTo: v<number | null>(null),
    mileageFrom: v<number | null>(null),
    mileageTo: v<number | null>(null),
    budgetFrom: v<number | null>(null),
    budgetTo: v<number | null>(null),
    priceBasis: v<IrissPriceBasis | null>(null),
    vatRequired: v<boolean | null>(null),
    fuel: v<IrissFuelChoice[]>([]),
    gearbox: v<IrissGearboxChoice[]>([]),
    bodyTypes: v<BodyGroup[]>([]),
    ccFrom: v<number | null>(null),
    ccTo: v<number | null>(null),
    kwFrom: v<number | null>(null),
    kwTo: v<number | null>(null),
    drive: v<DriveGroup[]>([]),
    seatsFrom: v<number | null>(null),
    doorsFrom: v<number | null>(null),
    equipmentRequired: v<string[]>([]),
    equipmentDesired: v<string[]>([]),
    maxDamage: v<string | null>(null),
    countries: v<string[]>([]),
    emissionMin: v<string | null>(null),
    links: v(emptyIrissCriteriaLinks()),
  };
}

export function emptyIrissCriteria(): IrissCriteriaV1 {
  return { version: IRISS_CRITERIA_VERSION, filters: [emptyIrissCriteriaFilter()] };
}

function isSource(value: unknown): value is IrissCriteriaSource {
  return typeof value === "string" && (IRISS_CRITERIA_SOURCES as readonly string[]).includes(value);
}

function isPriceBasis(value: unknown): value is IrissPriceBasis {
  return value === "gross" || value === "net";
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return undefined;
    out.push(item);
  }
  return out;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  return value;
}

function asNullableBoolean(value: unknown): boolean | null | undefined {
  if (value == null) return null;
  if (typeof value !== "boolean") return undefined;
  return value;
}

function parseFuelChoice(value: unknown): IrissFuelChoice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const group = (value as { group?: unknown }).group;
  const sub = (value as { sub?: unknown }).sub;
  if (!isFuelGroup(group)) return undefined;
  if (group === "hybrid") {
    if (sub == null) return { group: "hybrid" };
    if (!isHybridSub(sub)) return undefined;
    return { group: "hybrid", sub };
  }
  if (group === "electric") {
    if (sub == null) return { group: "electric" };
    if (!isElectricSub(sub)) return undefined;
    return { group: "electric", sub };
  }
  if (group === "gas") {
    if (sub == null) return { group: "gas" };
    if (!isGasSub(sub)) return undefined;
    return { group: "gas", sub };
  }
  if (sub != null) return undefined;
  return { group };
}

function parseGearboxChoice(value: unknown): IrissGearboxChoice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const group = (value as { group?: unknown }).group;
  const sub = (value as { sub?: unknown }).sub;
  if (!isGearboxGroup(group)) return undefined;
  if (group === "automatic") {
    if (sub == null) return { group: "automatic" };
    if (!isAutomaticSub(sub)) return undefined;
    return { group: "automatic", sub };
  }
  if (sub != null) return undefined;
  return { group: "manual" };
}

function parseLinks(value: unknown): IrissCriteriaLinks | undefined {
  if (!value || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  const links = emptyIrissCriteriaLinks();
  for (const key of IRISS_CRITERIA_LINK_KEYS) {
    const list = asStringArray(o[key]);
    if (!list) return undefined;
    links[key] = list;
  }
  return links;
}

function parseSlot<T>(raw: unknown, parseValue: (value: unknown) => T | undefined): IrissCriteriaValue<T> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (!("value" in o)) return undefined;
  const value = parseValue(o.value);
  if (value === undefined) return undefined;
  const manual = typeof o.manual === "string" ? o.manual : "";
  const source = isSource(o.source) ? o.source : "migrated";
  return { value, manual, source };
}

function parseFilter(raw: unknown): IrissCriteriaFilter | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (typeof o.enabled !== "boolean" || typeof o.useForm !== "boolean" || typeof o.useLinks !== "boolean") return undefined;

  const make = parseSlot(o.make, asStringArray);
  const models = parseSlot(o.models, asStringArray);
  const excludeModels = parseSlot(o.excludeModels, asStringArray);
  const yearFrom = parseSlot(o.yearFrom, asNullableNumber);
  const yearTo = parseSlot(o.yearTo, asNullableNumber);
  const mileageFrom = parseSlot(o.mileageFrom, asNullableNumber);
  const mileageTo = parseSlot(o.mileageTo, asNullableNumber);
  const budgetFrom = parseSlot(o.budgetFrom, asNullableNumber);
  const budgetTo = parseSlot(o.budgetTo, asNullableNumber);
  const priceBasis = parseSlot(o.priceBasis, (value) => {
    if (value == null) return null;
    return isPriceBasis(value) ? value : undefined;
  });
  const vatRequired = parseSlot(o.vatRequired, asNullableBoolean);
  const fuel = parseSlot(o.fuel, (value) => {
    if (!Array.isArray(value)) return undefined;
    const out: IrissFuelChoice[] = [];
    for (const item of value) {
      const choice = parseFuelChoice(item);
      if (!choice) return undefined;
      out.push(choice);
    }
    return out;
  });
  const gearbox = parseSlot(o.gearbox, (value) => {
    if (!Array.isArray(value)) return undefined;
    const out: IrissGearboxChoice[] = [];
    for (const item of value) {
      const choice = parseGearboxChoice(item);
      if (!choice) return undefined;
      out.push(choice);
    }
    return out;
  });
  const bodyTypes = parseSlot(o.bodyTypes, (value) => {
    const list = asStringArray(value);
    if (!list || !list.every(isBodyGroup)) return undefined;
    return list;
  });
  const ccFrom = parseSlot(o.ccFrom, asNullableNumber);
  const ccTo = parseSlot(o.ccTo, asNullableNumber);
  const kwFrom = parseSlot(o.kwFrom, asNullableNumber);
  const kwTo = parseSlot(o.kwTo, asNullableNumber);
  const drive = parseSlot(o.drive, (value) => {
    const list = asStringArray(value);
    if (!list || !list.every(isDriveGroup)) return undefined;
    return list;
  });
  const seatsFrom = parseSlot(o.seatsFrom, asNullableNumber);
  const doorsFrom = parseSlot(o.doorsFrom, asNullableNumber);
  const equipmentRequired = parseSlot(o.equipmentRequired, asStringArray);
  const equipmentDesired = parseSlot(o.equipmentDesired, asStringArray);
  const maxDamage = parseSlot(o.maxDamage, asNullableString);
  const countries = parseSlot(o.countries, asStringArray);
  const emissionMin = parseSlot(o.emissionMin, asNullableString);
  const links = parseSlot(o.links, parseLinks);

  if (
    !make ||
    !models ||
    !excludeModels ||
    !yearFrom ||
    !yearTo ||
    !mileageFrom ||
    !mileageTo ||
    !budgetFrom ||
    !budgetTo ||
    !priceBasis ||
    !vatRequired ||
    !fuel ||
    !gearbox ||
    !bodyTypes ||
    !ccFrom ||
    !ccTo ||
    !kwFrom ||
    !kwTo ||
    !drive ||
    !seatsFrom ||
    !doorsFrom ||
    !equipmentRequired ||
    !equipmentDesired ||
    !maxDamage ||
    !countries ||
    !emissionMin ||
    !links
  ) {
    return undefined;
  }

  return {
    id: o.id.trim(),
    label: o.label,
    enabled: o.enabled,
    useForm: o.useForm,
    useLinks: o.useLinks,
    make,
    models,
    excludeModels,
    yearFrom,
    yearTo,
    mileageFrom,
    mileageTo,
    budgetFrom,
    budgetTo,
    priceBasis,
    vatRequired,
    fuel,
    gearbox,
    bodyTypes,
    ccFrom,
    ccTo,
    kwFrom,
    kwTo,
    drive,
    seatsFrom,
    doorsFrom,
    equipmentRequired,
    equipmentDesired,
    maxDamage,
    countries,
    emissionMin,
    links,
  };
}

/** Atjauno shēmu no JSON. Lieki lauki, arī krāsa, netiek pārnesti. Nederīga forma dod `null`. */
export function parseIrissCriteriaV1(raw: unknown): IrissCriteriaV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== IRISS_CRITERIA_VERSION || !Array.isArray(o.filters)) return null;
  const filters: IrissCriteriaFilter[] = [];
  for (const item of o.filters) {
    const filter = parseFilter(item);
    if (!filter) return null;
    filters.push(filter);
  }
  return { version: IRISS_CRITERIA_VERSION, filters };
}

export function irissCriteriaMandatoryGaps(filter: IrissCriteriaFilter): IrissCriteriaMandatoryField[] {
  const gaps: IrissCriteriaMandatoryField[] = [];
  for (const field of IRISS_CRITERIA_MANDATORY_FIELDS) {
    const slot = filter[field];
    if (slot.manual.trim()) continue;
    const value = slot.value;
    if (Array.isArray(value)) {
      if (value.length === 0) gaps.push(field);
      continue;
    }
    if (value == null) gaps.push(field);
  }
  return gaps;
}

export function irissCriteriaHasColourField(raw: unknown): boolean {
  const json = JSON.stringify(raw ?? {});
  return /"(?:color|colour|colors|colours|preferredColors|nonPreferredColors)"\s*:/.test(json);
}

export function irissCriteriaSlotHasStoredValue(slot: IrissCriteriaValue<unknown> | undefined): boolean {
  if (!slot) return false;
  if (slot.manual.trim()) return true;
  const value = slot.value;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => Array.isArray(item) && item.length > 0);
  }
  return value != null;
}

/** Operatora aizpildīts filtrs (source form ar vērtību). Atvasinājums no teksta paliek migrated. */
export function irissCriteriaIsOperatorAuthored(criteria: IrissCriteriaV1 | null | undefined): boolean {
  if (!criteria?.filters?.length) return false;
  return criteria.filters.some((filter) =>
    [
      filter.make,
      filter.models,
      filter.yearFrom,
      filter.yearTo,
      filter.mileageFrom,
      filter.mileageTo,
      filter.budgetFrom,
      filter.budgetTo,
      filter.fuel,
      filter.gearbox,
      filter.bodyTypes,
      filter.ccFrom,
      filter.ccTo,
      filter.kwFrom,
      filter.kwTo,
      filter.drive,
    ].some((slot) => slot.source === "form" && irissCriteriaSlotHasStoredValue(slot)),
  );
}
