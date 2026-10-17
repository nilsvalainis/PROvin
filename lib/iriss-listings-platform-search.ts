/**
 * Auto1 / Openlane / Autobid meklēšanas URL no pasūtījuma specifikācijas.
 * Inverse pret `parseListingSearchDetailed` (zināmie testu parametri).
 */

import {
  AUTOBID_BRAND_ID_TO_NAME,
  resolveEcarstradeMakeById,
  resolveEcarstradeModelById,
} from "@/lib/iriss-listings-ecarstrade-catalog";
import {
  appendIrissListingSearchUrl,
  type IrissPasutijumsListingLinkFields,
} from "@/lib/iriss-listing-link-lists";
import {
  ECARSTRADE_BODY,
  ECARSTRADE_FUEL,
  ECARSTRADE_GEARBOX,
  ecarstradeSearchUrl,
  filterFromOrderFields,
  type EcarstradeSearchFilter,
  type OrderSearchFields,
} from "@/lib/iriss-listings-ecarstrade-search";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export const AUTO1_SEARCH_PATH = "https://www.auto1.com/en/app/merchant/cars";
export const OPENLANE_SEARCH_PATH = "https://www.openlane.eu/en/findcar";
export const AUTOBID_SEARCH_PATH = "https://autobid.de/en/search-results";

export type IrissAuctionSearchPlatform = "auto1" | "openline" | "autobid" | "ecarstrade";

const AUTO1_FUEL: Record<string, string> = {
  [ECARSTRADE_FUEL.diesel]: "DIESEL",
  [ECARSTRADE_FUEL.petrol]: "PETROL",
  [ECARSTRADE_FUEL.electric]: "ELECTRIC",
  [ECARSTRADE_FUEL.hybridPetrol]: "HYBRID",
  [ECARSTRADE_FUEL.hybridDiesel]: "HYBRID",
  [ECARSTRADE_FUEL.lpg]: "LPG",
  [ECARSTRADE_FUEL.gas]: "CNG",
};

const OPENLANE_FUEL: Record<string, string> = {
  [ECARSTRADE_FUEL.diesel]: "diesel",
  [ECARSTRADE_FUEL.petrol]: "petrol",
  [ECARSTRADE_FUEL.electric]: "electric",
  [ECARSTRADE_FUEL.hybridPetrol]: "hybrid",
  [ECARSTRADE_FUEL.hybridDiesel]: "hybrid",
  [ECARSTRADE_FUEL.lpg]: "lpg",
  [ECARSTRADE_FUEL.gas]: "cng",
};

const AUTOBID_FUEL: Record<string, string> = {
  [ECARSTRADE_FUEL.petrol]: "2",
  [ECARSTRADE_FUEL.diesel]: "3",
  [ECARSTRADE_FUEL.hybridPetrol]: "6",
  [ECARSTRADE_FUEL.hybridDiesel]: "6",
};

const AUTO1_GEAR: Record<string, string> = {
  [ECARSTRADE_GEARBOX.automatic]: "AUTOMATIC",
  [ECARSTRADE_GEARBOX.manual]: "MANUAL",
  [ECARSTRADE_GEARBOX.semi]: "SEMIAUTOMATIC",
};

const OPENLANE_GEAR: Record<string, string> = {
  [ECARSTRADE_GEARBOX.automatic]: "automatic",
  [ECARSTRADE_GEARBOX.manual]: "manual",
  [ECARSTRADE_GEARBOX.semi]: "semiautomatic",
};

const AUTO1_BODY: Record<string, string> = {
  [ECARSTRADE_BODY.suv]: "SUV",
  [ECARSTRADE_BODY.estate]: "ESTATE",
  [ECARSTRADE_BODY.saloon]: "SEDAN",
  [ECARSTRADE_BODY.convertible]: "CONVERTIBLE",
  [ECARSTRADE_BODY.coupe]: "COUPE",
  [ECARSTRADE_BODY.van]: "VAN",
  [ECARSTRADE_BODY.small]: "SMALL",
};

const AUTO1_DRIVE: Record<string, string> = {
  awd: "ALL_WHEEL",
  fwd: "FRONT_WHEEL",
  rwd: "REAR_WHEEL",
};

const AUTO1_COLOR: Record<string, string> = {
  Black: "BLACK",
  White: "WHITE",
  Grey: "GREY",
  Silver: "SILVER",
  Blue: "BLUE",
  Red: "RED",
  Green: "GREEN",
  Brown: "BROWN",
  Beige: "BEIGE",
  Yellow: "YELLOW",
  Orange: "ORANGE",
};

function appendQuery(parts: string[], key: string, value: string): void {
  if (!value) return;
  parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
}

function makeNames(filter: EcarstradeSearchFilter): string[] {
  if (filter.makeNames.length) return filter.makeNames.map((n) => n.trim()).filter(Boolean);
  return filter.makeIds
    .map((id) => resolveEcarstradeMakeById(id)?.name ?? "")
    .filter(Boolean);
}

function modelNames(filter: EcarstradeSearchFilter): string[] {
  if (filter.modelName.trim()) {
    return filter.modelName
      .split(/[,;/|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const ids = filter.modelIds.length ? filter.modelIds : filter.modelId != null ? [filter.modelId] : [];
  const names: string[] = [];
  for (const makeId of filter.makeIds) {
    for (const modelId of ids) {
      const model = resolveEcarstradeModelById(makeId, modelId);
      if (model?.name && !names.includes(model.name)) names.push(model.name);
    }
  }
  return names;
}

function autobidBrandIdForMake(name: string): string | null {
  const folded = name.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!folded) return null;
  let best: string | null = null;
  for (const [id, brand] of Object.entries(AUTOBID_BRAND_ID_TO_NAME)) {
    const b = brand.toLowerCase();
    if (b === folded || folded.startsWith(b) || b.startsWith(folded) || (folded.includes("mercedes") && b === "mercedes")) {
      if (!best || Number.parseInt(id, 10) < Number.parseInt(best, 10)) best = id;
    }
  }
  return best;
}

export function auto1SearchUrl(filter: EcarstradeSearchFilter): string | null {
  const makes = makeNames(filter);
  if (!makes.length) return null;
  const parts: string[] = [];
  appendQuery(parts, "channel", "24h");
  for (const make of makes) appendQuery(parts, "manufacturer", make.toUpperCase());
  for (const model of modelNames(filter)) appendQuery(parts, "model", model);
  if (filter.yearFrom != null) appendQuery(parts, "firstRegistrationFrom", `${filter.yearFrom}-01-01`);
  if (filter.yearTo != null) appendQuery(parts, "firstRegistrationTo", `${filter.yearTo}-12-31`);
  if (filter.mileageFrom != null) appendQuery(parts, "minMileage", String(filter.mileageFrom));
  if (filter.mileageTo != null) appendQuery(parts, "maxMileage", String(filter.mileageTo));
  if (filter.priceFrom != null) appendQuery(parts, "minPrice", String(filter.priceFrom));
  if (filter.priceTo != null) appendQuery(parts, "maxPrice", String(filter.priceTo));
  if (filter.powerFromKw != null) appendQuery(parts, "powerFrom", String(filter.powerFromKw));
  if (filter.powerToKw != null) appendQuery(parts, "powerTo", String(filter.powerToKw));
  for (const fuel of filter.fuels) {
    const mapped = AUTO1_FUEL[fuel];
    if (mapped) appendQuery(parts, "fuelTypes", mapped);
  }
  for (const gear of filter.gearboxes) {
    const mapped = AUTO1_GEAR[gear];
    if (mapped) appendQuery(parts, "gearboxes", mapped);
  }
  for (const body of filter.bodies) {
    const mapped = AUTO1_BODY[body];
    if (mapped) appendQuery(parts, "bodyTypes", mapped);
  }
  for (const drive of filter.drives) {
    const mapped = AUTO1_DRIVE[drive];
    if (mapped) appendQuery(parts, "driveTypes", mapped);
  }
  for (const color of filter.colors) {
    const mapped = AUTO1_COLOR[color];
    if (mapped) appendQuery(parts, "colors", mapped);
  }
  if (filter.engineFromCc != null) appendQuery(parts, "cubicCapacityFrom", String(filter.engineFromCc));
  if (filter.engineToCc != null) appendQuery(parts, "cubicCapacityTo", String(filter.engineToCc));
  if (filter.doorsFrom != null) appendQuery(parts, "doorCount", String(filter.doorsFrom));
  for (const token of filter.includeTokens) appendQuery(parts, "equipment", token);
  for (const token of filter.excludeTokens) appendQuery(parts, "excludedModels", token);
  return `${AUTO1_SEARCH_PATH}?${parts.join("&")}`;
}

export function openlaneSearchUrl(filter: EcarstradeSearchFilter): string | null {
  const makes = makeNames(filter);
  if (!makes.length) return null;
  const parts: string[] = [];
  for (const make of makes) appendQuery(parts, "makes", make.toLowerCase());
  for (const model of modelNames(filter)) appendQuery(parts, "models", model.toLowerCase());
  if (filter.yearFrom != null) appendQuery(parts, "yearFrom", String(filter.yearFrom));
  if (filter.yearTo != null) appendQuery(parts, "yearTo", String(filter.yearTo));
  if (filter.mileageFrom != null) appendQuery(parts, "mileageFrom", String(filter.mileageFrom));
  if (filter.mileageTo != null) appendQuery(parts, "mileageTo", String(filter.mileageTo));
  if (filter.priceFrom != null) appendQuery(parts, "priceFrom", String(filter.priceFrom));
  if (filter.priceTo != null) appendQuery(parts, "priceTo", String(filter.priceTo));
  for (const fuel of filter.fuels) {
    const mapped = OPENLANE_FUEL[fuel];
    if (mapped) appendQuery(parts, "fuels", mapped);
  }
  for (const gear of filter.gearboxes) {
    const mapped = OPENLANE_GEAR[gear];
    if (mapped) appendQuery(parts, "transmissions", mapped);
  }
  return `${OPENLANE_SEARCH_PATH}?${parts.join("&")}`;
}

export function autobidSearchUrl(filter: EcarstradeSearchFilter): string | null {
  const makes = makeNames(filter);
  if (!makes.length) return null;
  const brandId = autobidBrandIdForMake(makes[0] ?? "");
  if (!brandId) return null;
  const parts: string[] = [];
  appendQuery(parts, "brandId-brand", brandId);
  const models = modelNames(filter);
  if (models[0]) appendQuery(parts, "name-model", models[0]);
  if (filter.yearFrom != null) appendQuery(parts, "yearFrom-year", String(filter.yearFrom));
  if (filter.yearTo != null) appendQuery(parts, "yearTo-year", String(filter.yearTo));
  if (filter.mileageFrom != null) appendQuery(parts, "mileageFrom-mileage", String(filter.mileageFrom));
  if (filter.mileageTo != null) appendQuery(parts, "mileageTo-mileage", String(filter.mileageTo));
  if (filter.priceFrom != null) appendQuery(parts, "priceFrom-price", String(filter.priceFrom));
  if (filter.priceTo != null) appendQuery(parts, "priceTo-price", String(filter.priceTo));
  for (const fuel of filter.fuels) {
    const mapped = AUTOBID_FUEL[fuel];
    if (mapped) appendQuery(parts, "e17", mapped);
  }
  if (filter.gearboxes.includes(ECARSTRADE_GEARBOX.automatic)) {
    appendQuery(parts, "gearboxId-gearbox", "Automatic");
  } else if (filter.gearboxes.includes(ECARSTRADE_GEARBOX.manual)) {
    appendQuery(parts, "gearboxId-gearbox", "Manual");
  }
  return `${AUTOBID_SEARCH_PATH}?${parts.join("&")}`;
}

export function listingPlatformSearchUrl(
  platform: IrissAuctionSearchPlatform,
  fields: OrderSearchFields,
): string | null {
  const filter = filterFromOrderFields(fields);
  if (platform === "auto1") return auto1SearchUrl(filter);
  if (platform === "openline") return openlaneSearchUrl(filter);
  if (platform === "autobid") return autobidSearchUrl(filter);
  return ecarstradeSearchUrl(filter);
}

const PLATFORM_LINK_KEY: Record<IrissAuctionSearchPlatform, keyof IrissPasutijumsListingLinkFields> = {
  auto1: "listingLinkAuto1",
  openline: "listingLinkOpenline",
  autobid: "listingLinkAutobid",
  ecarstrade: "listingLinkEcarstrade",
};

export function applyGeneratedPlatformSearchLink<T extends IrissPasutijumsListingLinkFields & OrderSearchFields>(
  rec: T,
  platform: IrissAuctionSearchPlatform,
): { record: T; url: string | null } {
  const url = listingPlatformSearchUrl(platform, rec);
  if (!url) return { record: rec, url: null };
  const key = PLATFORM_LINK_KEY[platform];
  const next = appendIrissListingSearchUrl(rec[key], url);
  if (next === rec[key] || (next.length === rec[key].length && next.every((u, i) => u === rec[key][i]))) {
    return { record: rec, url };
  }
  return { record: { ...rec, [key]: next }, url };
}

export function isIrissAuctionSearchPlatform(v: string): v is IrissAuctionSearchPlatform {
  return v === "auto1" || v === "openline" || v === "autobid" || v === "ecarstrade";
}

export function listingPlatformFromAdminKey(platform: IrissListingPlatform | "ecarstrade"): IrissAuctionSearchPlatform | null {
  if (platform === "auto1" || platform === "openline" || platform === "autobid" || platform === "ecarstrade") {
    return platform;
  }
  return null;
}
