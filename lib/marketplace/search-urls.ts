/**
 * mobile.de / AutoScout24 meklēšanas URL no IRISS tirgus vaicājuma.
 * Actoram dodam startUrls plus strukturētos filtrus. Nezināmus laukus actor var ignorēt.
 */

import { MOBILE_DE_MAKE_ID_TO_NAME } from "@/lib/iriss-listings-ecarstrade-criteria";
import type { MarketplaceLimits, MarketplacePlatform, MarketplaceQuery } from "@/lib/marketplace/types";

function fold(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slug(raw: string): string {
  return fold(raw)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mobileDeMakeId(make: string): string | null {
  const want = fold(make);
  if (!want) return null;
  for (const [id, name] of Object.entries(MOBILE_DE_MAKE_ID_TO_NAME)) {
    if (fold(name) === want) return id;
  }
  return null;
}

function mobileFuel(raw: string): string {
  const t = fold(raw);
  if (/dizel|diesel/.test(t)) return "DIESEL";
  if (/hybrid/.test(t)) return "HYBRID";
  if (/electro|electric|ev\b/.test(t)) return "ELECTRIC";
  if (/lpg/.test(t)) return "LPG";
  if (/cng|gas/.test(t)) return "CNG";
  if (/petrol|benz|gasoline|otto/.test(t)) return "PETROL";
  return "";
}

function as24Fuel(raw: string): string {
  const t = fold(raw);
  if (/dizel|diesel/.test(t)) return "D";
  if (/hybrid/.test(t)) return "2";
  if (/electro|electric|ev\b/.test(t)) return "E";
  if (/lpg/.test(t)) return "L";
  if (/cng|gas/.test(t)) return "C";
  if (/petrol|benz|gasoline|otto/.test(t)) return "B";
  return "";
}

function mobileGear(raw: string): string {
  const t = fold(raw);
  if (/auto|dsg|tiptronic|cvt/.test(t)) return "AUTOMATIC_GEAR";
  if (/manu|schalt/.test(t)) return "MANUAL_GEAR";
  return "";
}

function as24Gear(raw: string): string {
  const t = fold(raw);
  if (/auto|dsg|tiptronic|cvt/.test(t)) return "A";
  if (/manu|schalt/.test(t)) return "M";
  return "";
}

function mobileBody(raw: string): string {
  const t = fold(raw);
  if (/suv|offroad|gelande/.test(t)) return "SUV";
  if (/wagon|estate|kombi|universal/.test(t)) return "EstateCar";
  if (/hatch|compact|hecb/.test(t)) return "Compact";
  if (/coupe/.test(t)) return "SportsCar";
  if (/cabrio|convert/.test(t)) return "Cabrio";
  if (/van|bus|mpv/.test(t)) return "Van";
  if (/sedan|limo|saloon/.test(t)) return "Limousine";
  return "";
}

function as24Body(raw: string): string {
  const t = fold(raw);
  if (/suv|offroad/.test(t)) return "suv";
  if (/wagon|estate|kombi/.test(t)) return "estate";
  if (/hatch|compact/.test(t)) return "compact";
  if (/coupe/.test(t)) return "coupe";
  if (/cabrio|convert/.test(t)) return "convertible";
  if (/van|bus|mpv/.test(t)) return "van";
  if (/sedan|limo|saloon/.test(t)) return "saloon";
  return "";
}

function mobileDrive(raw: string): string {
  const t = fold(raw);
  if (/awd|4x4|4wd|quattro|allrad|all.?wheel/.test(t)) return "ALL";
  if (/rwd|rear|heck|aizmugur/.test(t)) return "REAR";
  if (/fwd|front|prieksej/.test(t)) return "FRONT";
  return "";
}

function colonRange(from: number | null, to: number | null): string {
  if (from == null && to == null) return "";
  return `${from ?? ""}:${to ?? ""}`;
}

export function buildMobileDeSearchUrl(q: MarketplaceQuery, sortNewest = false): string {
  const url = new URL("https://suchen.mobile.de/fahrzeuge/search.html");
  url.searchParams.set("s", "Car");
  url.searchParams.set("vc", "Car");
  url.searchParams.set("isSearchRequest", "true");
  url.searchParams.set("dam", "false");
  url.searchParams.set("cn", "DE");
  const makeId = mobileDeMakeId(q.make);
  if (makeId) {
    url.searchParams.set("ms", q.model.trim() ? `${makeId};;;${q.model.trim()}` : `${makeId};;;`);
  } else if (q.make.trim()) {
    url.searchParams.set("make", q.make.trim());
    if (q.model.trim()) url.searchParams.set("model", q.model.trim());
  }
  const years = colonRange(q.yearFrom, q.yearTo);
  if (years) url.searchParams.set("fr", years);
  const km = colonRange(q.mileageFrom, q.mileageTo);
  if (km) url.searchParams.set("ml", km);
  const price = colonRange(q.priceFrom, q.priceTo);
  if (price) url.searchParams.set("p", price);
  const cc = colonRange(q.displacementFromCc, q.displacementToCc);
  if (cc) url.searchParams.set("cc", cc);
  if (q.powerFromKw != null) url.searchParams.set("minPowerAsArray", String(q.powerFromKw));
  if (q.powerToKw != null) url.searchParams.set("maxPowerAsArray", String(q.powerToKw));
  const fuel = mobileFuel(q.fuel);
  if (fuel) url.searchParams.set("ft", fuel);
  const gear = mobileGear(q.gearbox);
  if (gear) url.searchParams.set("tr", gear);
  const body = mobileBody(q.body);
  if (body) url.searchParams.set("c", body);
  const drive = mobileDrive(q.drive);
  if (drive) url.searchParams.set("dr", drive);
  if (sortNewest) {
    url.searchParams.set("sb", "doc");
    url.searchParams.set("od", "down");
  }
  return url.toString();
}

export function buildAutoscout24SearchUrl(q: MarketplaceQuery, sortNewest = false): string {
  const make = slug(q.make) || "auto";
  const model = slug(q.model);
  const path = model ? `/lst/${make}/${model}` : `/lst/${make}`;
  const url = new URL(`https://www.autoscout24.de${path}`);
  url.searchParams.set("atype", "C");
  url.searchParams.set("cy", "D");
  url.searchParams.set("ustate", "N,U");
  url.searchParams.set("damaged_listing", "0");
  if (q.yearFrom != null) url.searchParams.set("fregfrom", String(q.yearFrom));
  if (q.yearTo != null) url.searchParams.set("fregto", String(q.yearTo));
  if (q.mileageFrom != null) url.searchParams.set("kmfrom", String(q.mileageFrom));
  if (q.mileageTo != null) url.searchParams.set("kmto", String(q.mileageTo));
  if (q.priceFrom != null) url.searchParams.set("pricefrom", String(q.priceFrom));
  if (q.priceTo != null) url.searchParams.set("priceto", String(q.priceTo));
  if (q.displacementFromCc != null) url.searchParams.set("ccfrom", String(q.displacementFromCc));
  if (q.displacementToCc != null) url.searchParams.set("ccto", String(q.displacementToCc));
  if (q.powerFromKw != null) url.searchParams.set("powerfrom", String(q.powerFromKw));
  if (q.powerToKw != null) url.searchParams.set("powerto", String(q.powerToKw));
  if (q.powerFromKw != null || q.powerToKw != null) url.searchParams.set("powertype", "kw");
  const fuel = as24Fuel(q.fuel);
  if (fuel) url.searchParams.set("fuel", fuel);
  const gear = as24Gear(q.gearbox);
  if (gear) url.searchParams.set("gear", gear);
  const body = as24Body(q.body);
  if (body) url.searchParams.set("body", body);
  url.searchParams.set("sort", sortNewest ? "age" : "standard");
  return url.toString();
}

export function buildMarketplaceSearchUrl(
  platform: MarketplacePlatform,
  q: MarketplaceQuery,
  sortNewest = false,
): string {
  return platform === "autoscout24" ? buildAutoscout24SearchUrl(q, sortNewest) : buildMobileDeSearchUrl(q, sortNewest);
}

/** Actor input: meklēšanas URL + visi diapazoni (actor ņem tos, ko atbalsta). */
export function marketplaceActorSearchInput(
  platform: MarketplacePlatform,
  q: MarketplaceQuery,
  limits?: Pick<MarketplaceLimits, "maxItems" | "sortNewest">,
): Record<string, unknown> {
  const sortNewest = Boolean(limits?.sortNewest);
  const searchUrl = buildMarketplaceSearchUrl(platform, q, sortNewest);
  return {
    startUrls: [{ url: searchUrl }],
    startUrl: searchUrl,
    searchUrl,
    make: q.make,
    model: q.model,
    yearFrom: q.yearFrom,
    yearTo: q.yearTo,
    firstRegistrationFrom: q.yearFrom,
    firstRegistrationTo: q.yearTo,
    mileageFrom: q.mileageFrom,
    mileageTo: q.mileageTo,
    kmFrom: q.mileageFrom,
    kmTo: q.mileageTo,
    priceFrom: q.priceFrom,
    priceTo: q.priceTo,
    fuel: q.fuel,
    gearbox: q.gearbox,
    transmission: q.gearbox,
    powerFrom: q.powerFromKw,
    powerTo: q.powerToKw,
    powerFromKw: q.powerFromKw,
    powerToKw: q.powerToKw,
    displacementFrom: q.displacementFromCc,
    displacementTo: q.displacementToCc,
    cubicCapacityFrom: q.displacementFromCc,
    cubicCapacityTo: q.displacementToCc,
    ccFrom: q.displacementFromCc,
    ccTo: q.displacementToCc,
    body: q.body,
    bodyType: q.body,
    drive: q.drive,
    driveType: q.drive,
    country: "DE",
    countries: q.countries.length ? q.countries : ["DE"],
    accidentFree: true,
    unfallfrei: true,
    damaged: false,
    driveable: true,
    ...(limits?.maxItems ? { maxItems: limits.maxItems } : {}),
  };
}
