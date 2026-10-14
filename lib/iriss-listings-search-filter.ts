import { resolveEcarstradeMake, resolveMakesFromBrand } from "@/lib/iriss-listings-ecarstrade-catalog";
import { driveTokensForMatch, mapEcarstradeColor } from "@/lib/iriss-listings-ecarstrade-criteria";
import {
  fillMakeModelFromBrand,
  parseListingSearchUrl,
  type EcarstradeSearchFilter,
} from "@/lib/iriss-listings-ecarstrade-search";
import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export type ListingSearchVehicle = {
  title?: string;
  manufacturer?: string;
  year?: string;
  firstRegistration?: string;
  mileageKm?: number | null;
  fuel?: string;
  transmission?: string;
  powerKw?: string;
  bodyType?: string;
  color?: string;
  doorCount?: string;
  priceStart?: number | null;
  priceCurrent?: number | null;
  priceBuyNow?: number | null;
  priceMinimal?: number | null;
};

function norm(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesToken(hay: string, needle: string): boolean {
  const h = norm(hay);
  const n = norm(needle);
  if (!h || !n) return false;
  return h.includes(n) || n.includes(h);
}

function yearOf(v: ListingSearchVehicle): number | null {
  const fromYear = Number.parseInt((v.year ?? "").replace(/[^\d]/g, "").slice(0, 4), 10);
  if (fromYear >= 1980 && fromYear <= 2035) return fromYear;
  const fromReg = Number.parseInt((v.firstRegistration ?? "").replace(/[^\d]/g, "").slice(0, 4), 10);
  return fromReg >= 1980 && fromReg <= 2035 ? fromReg : null;
}

function powerOf(v: ListingSearchVehicle): number | null {
  const n = Number.parseInt(String(v.powerKw ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function priceOf(v: ListingSearchVehicle): number | null {
  for (const n of [v.priceCurrent, v.priceBuyNow, v.priceStart, v.priceMinimal]) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function doorsOf(v: ListingSearchVehicle): number | null {
  const n = Number.parseInt(String(v.doorCount ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inRange(value: number | null, from: number | null, to: number | null): boolean {
  if (from == null && to == null) return true;
  if (value == null) return true;
  if (from != null && value < from) return false;
  if (to != null && value > to) return false;
  return true;
}

function matchesAny(hay: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  if (!hay.trim()) return true;
  return tokens.some((t) => includesToken(hay, t));
}

function makeMatchesHay(hay: string, name: string): boolean {
  if (includesToken(hay, name)) return true;
  const mark = resolveEcarstradeMake(name);
  if (mark && includesToken(hay, mark.name)) return true;
  const fromHay = resolveEcarstradeMake(hay);
  if (fromHay && (fromHay.name.toLowerCase() === name.toLowerCase() || (mark && fromHay.id === mark.id))) return true;
  for (const part of hay.split(/[\s,/|+]+/)) {
    const fromPart = resolveEcarstradeMake(part);
    if (!fromPart) continue;
    if (fromPart.name.toLowerCase() === name.toLowerCase()) return true;
    if (mark && fromPart.id === mark.id) return true;
  }
  return false;
}

function driveMatches(hay: string, drives: EcarstradeSearchFilter["drives"]): boolean {
  if (drives.length === 0) return true;
  if (!hay.trim()) return true;
  const wanted = drives.some((d) => driveTokensForMatch(d).some((t) => includesToken(hay, t)));
  if (wanted) return true;
  const other = (["awd", "fwd", "rwd"] as const).filter((d) => !drives.includes(d));
  const hasOther = other.some((d) => driveTokensForMatch(d).some((t) => includesToken(hay, t)));
  return !hasOther;
}

function colorMatches(raw: string, wanted: string[], excluded: string[]): boolean {
  if (!raw.trim()) return true;
  const mapped = mapEcarstradeColor(raw);
  const hay = mapped || raw;
  if (excluded.some((c) => includesToken(hay, c))) return false;
  if (wanted.length === 0) return true;
  return wanted.some((c) => includesToken(hay, c));
}

function excludeMatches(hay: string, tokens: string[]): boolean {
  if (tokens.length === 0 || !hay.trim()) return true;
  return !tokens.some((t) => includesToken(hay, t));
}

/** Sistēmas puses filtrs pret nolasīto auto (eCarsTrade API daļu parametru ignorē). */
export function vehicleMatchesSearchFilter(v: ListingSearchVehicle, filter: EcarstradeSearchFilter): boolean {
  const hay = `${v.manufacturer ?? ""} ${v.title ?? ""}`;
  if (hay.trim() && filter.makeNames.length > 0 && !filter.makeNames.some((name) => makeMatchesHay(hay, name))) return false;
  if (hay.trim() && filter.makeIds.length === 1 && filter.modelName && !includesToken(hay, filter.modelName)) return false;
  if (!inRange(yearOf(v), filter.yearFrom, filter.yearTo)) return false;
  if (!inRange(v.mileageKm ?? null, filter.mileageFrom, filter.mileageTo)) return false;
  if (!inRange(priceOf(v), filter.priceFrom, filter.priceTo)) return false;
  if (!inRange(powerOf(v), filter.powerFromKw, filter.powerToKw)) return false;
  if (!inRange(doorsOf(v), filter.doorsFrom, filter.doorsTo)) return false;
  if (!matchesAny(v.fuel ?? "", filter.fuels)) return false;
  if (!matchesAny(v.transmission ?? "", filter.gearboxes)) return false;
  if (!matchesAny(`${v.bodyType ?? ""} ${v.title ?? ""}`, filter.bodies)) return false;
  if (!driveMatches(`${v.title ?? ""} ${v.bodyType ?? ""}`, filter.drives)) return false;
  if (!colorMatches(v.color ?? "", filter.colors, filter.excludeColors)) return false;
  if (!excludeMatches(hay, filter.excludeTokens)) return false;
  return true;
}

export function listingSourceHasMakeParams(sourceUrl: string): boolean {
  return parseListingSearchUrl(sourceUrl).makeIds.length > 0;
}

const AUTO1_MANUFACTURER: Record<string, string> = {
  volvo: "VOLVO",
  bmw: "BMW",
  audi: "AUDI",
  mercedes: "MERCEDES_BENZ",
  volkswagen: "VOLKSWAGEN",
  toyota: "TOYOTA",
  lexus: "LEXUS",
  porsche: "PORSCHE",
  skoda: "SKODA",
  kia: "KIA",
  hyundai: "HYUNDAI",
  ford: "FORD",
  opel: "OPEL",
  peugeot: "PEUGEOT",
  renault: "RENAULT",
  seat: "SEAT",
  cupra: "CUPRA",
  tesla: "TESLA",
  mazda: "MAZDA",
  honda: "HONDA",
  nissan: "NISSAN",
  mitsubishi: "MITSUBISHI",
  jaguar: "JAGUAR",
  jeep: "JEEP",
  dacia: "DACIA",
  fiat: "FIAT",
  mini: "MINI",
  landrover: "LAND_ROVER",
  "land rover": "LAND_ROVER",
  alfaromeo: "ALFA_ROMEO",
  "alfa romeo": "ALFA_ROMEO",
  polestar: "POLESTAR",
  suzuki: "SUZUKI",
  subaru: "SUBARU",
};

function auto1Manufacturer(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return AUTO1_MANUFACTURER[key] ?? AUTO1_MANUFACTURER[key.replace(/\s+/g, "")] ?? name.toUpperCase().replace(/\s+/g, "_");
}

/**
 * Tukši Auto1/Openlane/Autobid meklējumi (tikai `channel=24h` / tukšs findcar) nolasot
 * visu inventāru noildz. Ievieto marku no brandModel, ja URL to jau nesatur.
 */
export function enrichListingSearchUrl(
  platform: IrissListingPlatform | "mobile",
  sourceUrl: string,
  brandModel: string,
): string {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return sourceUrl;
  }
  if (listingSourceHasMakeParams(sourceUrl)) return sourceUrl;
  const filter = fillMakeModelFromBrand(parseListingSearchUrl(sourceUrl), brandModel);
  if (filter.makeIds.length === 0) return sourceUrl;
  const names = filter.makeNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    names.push(...resolveMakesFromBrand(brandModel).makes.map((m) => m.name));
  }
  if (names.length === 0) return sourceUrl;

  if (platform === "auto1") {
    url.searchParams.set("manufacturer", auto1Manufacturer(names[0]!));
    if (filter.modelName && names.length === 1) url.searchParams.set("model", filter.modelName);
    if (filter.powerFromKw != null) url.searchParams.set("powerFrom", String(filter.powerFromKw));
    if (filter.powerToKw != null) url.searchParams.set("powerTo", String(filter.powerToKw));
    return url.toString();
  }
  if (platform === "openline") {
    url.searchParams.delete("makes");
    for (const name of names) url.searchParams.append("makes", name.toLowerCase());
    if (filter.modelName && names.length === 1) url.searchParams.set("models", filter.modelName.toLowerCase());
    if (filter.powerFromKw != null) url.searchParams.set("powerFrom", String(filter.powerFromKw));
    if (filter.powerToKw != null) url.searchParams.set("powerTo", String(filter.powerToKw));
    return url.toString();
  }
  if (platform === "autobid") {
    url.searchParams.set("name-brand", names[0]!);
    if (filter.modelName && names.length === 1) url.searchParams.set("name-model", filter.modelName);
    return url.toString();
  }
  if (platform === "mobile") {
    url.searchParams.set("make", names[0]!);
    if (filter.powerFromKw != null) url.searchParams.set("minPowerAsArray", String(filter.powerFromKw));
    if (filter.powerToKw != null) url.searchParams.set("maxPowerAsArray", String(filter.powerToKw));
    return url.toString();
  }
  return sourceUrl;
}

export function filterForListingSource(sourceUrl: string, brandModel: string): EcarstradeSearchFilter {
  return fillMakeModelFromBrand(parseListingSearchUrl(sourceUrl), brandModel);
}

export function applySearchFilterToVehicles<T extends ListingSearchVehicle>(
  vehicles: readonly T[],
  filter: EcarstradeSearchFilter,
): T[] {
  const hasBound =
    filter.makeNames.length > 0 ||
    filter.makeIds.length > 0 ||
    filter.yearFrom != null ||
    filter.yearTo != null ||
    filter.mileageFrom != null ||
    filter.mileageTo != null ||
    filter.priceFrom != null ||
    filter.priceTo != null ||
    filter.powerFromKw != null ||
    filter.powerToKw != null ||
    filter.fuels.length > 0 ||
    filter.gearboxes.length > 0 ||
    filter.bodies.length > 0 ||
    filter.colors.length > 0 ||
    filter.drives.length > 0 ||
    filter.includeTokens.length > 0 ||
    filter.excludeTokens.length > 0 ||
    filter.excludeColors.length > 0 ||
    filter.doorsFrom != null ||
    filter.doorsTo != null;
  if (!hasBound) return [...vehicles];
  return vehicles.filter((v) => vehicleMatchesSearchFilter(v, filter));
}

export function listingSearchNeedsMake(platform: IrissListingPlatform | "mobile"): boolean {
  return platform === "auto1" || platform === "openline" || platform === "autobid";
}
