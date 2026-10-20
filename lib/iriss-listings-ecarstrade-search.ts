import {
  ECARSTRADE_ALLOWED_COUNTRY_QUERY,
} from "@/lib/iriss-listings-country-filter";
import {
  ecarstradeModelsForMake,
  extractPowerKwFromBrand,
  resolveEcarstradeMake,
  resolveEcarstradeMakeById,
  resolveEcarstradeMakeFromBrandId,
  resolveEcarstradeModel,
  resolveEcarstradeModelById,
  resolveMakeModelPairsFromBrand,
  resolveMakesFromBrand,
  stripKnownSuffixes,
  type EcarstradeMark,
} from "@/lib/iriss-listings-ecarstrade-catalog";
import {
  AUTOBID_VEHICLE_TYPE_IDS,
  isNoiseSearchParam,
  isWildcardCriterion,
  mapAutobidBodyId,
  mapAutobidFuelToken,
  mapAutobidGearboxId,
  mapEcarstradeColor,
  mapEcarstradeDrive,
  mapEmissionClass,
  mapEngineCc,
  mapOpenlaneFuelToken,
  mapVat,
  parseAuto1Manufacturers,
  parseAutobidCarlistManufacturerModel,
  parseOpenlaneMakesModels,
  parseMobileDeColonRange,
  parseZeroUnboundedRange,
  resolveMakeFromMobileMs,
  splitListTokens,
  type EcarstradeDrive,
  type MakeModelPair,
  type UnmappedCriterion,
} from "@/lib/iriss-listings-ecarstrade-criteria";
import { ECARSTRADE_ORIGIN, ECARSTRADE_SEARCH_PATH } from "@/lib/iriss-listings-ecarstrade";
import { parseIrissOrderBoundRange } from "@/lib/iriss-listings-orders";
import { splitModelExtensions } from "@/lib/iriss-model-extension";

export type EcarstradeSearchFilter = {
  /** Viena vai vairākas markas (`mark[]` atkārtojas). */
  makeIds: number[];
  makeNames: string[];
  modelId: number | null;
  /** Vairāki `model[]` vienai markai (BMW 5er+7er). */
  modelIds: number[];
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
  colors: string[];
  engineFromCc: number | null;
  engineToCc: number | null;
  doorsFrom: number | null;
  doorsTo: number | null;
  seatsFrom: number | null;
  seatsTo: number | null;
  vat: string[];
  emissionFrom: string;
  /** ET URL nav piedziņas lauka: `iriss_drive`. */
  drives: EcarstradeDrive[];
  /** Aģenta piezīmes / variants: `iriss_need` (grāmatzīme, ne aprīkojums). */
  includeTokens: string[];
  /** Izslēgtie modeļi / teksts: `iriss_exclude`. */
  excludeTokens: string[];
  excludeColors: string[];
  /** Modeļa paplašinājums (S-line). Virsraksta saturam. */
  modelExtensions: string[];
  unmapped: UnmappedCriterion[];
};

export type ParsedListingSearch = {
  filter: EcarstradeSearchFilter;
  sourceUrl: string;
  rawKeys: string[];
};

export type OrderSearchFields = {
  brandModel?: string;
  productionYears?: string;
  totalBudget?: string;
  engineType?: string;
  transmission?: string;
  bodyType?: string;
  driveType?: string;
  seatCount?: string;
  maxMileage?: string;
  preferredColors?: string;
  nonPreferredColors?: string;
  equipmentRequired?: string;
  agentNotes?: string;
  modelExtension?: string;
  dealVat21Required?: boolean;
};

/** Atpakaļsaderība: pirmā marka. */
export function primaryMakeId(filter: Pick<EcarstradeSearchFilter, "makeIds">): number | null {
  return filter.makeIds[0] ?? null;
}

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
  makeIds: [],
  makeNames: [],
  modelId: null,
  modelIds: [],
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
  colors: [],
  engineFromCc: null,
  engineToCc: null,
  doorsFrom: null,
  doorsTo: null,
  seatsFrom: null,
  seatsTo: null,
  vat: [],
  emissionFrom: "",
  drives: [],
  includeTokens: [],
  excludeTokens: [],
  excludeColors: [],
  modelExtensions: [],
  unmapped: [],
});

function pushMake(filter: EcarstradeSearchFilter, mark: EcarstradeMark | null): void {
  if (!mark || filter.makeIds.includes(mark.id)) return;
  filter.makeIds.push(mark.id);
  filter.makeNames.push(mark.name);
}

function uniqNums(values: number[]): number[] {
  const out: number[] = [];
  for (const n of values) {
    if (!Number.isFinite(n) || out.includes(n)) continue;
    out.push(n);
  }
  return out;
}

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
  if (isWildcardCriterion(s)) return null;
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
  const fromId = mapAutobidGearboxId(raw);
  if (fromId) return fromId === "Manual" ? ECARSTRADE_GEARBOX.manual : ECARSTRADE_GEARBOX.automatic;
  const s = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (isWildcardCriterion(s)) return null;
  if (/\bsemi\b|halbauto|semi automatic|semiautomatic/.test(s)) return ECARSTRADE_GEARBOX.semi;
  if (/auto|tiptronic|dsg|dct|cvt|s.?tronic|pdk|automatik/.test(s)) return ECARSTRADE_GEARBOX.automatic;
  if (/manual|manuell|mehān|mehan|stick|schalt/.test(s)) return ECARSTRADE_GEARBOX.manual;
  return null;
}

function mapBody(raw: string): string | null {
  const fromId = mapAutobidBodyId(raw);
  if (fromId) return fromId;
  const s = raw.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (isWildcardCriterion(s)) return null;
  if (/suv|off.?road|offroad|pickup|crossover|gelande/.test(s)) return ECARSTRADE_BODY.suv;
  if (/estate|avant|variant|kombi|combi|touring|wagon|\bbreak\b|station/.test(s)) return ECARSTRADE_BODY.estate;
  if (/convertible|cabrio|roadster/.test(s)) return ECARSTRADE_BODY.convertible;
  if (/coupe|coupé|sports?\s*car|sportscar/.test(s)) return ECARSTRADE_BODY.coupe;
  if (/\bmpv\b|van|minibus|transporter/.test(s)) return ECARSTRADE_BODY.van;
  if (/small|hatch|compact/.test(s)) return ECARSTRADE_BODY.small;
  if (/saloon|sedan|limousine|\blimo\b|berline/.test(s)) return ECARSTRADE_BODY.saloon;
  if (/bike|motorcycle/.test(s)) return ECARSTRADE_BODY.bike;
  return null;
}

/** mobile.de Automatik = `tr=AUTOMATIC_GEAR` + `tr=SEMIAUTOMATIC_GEAR`; ET tikai Automatic. */
function collapseImpliedSemiAutomatic(raw: string[], mapped: string[]): string[] {
  const hasExplicitAuto = raw.some((r) => {
    const s = r.toLowerCase().replace(/[_-]+/g, " ");
    return /auto/.test(s) && !/semi/.test(s);
  });
  if (
    hasExplicitAuto &&
    mapped.includes(ECARSTRADE_GEARBOX.automatic) &&
    mapped.includes(ECARSTRADE_GEARBOX.semi)
  ) {
    return mapped.filter((g) => g !== ECARSTRADE_GEARBOX.semi);
  }
  return mapped;
}

const MAKE_KEYS = [
  "manufacturer",
  "manufacturername",
  "make",
  "makes",
  "brand",
  "brands",
  "name-brand",
  "mark[]",
  "mark",
  "make1",
  "makemodelvariant1.makeid",
];
const MODEL_KEYS = [
  "model",
  "models",
  "modelname",
  "name-model",
  "model[]",
  "typ",
  "type",
  "modeldescription",
  "variant",
  "variants",
  "modelgeneration",
  "modelgroup",
];
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
  "regist",
  "carlist-e21from",
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
  "regist_to",
  "carlist-e21to",
];
const KM_FROM_KEYS = [
  "mileagefrom",
  "mileage_from",
  "kmfrom",
  "minmileage",
  "odometerfrom",
  "mileagefrom-mileage",
  "kilom",
  "kilometresfrom-e68_1",
  "carlist-e68from",
];
const KM_TO_KEYS = [
  "mileageto",
  "mileage_to",
  "kmto",
  "maxmileage",
  "odometerto",
  "mileageto-mileage",
  "kilom_to",
  "kilometresto-e68_2",
  "kilometresto",
  "carlist-e68to",
];
const PRICE_FROM_KEYS = ["pricefrom", "price_from", "minprice", "pricemin", "pricefrom-price", "pricemin"];
const PRICE_TO_KEYS = ["priceto", "price_to", "maxprice", "pricemax", "priceto-price", "price_to", "startprice2"];
const POWER_FROM_KEYS = [
  "powerfrom",
  "power_from",
  "minpower",
  "kwfrom",
  "powerfrom-power",
  "minpowerasarray",
  "minpowerkw",
  "power",
  "poweroutputfrom",
  "carlist-e19from",
];
const POWER_TO_KEYS = [
  "powerto",
  "power_to",
  "maxpower",
  "kwto",
  "powerto-power",
  "maxpowerasarray",
  "maxpowerkw",
  "power_to",
  "poweroutputto",
  "carlist-e19to",
];
const HP_FROM_KEYS = ["minhorsepower", "horsepowerfrom", "hpfrom"];
const HP_TO_KEYS = ["maxhorsepower", "horsepowerto", "hpto"];
const FUEL_KEYS = ["fuel", "fuels", "fueltype", "fueltypes", "fuel[]", "fuelid-fuel", "ft", "e17", "carlist-e17"];
const GEAR_KEYS = [
  "gearbox",
  "gearboxes",
  "geartypes",
  "transmission",
  "transmissions",
  "transmissiontypes",
  "gearbox[]",
  "gearboxid-gearbox",
  "gearboxid",
  "e70",
  "carlist-e70",
  "eq70",
  "e18",
  "carlist-e18",
  "tr",
];
const BODY_KEYS = [
  "body",
  "bodies",
  "bodytype",
  "bodytypes",
  "category",
  "categories",
  "category[]",
  "categoryid-category",
  "categoryid",
  "carlist-category",
  "carlist-categoryid",
  "vehicletype",
  "vehicletypes",
  "c",
];
const COLOR_KEYS = ["color", "colors", "colour", "colours", "color[]", "exteriorcolor", "exteriorcolours", "colorid-color"];
const DRIVE_KEYS = ["drive", "drives", "drivetype", "drivetypes", "drivetrain", "wheeldrive", "iriss_drive"];
const ENGINE_FROM_KEYS = [
  "enginefrom",
  "engine_from",
  "engine",
  "minengine",
  "cubiccapacityfrom",
  "mincubiccapacity",
  "displacementfrom",
];
const ENGINE_TO_KEYS = ["engineto", "engine_to", "maxengine", "cubiccapacityto", "maxcubiccapacity", "displacementto"];
const DOOR_FROM_KEYS = ["doorsfrom", "doors_from", "mindoors", "doorfrom", "doors", "doorcount"];
const DOOR_TO_KEYS = ["doorsto", "doors_to", "maxdoors", "doorto"];
const SEAT_FROM_KEYS = ["seatsfrom", "seats_from", "minseats", "places_from", "seats", "seatcount", "places"];
const SEAT_TO_KEYS = ["seatsto", "seats_to", "maxseats", "places_to"];
const VAT_KEYS = ["vat", "vat[]", "vattype", "vatdeductible"];
const EMISSION_KEYS = ["emission", "emissionclass", "emission_from", "emission_class", "euroclass"];
const EQUIP_KEYS = ["equipment", "equipmentids", "features", "options", "options[]", "iriss_need", "am"];
const EXCLUDE_KEYS = ["exclude", "excluded", "excludedmodels", "negativ", "iriss_exclude"];
const EXCLUDE_COLOR_KEYS = ["excludecolor", "excludedcolors", "iriss_exclude_color"];
const COUNTRY_KEYS = ["country", "countries", "country[]", "origincountries", "locations"];

const HANDLED_KEYS = new Set(
  [
    ...MAKE_KEYS,
    ...MODEL_KEYS,
    ...YEAR_FROM_KEYS,
    ...YEAR_TO_KEYS,
    ...KM_FROM_KEYS,
    ...KM_TO_KEYS,
    ...PRICE_FROM_KEYS,
    ...PRICE_TO_KEYS,
    ...POWER_FROM_KEYS,
    ...POWER_TO_KEYS,
    ...HP_FROM_KEYS,
    ...HP_TO_KEYS,
    ...FUEL_KEYS,
    ...GEAR_KEYS,
    ...BODY_KEYS,
    ...COLOR_KEYS,
    ...DRIVE_KEYS,
    ...ENGINE_FROM_KEYS,
    ...ENGINE_TO_KEYS,
    ...DOOR_FROM_KEYS,
    ...DOOR_TO_KEYS,
    ...SEAT_FROM_KEYS,
    ...SEAT_TO_KEYS,
    ...VAT_KEYS,
    ...EMISSION_KEYS,
    ...EQUIP_KEYS,
    ...EXCLUDE_KEYS,
    ...EXCLUDE_COLOR_KEYS,
    ...COUNTRY_KEYS,
    "brandid-brand",
    "brandid",
    "brand-id",
    "name-brand",
    "manufacturers",
    "makesmodels",
    "registrationyears",
    "mileages",
    "prices",
    "enginesizes",
    "kws",
    "horsepowers",
    "p",
    "cc",
    "fr",
    "ml",
    "pw",
    "e17",
    "carlist-e17",
    "kilometresfrom-e68_1",
    "kilometresto-e68_2",
    "carlist-e68from",
    "carlist-e68to",
    "poweroutputfrom",
    "poweroutputto",
    "carlist-e21from",
    "carlist-e21to",
    "carlist-e19from",
    "carlist-e19to",
    "carlist-manufacturermodel",
    "startprice2",
    "ms",
    "q",
    "query",
    "search",
    "name",
    "iriss_drive",
    "iriss_need",
    "iriss_exclude",
    "iriss_exclude_color",
  ].map((k) => k.toLowerCase()),
);

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
      for (const part of v.split(/[,;]/)) {
        const t = part.trim();
        if (t) out.push(t);
      }
    }
  }
  return out;
}

function rawValues(params: Map<string, string[]>, keys: string[]): string[] {
  const out: string[] = [];
  for (const key of keys) {
    for (const v of params.get(key) ?? []) {
      const t = v.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

function applyRange(
  filter: EcarstradeSearchFilter,
  raw: string,
  fromKey: "yearFrom" | "mileageFrom" | "priceFrom" | "powerFromKw" | "engineFromCc",
  toKey: "yearTo" | "mileageTo" | "priceTo" | "powerToKw" | "engineToCc",
  parseYear = false,
): void {
  const range = parseZeroUnboundedRange(raw);
  let from = range.from;
  let to = range.to;
  if (parseYear) {
    if (from != null && (from < 1980 || from > 2035)) from = null;
    if (to != null && (to < 1980 || to > 2035)) to = null;
  }
  if (from != null && filter[fromKey] == null) filter[fromKey] = from;
  if (to != null && filter[toKey] == null) filter[toKey] = to;
}

function applyMakeModelPairs(filter: EcarstradeSearchFilter, pairs: MakeModelPair[], idSpace: MakeIdSpace): void {
  for (const pair of pairs) {
    applyMakeToken(filter, pair.make, idSpace);
    if (!pair.model) continue;
    const make = resolveEcarstradeMake(pair.make);
    if (make) {
      const model = resolveEcarstradeModel(make.id, pair.model);
      if (model) {
        pushResolvedModel(filter, model);
        continue;
      }
    }
    applyModelToken(filter, pair.model, "name");
  }
}

function pushResolvedModel(filter: EcarstradeSearchFilter, model: { id: number; name: string }): void {
  if (!filter.modelIds.includes(model.id)) filter.modelIds.push(model.id);
  if (filter.modelId == null) filter.modelId = model.id;
  const names = filter.modelName
    ? filter.modelName.split(", ").map((s) => s.trim()).filter(Boolean)
    : [];
  if (!names.includes(model.name)) names.push(model.name);
  filter.modelName = names.join(", ");
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

type MakeIdSpace = "ecarstrade" | "autobid" | "name";

function hostMakeIdSpace(url: URL): MakeIdSpace {
  const host = url.hostname.toLowerCase();
  if (host === "ecarstrade.com" || host.endsWith(".ecarstrade.com")) return "ecarstrade";
  if (host === "autobid.de" || host.endsWith(".autobid.de")) return "autobid";
  return "name";
}

function applyMakeToken(filter: EcarstradeSearchFilter, makeRaw: string, idSpace: MakeIdSpace): void {
  const t = makeRaw.trim();
  if (!t) return;
  if (/^\d+$/.test(t)) {
    if (idSpace === "ecarstrade") {
      const byId = resolveEcarstradeMakeById(Number.parseInt(t, 10));
      if (byId) {
        pushMake(filter, byId);
        return;
      }
      filter.unmapped.push({
        key: "mark[]",
        value: t,
        reason: "eCarsTrade mark id nav katalogā; marka ņemta no brandModel, ja ir",
      });
      return;
    }
    if (idSpace === "autobid") {
      const fromId = resolveEcarstradeMakeFromBrandId(t);
      if (fromId) {
        pushMake(filter, fromId);
        return;
      }
      filter.unmapped.push({
        key: "brandId",
        value: t,
        reason: "Autobid brandId nav kartē; marka ņemta no brandModel, ja ir",
      });
      return;
    }
    filter.unmapped.push({
      key: "make",
      value: t,
      reason: "skaitlisks markas kods bez zināma kataloga (nav ET mark[] un nav Autobid brandId)",
    });
    return;
  }
  const fromBrand = resolveMakesFromBrand(t);
  if (fromBrand.makes.length > 0) {
    for (const mark of fromBrand.makes) pushMake(filter, mark);
    return;
  }
  const make = resolveEcarstradeMake(t);
  if (make) pushMake(filter, make);
}

function applyModelToken(filter: EcarstradeSearchFilter, modelRaw: string, idSpace: MakeIdSpace = "name"): void {
  const modelText = stripKnownSuffixes(modelRaw);
  if (!modelText) return;
  for (const makeId of filter.makeIds) {
    if (/^\d+$/.test(modelText) && idSpace === "ecarstrade") {
      const byId = resolveEcarstradeModelById(makeId, Number.parseInt(modelText, 10));
      if (byId) {
        pushResolvedModel(filter, byId);
        return;
      }
    }
    const model = resolveEcarstradeModel(makeId, modelText);
    if (model) {
      pushResolvedModel(filter, model);
      return;
    }
  }
  if (!filter.modelName && !/^\d+$/.test(modelText)) filter.modelName = modelText;
}

function pushDriveFromText(filter: EcarstradeSearchFilter, raw: string): void {
  const d = mapEcarstradeDrive(raw);
  if (d && !filter.drives.includes(d)) filter.drives.push(d);
}

function collectUnmapped(params: Map<string, string[]>, filter: EcarstradeSearchFilter): void {
  for (const [key, vals] of params) {
    if (isNoiseSearchParam(key) || HANDLED_KEYS.has(key)) continue;
    if (key.endsWith("[]") && HANDLED_KEYS.has(key.slice(0, -2))) continue;
    const value = vals.filter(Boolean).join(", ");
    if (!value) continue;
    filter.unmapped.push({
      key,
      value: value.slice(0, 180),
      reason: "ET meklēšanā nav atbilstoša URL parametra; ingest post-filtrs, ja iespējams",
    });
  }
}

export function parseListingSearchDetailed(rawUrl: string): ParsedListingSearch {
  const filter = emptyFilter();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { filter, sourceUrl: rawUrl, rawKeys: [] };
  }
  const params = collectParams(url);
  const idSpace = hostMakeIdSpace(url);
  for (const raw of rawValues(params, ["manufacturers"])) {
    applyMakeModelPairs(filter, parseAuto1Manufacturers(raw), "name");
  }
  for (const raw of rawValues(params, ["makesmodels"])) {
    applyMakeModelPairs(filter, parseOpenlaneMakesModels(raw), "name");
  }
  for (const raw of rawValues(params, ["carlist-manufacturermodel"])) {
    applyMakeModelPairs(filter, parseAutobidCarlistManufacturerModel(raw), "name");
  }
  for (const raw of values(params, MAKE_KEYS)) applyMakeToken(filter, raw, idSpace);
  for (const raw of values(params, ["brandid-brand", "brandid", "brand-id"])) {
    applyMakeToken(filter, raw, "autobid");
  }
  for (const raw of values(params, ["name-brand"])) applyMakeToken(filter, raw, "name");
  for (const ms of rawValues(params, ["ms"])) {
    const parsed = resolveMakeFromMobileMs(ms);
    if (parsed.make) applyMakeToken(filter, parsed.make, "name");
    else if (ms.trim() && !/wohnmobil|evado|westfalia|generation/i.test(ms)) {
      filter.unmapped.push({ key: "ms", value: ms, reason: "mobile.de makeId nav kartē" });
    }
    if (parsed.model) applyModelToken(filter, parsed.model, "name");
    else if (parsed.modelId) {
      filter.unmapped.push({
        key: "ms",
        value: `${parsed.modelId}`,
        reason: "mobile.de modelId nav kartē; modelis ņemts no brandModel, ja ir viens",
      });
    }
  }
  for (const raw of values(params, MODEL_KEYS)) applyModelToken(filter, raw, idSpace);
  if (idSpace === "autobid" && !filter.modelName) {
    applyModelToken(filter, values(params, ["name"])[0] ?? "", "name");
  }

  filter.yearFrom = firstInt(params, YEAR_FROM_KEYS, yearFromRaw);
  filter.yearTo = firstInt(params, YEAR_TO_KEYS, yearFromRaw);
  for (const raw of rawValues(params, ["fr"])) {
    const range = parseMobileDeColonRange(raw);
    let from = range.from;
    let to = range.to;
    if (from != null && (from < 1980 || from > 2035)) from = null;
    if (to != null && (to < 1980 || to > 2035)) to = null;
    if (from != null && filter.yearFrom == null) filter.yearFrom = from;
    if (to != null && filter.yearTo == null) filter.yearTo = to;
  }
  for (const raw of rawValues(params, ["registrationyears"])) applyRange(filter, raw, "yearFrom", "yearTo", true);
  filter.mileageFrom = firstInt(params, KM_FROM_KEYS);
  filter.mileageTo = firstInt(params, KM_TO_KEYS);
  for (const raw of rawValues(params, ["mileages", "ml"])) applyRange(filter, raw, "mileageFrom", "mileageTo");
  filter.priceFrom = firstInt(params, PRICE_FROM_KEYS);
  filter.priceTo = firstInt(params, PRICE_TO_KEYS);
  for (const raw of rawValues(params, ["prices", "p"])) applyRange(filter, raw, "priceFrom", "priceTo");
  filter.powerFromKw = firstInt(params, POWER_FROM_KEYS);
  filter.powerToKw = firstInt(params, POWER_TO_KEYS);
  for (const raw of rawValues(params, ["kws", "pw"])) applyRange(filter, raw, "powerFromKw", "powerToKw");
  const hpFrom = firstInt(params, HP_FROM_KEYS);
  const hpTo = firstInt(params, HP_TO_KEYS);
  const powerUnit = (params.get("powerunit") ?? [])[0]?.toLowerCase() ?? "";
  if (filter.powerFromKw == null && hpFrom != null) filter.powerFromKw = hpToKw(hpFrom);
  if (filter.powerToKw == null && hpTo != null) filter.powerToKw = hpToKw(hpTo);
  if (powerUnit === "hp") {
    if (filter.powerFromKw != null) filter.powerFromKw = hpToKw(filter.powerFromKw);
    if (filter.powerToKw != null) filter.powerToKw = hpToKw(filter.powerToKw);
  }
  for (const raw of rawValues(params, ["horsepowers"])) {
    const range = parseZeroUnboundedRange(raw);
    if (filter.powerFromKw == null && range.from != null) filter.powerFromKw = hpToKw(range.from);
    if (filter.powerToKw == null && range.to != null) filter.powerToKw = hpToKw(range.to);
  }

  const fuels = values(params, FUEL_KEYS).map((raw) => {
    return mapFuel(raw) ?? mapFuel(mapOpenlaneFuelToken(raw) ?? "") ?? mapFuel(mapAutobidFuelToken(raw) ?? "");
  });
  filter.fuels = uniq(fuels.filter((x): x is string => Boolean(x)));
  const gearRaw = values(params, GEAR_KEYS);
  filter.gearboxes = collapseImpliedSemiAutomatic(
    gearRaw,
    uniq(gearRaw.map(mapGearbox).filter((x): x is string => Boolean(x))),
  );
  for (const raw of gearRaw) {
    if (/^\d+$/.test(raw) && !mapGearbox(raw)) {
      filter.unmapped.push({
        key: "gearbox",
        value: raw,
        reason: "kārbas skaitliskais ID nav kartē; ingest post-filtrs, nepaplašina",
      });
    }
  }
  const bodyRaw = uniq([...rawValues(params, BODY_KEYS), ...values(params, BODY_KEYS)]);
  filter.bodies = uniq(bodyRaw.map(mapBody).filter((x): x is string => Boolean(x)));
  for (const raw of bodyRaw) {
    if (!mapBody(raw) && /^\d+$/.test(raw) && !AUTOBID_VEHICLE_TYPE_IDS.has(raw)) {
      filter.unmapped.push({
        key: "category",
        value: raw,
        reason: "virsbūves skaitliskais ID nav kartē; ingest post-filtrs, nepaplašina",
      });
    }
  }
  filter.colors = uniq(values(params, COLOR_KEYS).map(mapEcarstradeColor).filter((x): x is string => Boolean(x)));
  for (const raw of values(params, DRIVE_KEYS)) pushDriveFromText(filter, raw);

  filter.engineFromCc = firstInt(params, ENGINE_FROM_KEYS, (v) => mapEngineCc(v) ?? intFromRaw(v));
  filter.engineToCc = firstInt(params, ENGINE_TO_KEYS, (v) => mapEngineCc(v) ?? intFromRaw(v));
  for (const raw of rawValues(params, ["enginesizes", "cc"])) applyRange(filter, raw, "engineFromCc", "engineToCc");
  filter.doorsFrom = firstInt(params, DOOR_FROM_KEYS);
  filter.doorsTo = firstInt(params, DOOR_TO_KEYS);
  filter.seatsFrom = firstInt(params, SEAT_FROM_KEYS);
  filter.seatsTo = firstInt(params, SEAT_TO_KEYS);
  filter.vat = uniq(values(params, VAT_KEYS).map(mapVat).filter((x): x is string => Boolean(x)));
  filter.emissionFrom = values(params, EMISSION_KEYS).map(mapEmissionClass).find(Boolean) ?? "";
  filter.includeTokens = uniq(values(params, EQUIP_KEYS).flatMap(splitListTokens).filter((t) => !/^\d+$/.test(t)));
  filter.excludeTokens = uniq(values(params, EXCLUDE_KEYS).flatMap(splitListTokens));
  filter.excludeColors = uniq(
    values(params, EXCLUDE_COLOR_KEYS).map(mapEcarstradeColor).filter((x): x is string => Boolean(x)),
  );

  for (const country of values(params, COUNTRY_KEYS)) {
    const s = country.trim();
    if (!s) continue;
    if (/^(be|bel|nl|net|nld|lu|lux|de|ger|deu|belgium|netherlands|luxembourg|germany)$/i.test(s)) continue;
    filter.unmapped.push({
      key: "country",
      value: s,
      reason: "ET nolasīšana paliek BE/NL/LU/DE; citas valstis URL nepaplašina",
    });
  }

  collectUnmapped(params, filter);
  return { filter, sourceUrl: rawUrl, rawKeys: [...params.keys()] };
}

export function parseListingSearchUrl(rawUrl: string): EcarstradeSearchFilter {
  return parseListingSearchDetailed(rawUrl).filter;
}

/**
 * Nils: bez pielaidēm. Agrāk ±1 gads / ±200 cm³; tagad atstāj avota vērtības.
 * @deprecated identitāte; nelietot plānošanā, lai nelaistu vaļīgākus filtrus.
 */
export function widenExactSearchBounds(filter: EcarstradeSearchFilter): EcarstradeSearchFilter {
  return cloneEcarstradeFilter(filter);
}

function resolvePendingModels(filter: EcarstradeSearchFilter): EcarstradeSearchFilter {
  if (!filter.makeIds.length) return filter;
  if (filter.modelIds.length || filter.modelId) return filter;
  const names = filter.modelName
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.length) return filter;
  const next = cloneEcarstradeFilter(filter);
  for (const name of names) {
    for (const makeId of next.makeIds) {
      const model = resolveEcarstradeModel(makeId, name);
      if (model) {
        pushResolvedModel(next, model);
        break;
      }
    }
  }
  return next;
}

function makeOwnsModelId(makeId: number, modelId: number): boolean {
  return ecarstradeModelsForMake(makeId).some((m) => m.id === modelId);
}

/** Ja izsoles URL ir marka bez modeļa, brandModel var aizpildīt tieši šīs markas modeļus. */
export function fillMissingModelFromBrand(filter: EcarstradeSearchFilter, brandModel: string): EcarstradeSearchFilter {
  const pending = resolvePendingModels(filter);
  if (!pending.makeIds.length) return pending;
  const pairs = resolveMakeModelPairsFromBrand(brandModel);
  const next = cloneEcarstradeFilter(pending);
  let added = false;
  for (const makeId of next.makeIds) {
    if (next.modelIds.some((id) => makeOwnsModelId(makeId, id))) continue;
    const pair = pairs.find((p) => p.make.id === makeId && p.models.length);
    if (!pair) continue;
    for (const model of pair.models) pushResolvedModel(next, model);
    added = true;
  }
  return added ? next : pending;
}

function applySharedBrandCriteria(target: EcarstradeSearchFilter, shared: EcarstradeSearchFilter): void {
  target.yearFrom = shared.yearFrom;
  target.yearTo = shared.yearTo;
  target.mileageFrom = shared.mileageFrom;
  target.mileageTo = shared.mileageTo;
  target.priceFrom = shared.priceFrom;
  target.priceTo = shared.priceTo;
  target.powerFromKw = shared.powerFromKw;
  target.powerToKw = shared.powerToKw;
  target.fuels = [...shared.fuels];
  target.gearboxes = [...shared.gearboxes];
  target.bodies = [...shared.bodies];
  target.engineFromCc = shared.engineFromCc;
  target.engineToCc = shared.engineToCc;
  target.drives = [...shared.drives];
}

/** Viena rinda ar vairākām markām: atsevišķs ET meklējums katrai markai/modelim. */
export function filtersFromBrandModel(brandModel: string): EcarstradeSearchFilter[] {
  const pairs = resolveMakeModelPairsFromBrand(brandModel);
  const shared = filterFromBrandModel(brandModel);
  if (pairs.length <= 1) return [shared];
  return pairs.map((pair) => {
    const filter = emptyFilter();
    pushMake(filter, pair.make);
    if (pair.models.length) {
      for (const model of pair.models) pushResolvedModel(filter, model);
    } else if (pair.modelText) {
      filter.modelName = pair.modelText;
    }
    applySharedBrandCriteria(filter, shared);
    return filter;
  });
}

export function filterFromBrandModel(brandModel: string): EcarstradeSearchFilter {
  const filter = emptyFilter();
  const resolved = resolveMakesFromBrand(brandModel);
  for (const mark of resolved.makes) pushMake(filter, mark);
  if (resolved.models.length && filter.makeIds.length === 1) {
    for (const model of resolved.models) pushResolvedModel(filter, model);
  } else if (resolved.model && filter.makeIds.length === 1) {
    pushResolvedModel(filter, resolved.model);
  } else if (resolved.modelText && filter.makeIds.length === 1) {
    filter.modelName = resolved.modelText;
  }
  const power = extractPowerKwFromBrand(brandModel);
  if (power) {
    filter.powerFromKw = power.from;
    filter.powerToKw = power.to;
  }
  const remainder = `${power?.rest || brandModel} ${resolved.modelText}`;
  const fuel = mapFuel(remainder);
  const gear = mapGearbox(remainder);
  const body = mapBody(remainder);
  if (fuel) filter.fuels = [fuel];
  if (gear) filter.gearboxes = [gear];
  if (body) filter.bodies = [body];
  pushDriveFromText(filter, remainder);
  const cc = mapEngineCc(remainder);
  if (cc) {
    filter.engineFromCc = cc;
    filter.engineToCc = cc;
  }
  return filter;
}

function parseYearPeriod(raw: string): { from: number | null; to: number | null } {
  const t = raw.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-").trim();
  if (!t) return { from: null, to: null };
  const range = t.match(/(19|20)\d{2}\s*[-/]\s*(19|20)\d{2}/);
  if (range) {
    const a = yearFromRaw(range[0]);
    const b = yearFromRaw(range[0].slice(4));
    const years = [a, b].filter((n): n is number => n != null).sort((x, y) => x - y);
    return { from: years[0] ?? null, to: years[1] ?? years[0] ?? null };
  }
  const plus = t.match(/(19|20)\d{2}\s*\+/);
  if (plus) return { from: yearFromRaw(plus[0]), to: null };
  const one = yearFromRaw(t);
  return { from: one, to: one };
}

export function filterFromOrderFields(fields: OrderSearchFields): EcarstradeSearchFilter {
  const filter = filterFromBrandModel(fields.brandModel ?? "");
  const years = parseYearPeriod(fields.productionYears ?? "");
  filter.yearFrom = years.from;
  filter.yearTo = years.to;
  const km = parseIrissOrderBoundRange(fields.maxMileage ?? "");
  if (km.from != null) filter.mileageFrom = km.from;
  if (km.to != null) filter.mileageTo = km.to;
  const budget = parseIrissOrderBoundRange(fields.totalBudget ?? "");
  if (budget.from != null) filter.priceFrom = budget.from;
  if (budget.to != null) filter.priceTo = budget.to;
  const fuel = mapFuel(fields.engineType ?? "");
  if (fuel) filter.fuels = [fuel];
  const cc = mapEngineCc(fields.engineType ?? "");
  if (cc) {
    filter.engineFromCc = cc;
    filter.engineToCc = cc;
  }
  const gear = mapGearbox(fields.transmission ?? "");
  if (gear) filter.gearboxes = [gear];
  const body = mapBody(fields.bodyType ?? "");
  if (body) filter.bodies = [body];
  pushDriveFromText(filter, fields.driveType ?? "");
  const seats = intFromRaw(fields.seatCount ?? "");
  if (seats != null && seats >= 2 && seats <= 9) {
    filter.seatsFrom = seats;
    filter.seatsTo = seats;
  }
  filter.colors = uniq((fields.preferredColors ?? "").split(/[,;/]+/).map(mapEcarstradeColor).filter((x): x is string => Boolean(x)));
  filter.excludeColors = uniq(
    (fields.nonPreferredColors ?? "").split(/[,;/]+/).map(mapEcarstradeColor).filter((x): x is string => Boolean(x)),
  );
  filter.includeTokens = uniq(splitListTokens(fields.agentNotes ?? ""));
  filter.modelExtensions = splitModelExtensions(fields.modelExtension ?? "");
  if (fields.dealVat21Required) filter.vat = ["reclaimable"];
  return filter;
}

function intersectRange(
  aFrom: number | null,
  aTo: number | null,
  bFrom: number | null,
  bTo: number | null,
): { from: number | null; to: number | null } {
  const from = aFrom == null ? bFrom : bFrom == null ? aFrom : Math.max(aFrom, bFrom);
  const to = aTo == null ? bTo : bTo == null ? aTo : Math.min(aTo, bTo);
  if (from != null && to != null && from > to) return { from: bFrom ?? aFrom, to: bTo ?? aTo };
  return { from, to };
}

/**
 * Pasūtījuma gadi, km, cena, degviela un kārba nonāk ET vaicājumā.
 * Izsoles URL sašaurina diapazonu; tukšu degvielu vai kārbu aizpilda no pasūtījuma.
 * future_api.php ņem year_from/mileage_to; publiskā /search lapa tos ignorē, tāpēc
 * ģenerētajā ET saitē tos neliekam. price_from/price_to, fuel[] un gearbox[] paliek.
 */
export function applyEcarstradeOrderCriteria(
  filter: EcarstradeSearchFilter,
  order: EcarstradeSearchFilter,
): EcarstradeSearchFilter {
  const year = intersectRange(filter.yearFrom, filter.yearTo, order.yearFrom, order.yearTo);
  const km = intersectRange(filter.mileageFrom, filter.mileageTo, order.mileageFrom, order.mileageTo);
  const price = intersectRange(filter.priceFrom, filter.priceTo, order.priceFrom, order.priceTo);
  return {
    ...filter,
    yearFrom: year.from,
    yearTo: year.to,
    mileageFrom: km.from,
    mileageTo: km.to,
    priceFrom: price.from,
    priceTo: price.to,
    fuels: filter.fuels.length ? [...filter.fuels] : [...order.fuels],
    gearboxes: filter.gearboxes.length ? [...filter.gearboxes] : [...order.gearboxes],
    includeTokens: uniq([...(filter.includeTokens ?? []), ...(order.includeTokens ?? [])]),
    modelExtensions: uniq([...(filter.modelExtensions ?? []), ...(order.modelExtensions ?? [])]),
  };
}

/** Tukšos laukus aizpilda no `extra`; jau aizpildītie paliek (avota URL ir prioritāte). */
export function fillFilterGaps(filter: EcarstradeSearchFilter, extra: EcarstradeSearchFilter): EcarstradeSearchFilter {
  const makeIds = filter.makeIds.length ? [...filter.makeIds] : [...extra.makeIds];
  const makeNames = filter.makeIds.length ? [...filter.makeNames] : [...extra.makeNames];
  const modelIds = filter.modelIds.length ? [...filter.modelIds] : [...extra.modelIds];
  const modelId = filter.modelId ?? extra.modelId ?? modelIds[0] ?? null;
  const modelName = filter.modelName || extra.modelName;
  return resolvePendingModels({
    makeIds,
    makeNames,
    modelId,
    modelIds: modelId && !modelIds.includes(modelId) ? [modelId, ...modelIds] : modelIds,
    modelName,
    yearFrom: filter.yearFrom ?? extra.yearFrom,
    yearTo: filter.yearTo ?? extra.yearTo,
    mileageFrom: filter.mileageFrom ?? extra.mileageFrom,
    mileageTo: filter.mileageTo ?? extra.mileageTo,
    priceFrom: filter.priceFrom ?? extra.priceFrom,
    priceTo: filter.priceTo ?? extra.priceTo,
    powerFromKw: filter.powerFromKw ?? extra.powerFromKw,
    powerToKw: filter.powerToKw ?? extra.powerToKw,
    fuels: filter.fuels.length ? filter.fuels : extra.fuels,
    gearboxes: filter.gearboxes.length ? filter.gearboxes : extra.gearboxes,
    bodies: filter.bodies.length ? filter.bodies : extra.bodies,
    colors: filter.colors.length ? filter.colors : extra.colors,
    engineFromCc: filter.engineFromCc ?? extra.engineFromCc,
    engineToCc: filter.engineToCc ?? extra.engineToCc,
    doorsFrom: filter.doorsFrom ?? extra.doorsFrom,
    doorsTo: filter.doorsTo ?? extra.doorsTo,
    seatsFrom: filter.seatsFrom ?? extra.seatsFrom,
    seatsTo: filter.seatsTo ?? extra.seatsTo,
    vat: filter.vat.length ? filter.vat : extra.vat,
    emissionFrom: filter.emissionFrom || extra.emissionFrom,
    drives: uniq([...filter.drives, ...extra.drives]) as EcarstradeDrive[],
    includeTokens: uniq([...filter.includeTokens, ...extra.includeTokens]),
    excludeTokens: uniq([...filter.excludeTokens, ...extra.excludeTokens]),
    excludeColors: uniq([...filter.excludeColors, ...extra.excludeColors]),
    modelExtensions: uniq([...(filter.modelExtensions ?? []), ...(extra.modelExtensions ?? [])]),
    unmapped: [...filter.unmapped, ...extra.unmapped],
  });
}

/** Savieno URL markas ar brandModel tikai tad, ja URL markas nav. */
export function fillMakeModelFromBrand(filter: EcarstradeSearchFilter, brandModel: string): EcarstradeSearchFilter {
  return fillFilterGaps(filter, filterFromBrandModel(brandModel));
}

function mergeBound(a: number | null, b: number | null, pick: "max" | "min"): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return pick === "max" ? Math.max(a, b) : Math.min(a, b);
}

function mergeTokens(a: string[], b: string[]): string[] {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  const set = new Set(a);
  const inter = b.filter((x) => set.has(x));
  return inter.length > 0 ? inter : uniq([...a, ...b]);
}

function sameMakeModel(a: EcarstradeSearchFilter, b: EcarstradeSearchFilter): boolean {
  if (a.makeIds.length === 0 || b.makeIds.length === 0) return false;
  if (a.makeIds.length !== b.makeIds.length) return false;
  const as = [...a.makeIds].sort((x, y) => x - y).join(",");
  const bs = [...b.makeIds].sort((x, y) => x - y).join(",");
  if (as !== bs) return false;
  const am = a.makeIds.length === 1 ? a.modelName || String(a.modelId ?? "") : "";
  const bm = b.makeIds.length === 1 ? b.modelName || String(b.modelId ?? "") : "";
  if (am && bm && am.toLowerCase() !== bm.toLowerCase()) return false;
  return true;
}

function rangesOverlap(aFrom: number | null, aTo: number | null, bFrom: number | null, bTo: number | null): boolean {
  if (aFrom == null && aTo == null) return true;
  if (bFrom == null && bTo == null) return true;
  const aLo = aFrom ?? Number.NEGATIVE_INFINITY;
  const aHi = aTo ?? Number.POSITIVE_INFINITY;
  const bLo = bFrom ?? Number.NEGATIVE_INFINITY;
  const bHi = bTo ?? Number.POSITIVE_INFINITY;
  return aLo <= bHi && bLo <= aHi;
}

function listsConflict(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a);
  return !b.some((x) => set.has(x));
}

export function ecarstradeFiltersConflict(a: EcarstradeSearchFilter, b: EcarstradeSearchFilter): boolean {
  if (!sameMakeModel(a, b)) return true;
  if (listsConflict(a.fuels, b.fuels)) return true;
  if (listsConflict(a.gearboxes, b.gearboxes)) return true;
  if (listsConflict(a.bodies, b.bodies)) return true;
  if (listsConflict(a.drives, b.drives)) return true;
  if (listsConflict(a.colors, b.colors)) return true;
  if (!rangesOverlap(a.yearFrom, a.yearTo, b.yearFrom, b.yearTo)) return true;
  if (!rangesOverlap(a.mileageFrom, a.mileageTo, b.mileageFrom, b.mileageTo)) return true;
  if (!rangesOverlap(a.priceFrom, a.priceTo, b.priceFrom, b.priceTo)) return true;
  if (!rangesOverlap(a.powerFromKw, a.powerToKw, b.powerFromKw, b.powerToKw)) return true;
  return false;
}

function tightenRange(
  aFrom: number | null,
  aTo: number | null,
  bFrom: number | null,
  bTo: number | null,
): { from: number | null; to: number | null } {
  let from = mergeBound(aFrom, bFrom, "max");
  let to = mergeBound(aTo, bTo, "min");
  if (from != null && to != null && from > to) [from, to] = [to, from];
  return { from, to };
}

/** Savietojami filtri: šaurākais gadu/km/cenas/jaudas pārklājums, kopīgās izvēles. */
export function mergeEcarstradeFilters(a: EcarstradeSearchFilter, b: EcarstradeSearchFilter): EcarstradeSearchFilter {
  return mergeCompatibleEcarstradeFilters(a, b);
}

export function mergeCompatibleEcarstradeFilters(a: EcarstradeSearchFilter, b: EcarstradeSearchFilter): EcarstradeSearchFilter {
  const year = tightenRange(a.yearFrom, a.yearTo, b.yearFrom, b.yearTo);
  const km = tightenRange(a.mileageFrom, a.mileageTo, b.mileageFrom, b.mileageTo);
  const price = tightenRange(a.priceFrom, a.priceTo, b.priceFrom, b.priceTo);
  const power = tightenRange(a.powerFromKw, a.powerToKw, b.powerFromKw, b.powerToKw);
  const engine = tightenRange(a.engineFromCc, a.engineToCc, b.engineFromCc, b.engineToCc);
  const doors = tightenRange(a.doorsFrom, a.doorsTo, b.doorsFrom, b.doorsTo);
  const seats = tightenRange(a.seatsFrom, a.seatsTo, b.seatsFrom, b.seatsTo);
  const makeIds = a.makeIds.length ? a.makeIds : b.makeIds;
  const makeNames = a.makeIds.length ? a.makeNames : b.makeNames;
  return {
    makeIds: [...makeIds],
    makeNames: [...makeNames],
    modelId: a.modelId ?? b.modelId,
    modelIds: uniqNums(a.modelIds.length ? a.modelIds : b.modelIds.length ? b.modelIds : [a.modelId ?? b.modelId].filter((n): n is number => n != null)),
    modelName: a.modelName || b.modelName,
    yearFrom: year.from,
    yearTo: year.to,
    mileageFrom: km.from,
    mileageTo: km.to,
    priceFrom: price.from,
    priceTo: price.to,
    powerFromKw: power.from,
    powerToKw: power.to,
    fuels: mergeTokens(a.fuels, b.fuels),
    gearboxes: mergeTokens(a.gearboxes, b.gearboxes),
    bodies: mergeTokens(a.bodies, b.bodies),
    colors: mergeTokens(a.colors, b.colors),
    engineFromCc: engine.from,
    engineToCc: engine.to,
    doorsFrom: doors.from,
    doorsTo: doors.to,
    seatsFrom: seats.from,
    seatsTo: seats.to,
    vat: mergeTokens(a.vat, b.vat),
    emissionFrom: a.emissionFrom || b.emissionFrom,
    drives: uniq([...a.drives, ...b.drives]) as EcarstradeDrive[],
    includeTokens: uniq([...a.includeTokens, ...b.includeTokens]),
    excludeTokens: uniq([...a.excludeTokens, ...b.excludeTokens]),
    excludeColors: uniq([...a.excludeColors, ...b.excludeColors]),
    modelExtensions: uniq([...(a.modelExtensions ?? []), ...(b.modelExtensions ?? [])]),
    unmapped: [...a.unmapped, ...b.unmapped],
  };
}

export type ClusteredEcarstradeFilter = {
  filter: EcarstradeSearchFilter;
  sourceUrls: string[];
};

export function clusterEcarstradeFilters(items: Array<{ filter: EcarstradeSearchFilter; sourceUrl: string }>): ClusteredEcarstradeFilter[] {
  const clusters: ClusteredEcarstradeFilter[] = [];
  for (const item of items) {
    const hit = clusters.find((c) => !ecarstradeFiltersConflict(c.filter, item.filter));
    if (hit) {
      hit.filter = mergeCompatibleEcarstradeFilters(hit.filter, item.filter);
      hit.sourceUrls.push(item.sourceUrl);
    } else {
      clusters.push({ filter: item.filter, sourceUrls: [item.sourceUrl] });
    }
  }
  return clusters;
}

function appendQuery(parts: string[], key: string, value: string): void {
  parts.push(`${key}=${encodeURIComponent(value)}`);
}

export function ecarstradeSearchUrl(filter: EcarstradeSearchFilter): string | null {
  if (filter.makeIds.length === 0) return null;
  const parts: string[] = [];
  for (const id of filter.makeIds) appendQuery(parts, "mark[]", String(id));
  const ids = filter.modelIds.length ? filter.modelIds : filter.modelId != null ? [filter.modelId] : [];
  for (const id of uniqNums(ids)) appendQuery(parts, "model[]", String(id));
  // Publiskā /search lapa year_from / year_to / mileage_from / mileage_to neņem.
  // Filtra objektā gadi un km paliek post-filtram, ja ielīmētajā URL tie jau ir.
  if (filter.priceFrom != null) appendQuery(parts, "price_from", String(filter.priceFrom));
  if (filter.priceTo != null) appendQuery(parts, "price_to", String(filter.priceTo));
  if (filter.powerFromKw != null) appendQuery(parts, "power_from", String(filter.powerFromKw));
  if (filter.powerToKw != null) appendQuery(parts, "power_to", String(filter.powerToKw));
  for (const fuel of uniq(filter.fuels)) appendQuery(parts, "fuel[]", fuel);
  for (const box of uniq(filter.gearboxes)) appendQuery(parts, "gearbox[]", box);
  for (const body of uniq(filter.bodies)) appendQuery(parts, "category[]", body);
  for (const color of uniq(filter.colors)) appendQuery(parts, "color[]", color);
  if (filter.engineFromCc != null) appendQuery(parts, "engine_from", String(filter.engineFromCc));
  if (filter.engineToCc != null) appendQuery(parts, "engine_to", String(filter.engineToCc));
  if (filter.doorsFrom != null) appendQuery(parts, "doors_from", String(filter.doorsFrom));
  if (filter.doorsTo != null) appendQuery(parts, "doors_to", String(filter.doorsTo));
  if (filter.seatsFrom != null) appendQuery(parts, "places_from", String(filter.seatsFrom));
  if (filter.seatsTo != null) appendQuery(parts, "places_to", String(filter.seatsTo));
  for (const vat of uniq(filter.vat)) appendQuery(parts, "vat[]", vat);
  if (filter.emissionFrom) appendQuery(parts, "emission_from", filter.emissionFrom);
  for (const country of ECARSTRADE_ALLOWED_COUNTRY_QUERY) appendQuery(parts, "country[]", country);
  for (const drive of uniq(filter.drives)) appendQuery(parts, "iriss_drive", drive);
  for (const token of uniq(filter.includeTokens)) appendQuery(parts, "iriss_need", token);
  for (const token of uniq(filter.excludeTokens)) appendQuery(parts, "iriss_exclude", token);
  for (const color of uniq(filter.excludeColors)) appendQuery(parts, "iriss_exclude_color", color);
  return `${ECARSTRADE_ORIGIN}${ECARSTRADE_SEARCH_PATH}?${parts.join("&")}`;
}

export function ecarstradeFilterSignature(filter: EcarstradeSearchFilter): string {
  return [
    [...filter.makeIds].sort((a, b) => a - b).join(","),
    filter.modelIds.length ? [...filter.modelIds].sort((a, b) => a - b).join(",") : filter.modelId ?? "",
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
    [...filter.colors].sort().join(","),
    filter.engineFromCc ?? "",
    filter.engineToCc ?? "",
    filter.doorsFrom ?? "",
    filter.doorsTo ?? "",
    filter.seatsFrom ?? "",
    filter.seatsTo ?? "",
    [...filter.vat].sort().join(","),
    filter.emissionFrom,
    [...filter.drives].sort().join(","),
    [...filter.includeTokens].sort().join(","),
    [...filter.excludeTokens].sort().join(","),
    [...filter.excludeColors].sort().join(","),
    [...(filter.modelExtensions ?? [])].sort().join(","),
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

export function describeEcarstradeFilter(filter: EcarstradeSearchFilter): string[] {
  const lines: string[] = [];
  if (filter.makeNames.length) lines.push(`marka: ${filter.makeNames.join(", ")}`);
  if (filter.modelName) {
    const ids = filter.modelIds.length ? filter.modelIds : filter.modelId != null ? [filter.modelId] : [];
    lines.push(`modelis: ${filter.modelName}${ids.length ? ` (id ${ids.join(", ")})` : ""}`);
  }
  if (filter.yearFrom != null || filter.yearTo != null) lines.push(`gadi: ${filter.yearFrom ?? "…"}-${filter.yearTo ?? "…"}`);
  if (filter.mileageFrom != null || filter.mileageTo != null) {
    lines.push(`nobraukums: ${filter.mileageFrom ?? "…"}-${filter.mileageTo ?? "…"} km`);
  }
  if (filter.priceFrom != null || filter.priceTo != null) lines.push(`cena: ${filter.priceFrom ?? "…"}-${filter.priceTo ?? "…"} EUR`);
  if (filter.powerFromKw != null || filter.powerToKw != null) {
    lines.push(`jauda: ${filter.powerFromKw ?? "…"}-${filter.powerToKw ?? "…"} kW`);
  }
  if (filter.fuels.length) lines.push(`degviela: ${filter.fuels.join(", ")}`);
  if (filter.gearboxes.length) lines.push(`kārba: ${filter.gearboxes.join(", ")}`);
  if (filter.bodies.length) lines.push(`virsbūve: ${filter.bodies.join(", ")}`);
  if (filter.colors.length) lines.push(`krāsa: ${filter.colors.join(", ")}`);
  if (filter.engineFromCc != null || filter.engineToCc != null) {
    lines.push(`tilpums: ${filter.engineFromCc ?? "…"}-${filter.engineToCc ?? "…"} cm3`);
  }
  if (filter.doorsFrom != null || filter.doorsTo != null) lines.push(`durvis: ${filter.doorsFrom ?? "…"}-${filter.doorsTo ?? "…"}`);
  if (filter.seatsFrom != null || filter.seatsTo != null) lines.push(`vietas: ${filter.seatsFrom ?? "…"}-${filter.seatsTo ?? "…"}`);
  if (filter.vat.length) lines.push(`PVN: ${filter.vat.join(", ")}`);
  if (filter.emissionFrom) lines.push(`emisija: ${filter.emissionFrom}`);
  if (filter.drives.length) lines.push(`piedziņa (post-filtrs): ${filter.drives.join(", ")}`);
  if (filter.includeTokens.length) lines.push(`aprīkojums (post-filtrs): ${filter.includeTokens.join(", ")}`);
  if (filter.modelExtensions?.length) lines.push(`modeļa paplašinājums: ${filter.modelExtensions.join(", ")}`);
  if (filter.excludeTokens.length) lines.push(`izslēgts (post-filtrs): ${filter.excludeTokens.join(", ")}`);
  if (filter.excludeColors.length) lines.push(`izslēgtas krāsas (post-filtrs): ${filter.excludeColors.join(", ")}`);
  if (filter.unmapped.length) {
    lines.push(`nav kartējams: ${filter.unmapped.map((u) => `${u.key}=${u.value} (${u.reason})`).join("; ")}`);
  }
  return lines;
}

export function cloneEcarstradeFilter(filter: EcarstradeSearchFilter): EcarstradeSearchFilter {
  return {
    ...filter,
    makeIds: [...filter.makeIds],
    makeNames: [...filter.makeNames],
    modelIds: [...filter.modelIds],
    fuels: [...filter.fuels],
    gearboxes: [...filter.gearboxes],
    bodies: [...filter.bodies],
    colors: [...filter.colors],
    vat: [...filter.vat],
    drives: [...filter.drives],
    includeTokens: [...filter.includeTokens],
    excludeTokens: [...filter.excludeTokens],
    excludeColors: [...filter.excludeColors],
    modelExtensions: [...(filter.modelExtensions ?? [])],
    unmapped: filter.unmapped.map((u) => ({ ...u })),
  };
}
