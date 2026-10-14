import {
  ECARSTRADE_ALLOWED_COUNTRY_QUERY,
} from "@/lib/iriss-listings-country-filter";
import {
  resolveEcarstradeMake,
  resolveEcarstradeMakeFromBrandId,
  resolveEcarstradeModel,
  resolveMakeModelFromBrand,
  stripKnownSuffixes,
} from "@/lib/iriss-listings-ecarstrade-catalog";
import { ECARSTRADE_ORIGIN, ECARSTRADE_SEARCH_PATH } from "@/lib/iriss-listings-ecarstrade";

export type EcarstradeSearchFilter = {
  makeId: number | null;
  makeName: string;
  modelId: number | null;
  modelName: string;
  yearFrom: number | null;
  yearTo: number | null;
  mileageFrom: number | null;
  mileageTo: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  powerFromKw: number | null;
  powerToKw: number | null;
  fuels: string[];
  gearboxes: string[];
  bodies: string[];
};

export const ECARSTRADE_FUEL = {
  diesel: "Diesel",
  electric: "Electric",
  petrol: "Petrol",
  gas: "Natural Gas",
  lpg: "LPG",
  hybridPetrol: "Hybrid (petrol/electric)",
  hybridDiesel: "Hybrid (diesel/electric)",
} as const;

export const ECARSTRADE_GEARBOX = {
  automatic: "Automatic",
  semi: "Semi-automatic",
  manual: "Manual",
} as const;

export const ECARSTRADE_BODY = {
  convertible: "Convertible/Roadster",
  estate: "Estate Car",
  saloon: "Saloon",
  van: "Van/Minibus",
  suv: "SUV/Off-road Vehicle/Pickup Truck",
  small: "Small Car",
  coupe: "Sports Car/Coupe",
  bike: "Bike",
} as const;

const emptyFilter = (): EcarstradeSearchFilter => ({
  makeId: null,
  makeName: "",
  modelId: null,
  modelName: "",
  yearFrom: null,
  yearTo: null,
  mileageFrom: null,
  mileageTo: null,
  priceFrom: null,
  priceTo: null,
  powerFromKw: null,
  powerToKw: null,
  fuels: [],
  gearboxes: [],
  bodies: [],
});

function uniq(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function intFromRaw(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const year = t.match(/(?:19|20)\d{2}/);
  if (year && /date|reg|year/i.test(t) === false && /^\d{4}[-/.]/.test(t)) {
    const n = Number.parseInt(year[0], 10);
    return Number.isFinite(n) ? n : null;
  }
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function yearFromRaw(raw: string): number | null {
  const m = raw.match(/(?:19|20)\d{2}/);
  if (m) {
    const n = Number.parseInt(m[0], 10);
    return n >= 1980 && n <= 2035 ? n : null;
  }
  const n = intFromRaw(raw);
  return n != null && n >= 1980 && n <= 2035 ? n : null;
}

function mapFuel(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!s || /all|any|jebkur/.test(s)) return null;
  if (/hybrid/.test(s) && /diesel|dizel|tdi/.test(s)) return ECARSTRADE_FUEL.hybridDiesel;
  if (/hybrid|hibrid|phev|mhev|plug/.test(s)) return ECARSTRADE_FUEL.hybridPetrol;
  if (/diesel|dizel|tdi|dīzel/.test(s)) return ECARSTRADE_FUEL.diesel;
  if (/electric|elektro|bev|ev\b/.test(s) && !/hybrid/.test(s)) return ECARSTRADE_FUEL.electric;
  if (/lpg|autogas/.test(s)) return ECARSTRADE_FUEL.lpg;
  if (/cng|natural gas|erdgas|gāze|gaze/.test(s)) return ECARSTRADE_FUEL.gas;
  if (/petrol|gasoline|benz|otto|tfsi|tsi/.test(s)) return ECARSTRADE_FUEL.petrol;
  return null;
}

function mapGearbox(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!s || /all|any/.test(s)) return null;
  if (/semi|dsg|dct|s.?tronic/.test(s) && /semi/.test(s)) return ECARSTRADE_GEARBOX.semi;
  if (/auto|tiptronic|dsg|dct|cvt|s.?tronic|pdk/.test(s)) return ECARSTRADE_GEARBOX.automatic;
  if (/manual|manuell|mehān|mehan|stick/.test(s)) return ECARSTRADE_GEARBOX.manual;
  return null;
}

function mapBody(raw: string): string | null {
  const s = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!s || /all|any/.test(s)) return null;
  if (/suv|off.?road|pickup|crossover|gelande/.test(s)) return ECARSTRADE_BODY.suv;
  if (/estate|avant|variant|kombi|touring|wagon|sw\b/.test(s)) return ECARSTRADE_BODY.estate;
  if (/convertible|cabrio|roadster/.test(s)) return ECARSTRADE_BODY.convertible;
  if (/coupe|coupé|sports? car/.test(s)) return ECARSTRADE_BODY.coupe;
  if (/van|minibus|transporter/.test(s)) return ECARSTRADE_BODY.van;
  if (/small|hatch|compact/.test(s)) return ECARSTRADE_BODY.small;
  if (/saloon|sedan|limousine/.test(s)) return ECARSTRADE_BODY.saloon;
  if (/bike|motorcycle/.test(s)) return ECARSTRADE_BODY.bike;
  return null;
}

const MAKE_KEYS = [
  "manufacturer",
  "manufacturers",
  "manufacturername",
  "make",
  "makes",
  "brand",
  "brands",
  "mark[]",
  "mark",
];
const MODEL_KEYS = ["model", "models", "modelname", "name-model", "model[]", "typ", "type"];
const YEAR_FROM_KEYS = [
  "yearfrom",
  "year_from",
  "minyear",
  "yearmin",
  "fromyear",
  "firstregistrationfrom",
  "minfirstregistrationdate",
  "registrationfrom",
  "regfrom",
  "yearfrom-year",
];
const YEAR_TO_KEYS = [
  "yearto",
  "year_to",
  "maxyear",
  "yearmax",
  "toyear",
  "firstregistrationto",
  "maxfirstregistrationdate",
  "registrationto",
  "regto",
  "yearto-year",
];
const KM_FROM_KEYS = ["mileagefrom", "mileage_from", "kmfrom", "minmileage", "odometerfrom", "mileagefrom-mileage"];
const KM_TO_KEYS = ["mileageto", "mileage_to", "kmto", "maxmileage", "odometerto", "mileageto-mileage"];
const PRICE_FROM_KEYS = ["pricefrom", "price_from", "minprice", "pricemin"];
const PRICE_TO_KEYS = ["priceto", "price_to", "maxprice", "pricemax"];
const POWER_FROM_KEYS = ["powerfrom", "power_from", "minpower", "kwfrom", "powerfrom-power"];
const POWER_TO_KEYS = ["powerto", "power_to", "maxpower", "kwto", "powerto-power"];
const HP_FROM_KEYS = ["minhorsepower", "horsepowerfrom", "hpfrom"];
const HP_TO_KEYS = ["maxhorsepower", "horsepowerto", "hpto"];
const FUEL_KEYS = ["fuel", "fuels", "fueltype", "fueltypes", "fuel[]", "fuelid-fuel"];
const GEAR_KEYS = ["gearbox", "gearboxes", "transmission", "transmissions", "gearbox[]", "gearboxid-gearbox"];
const BODY_KEYS = ["body", "bodies", "bodytype", "bodytypes", "category", "categories", "category[]"];

function paramKey(raw: string): string {
  return raw.toLowerCase().replace(/%5b%5d/gi, "[]");
}

function collectParams(url: URL): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const push = (k: string, v: string) => {
    const key = paramKey(k);
    const list = map.get(key) ?? [];
    list.push(v);
    map.set(key, list);
  };
  for (const [k, v] of url.searchParams.entries()) push(k, v);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (hash.includes("=")) {
    const qs = hash.startsWith("?") ? hash.slice(1) : hash;
    try {
      const extra = new URLSearchParams(qs);
      for (const [k, v] of extra.entries()) push(k, v);
    } catch {
      /* ignore */
    }
  }
  return map;
}

function values(params: Map<string, string[]>, keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    for (const v of params.get(key) ?? []) {
      for (const part of v.split(/[,|]/)) {
        const t = part.trim();
        if (t) out.push(t);
      }
    }
  }
  return out;
}

function firstInt(params: Map<string, string[]>, keys: string[], parse = intFromRaw): number | null {
  for (const v of values(params, keys)) {
    const n = parse(v);
    if (n != null) return n;
  }
  return null;
}

function hpToKw(hp: number): number {
  return Math.round(hp * 0.73549875);
}

function applyMakeModel(filter: EcarstradeSearchFilter, makeRaw: string, modelRaw: string): void {
  const make = resolveEcarstradeMake(makeRaw);
  if (make) {
    filter.makeId = make.id;
    filter.makeName = make.name;
  } else if (makeRaw.trim() && /^\d+$/.test(makeRaw.trim())) {
    const fromId = resolveEcarstradeMakeFromBrandId(makeRaw.trim());
    if (fromId) {
      filter.makeId = fromId.id;
      filter.makeName = fromId.name;
    }
  }
  const modelText = stripKnownSuffixes(modelRaw);
  if (filter.makeId && modelText) {
    const model = resolveEcarstradeModel(filter.makeId, modelText);
    if (model) {
      filter.modelId = model.id;
      filter.modelName = model.name;
    } else if (!filter.modelName) {
      filter.modelName = modelText;
    }
  } else if (modelText && !filter.modelName) {
    filter.modelName = modelText;
  }
}

export function parseListingSearchUrl(rawUrl: string): EcarstradeSearchFilter {
  const filter = emptyFilter();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return filter;
  }
  const params = collectParams(url);
  const brandId = values(params, ["brandid-brand", "brandid", "brand-id"])[0] ?? "";
  const makeRaw =
    values(params, MAKE_KEYS)[0] ??
    (brandId ? resolveEcarstradeMakeFromBrandId(brandId)?.name ?? "" : "");
  const modelRaw = values(params, MODEL_KEYS)[0] ?? "";
  applyMakeModel(filter, makeRaw, modelRaw);

  filter.yearFrom = firstInt(params, YEAR_FROM_KEYS, yearFromRaw);
  filter.yearTo = firstInt(params, YEAR_TO_KEYS, yearFromRaw);
  filter.mileageFrom = firstInt(params, KM_FROM_KEYS);
  filter.mileageTo = firstInt(params, KM_TO_KEYS);
  filter.priceFrom = firstInt(params, PRICE_FROM_KEYS);
  filter.priceTo = firstInt(params, PRICE_TO_KEYS);
  filter.powerFromKw = firstInt(params, POWER_FROM_KEYS);
  filter.powerToKw = firstInt(params, POWER_TO_KEYS);
  const hpFrom = firstInt(params, HP_FROM_KEYS);
  const hpTo = firstInt(params, HP_TO_KEYS);
  if (filter.powerFromKw == null && hpFrom != null) filter.powerFromKw = hpToKw(hpFrom);
  if (filter.powerToKw == null && hpTo != null) filter.powerToKw = hpToKw(hpTo);

  filter.fuels = uniq(values(params, FUEL_KEYS).map(mapFuel).filter((x): x is string => Boolean(x)));
  filter.gearboxes = uniq(values(params, GEAR_KEYS).map(mapGearbox).filter((x): x is string => Boolean(x)));
  filter.bodies = uniq(values(params, BODY_KEYS).map(mapBody).filter((x): x is string => Boolean(x)));
  return filter;
}

export function filterFromBrandModel(brandModel: string): EcarstradeSearchFilter {
  const filter = emptyFilter();
  const resolved = resolveMakeModelFromBrand(brandModel);
  if (resolved.make) {
    filter.makeId = resolved.make.id;
    filter.makeName = resolved.make.name;
  }
  if (resolved.model) {
    filter.modelId = resolved.model.id;
    filter.modelName = resolved.model.name;
  } else if (resolved.modelText) {
    filter.modelName = resolved.modelText;
  }
  const remainder = `${brandModel} ${resolved.modelText}`;
  const fuel = mapFuel(remainder);
  const gear = mapGearbox(remainder);
  const body = mapBody(remainder);
  if (fuel) filter.fuels = [fuel];
  if (gear) filter.gearboxes = [gear];
  if (body) filter.bodies = [body];
  return filter;
}

/** Aizpilda tukšo marku/modeli no brandModel, nepārraksta URL filtrus. */
export function fillMakeModelFromBrand(filter: EcarstradeSearchFilter, brandModel: string): EcarstradeSearchFilter {
  if (filter.makeId && filter.modelId) return filter;
  const fromBrand = filterFromBrandModel(brandModel);
  return {
    ...filter,
    makeId: filter.makeId ?? fromBrand.makeId,
    makeName: filter.makeName || fromBrand.makeName,
    modelId: filter.modelId ?? fromBrand.modelId,
    modelName: filter.modelName || fromBrand.modelName,
  };
}

function appendQuery(parts: string[], key: string, value: string): void {
  parts.push(`${key}=${encodeURIComponent(value)}`);
}

export function ecarstradeSearchUrl(filter: EcarstradeSearchFilter): string | null {
  if (!filter.makeId) return null;
  const parts: string[] = [];
  appendQuery(parts, "mark[]", String(filter.makeId));
  if (filter.modelId) appendQuery(parts, "model[]", String(filter.modelId));
  if (filter.yearFrom != null) appendQuery(parts, "year_from", String(filter.yearFrom));
  if (filter.yearTo != null) appendQuery(parts, "year_to", String(filter.yearTo));
  if (filter.mileageFrom != null) appendQuery(parts, "mileage_from", String(filter.mileageFrom));
  if (filter.mileageTo != null) appendQuery(parts, "mileage_to", String(filter.mileageTo));
  if (filter.priceFrom != null) appendQuery(parts, "price_from", String(filter.priceFrom));
  if (filter.priceTo != null) appendQuery(parts, "price_to", String(filter.priceTo));
  if (filter.powerFromKw != null) appendQuery(parts, "power_from", String(filter.powerFromKw));
  if (filter.powerToKw != null) appendQuery(parts, "power_to", String(filter.powerToKw));
  for (const fuel of uniq(filter.fuels)) appendQuery(parts, "fuel[]", fuel);
  for (const box of uniq(filter.gearboxes)) appendQuery(parts, "gearbox[]", box);
  for (const body of uniq(filter.bodies)) appendQuery(parts, "category[]", body);
  for (const country of ECARSTRADE_ALLOWED_COUNTRY_QUERY) appendQuery(parts, "country[]", country);
  return `${ECARSTRADE_ORIGIN}${ECARSTRADE_SEARCH_PATH}?${parts.join("&")}`;
}

export function ecarstradeFilterSignature(filter: EcarstradeSearchFilter): string {
  return [
    filter.makeId ?? "",
    filter.modelId ?? "",
    filter.yearFrom ?? "",
    filter.yearTo ?? "",
    filter.mileageFrom ?? "",
    filter.mileageTo ?? "",
    filter.priceFrom ?? "",
    filter.priceTo ?? "",
    filter.powerFromKw ?? "",
    filter.powerToKw ?? "",
    [...filter.fuels].sort().join(","),
    [...filter.gearboxes].sort().join(","),
    [...filter.bodies].sort().join(","),
  ].join("|");
}

export function sameEcarstradeSearch(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    if (ua.origin !== ub.origin || ua.pathname.replace(/\/$/, "") !== ub.pathname.replace(/\/$/, "")) return false;
    const keys = new Set([...ua.searchParams.keys(), ...ub.searchParams.keys()]);
    for (const key of keys) {
      if (key === "sort" || key === "start" || key === "perpage" || key === "page") continue;
      const va = ua.searchParams.getAll(key).slice().sort().join("\0");
      const vb = ub.searchParams.getAll(key).slice().sort().join("\0");
      if (va !== vb) return false;
    }
    return true;
  } catch {
    return a.trim() === b.trim();
  }
}
