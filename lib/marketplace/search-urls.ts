/**
 * mobile.de / AutoScout24 meklēšanas ievade no IRISS tirgus vaicājuma.
 * mobile.de: strukturētie Store lauki (make/model/diapazoni), ne startUrls.
 * AutoScout24: meklēšanas URL (searchUrls) ar aktuālajiem /lst parametriem.
 * Automātiskie filtri vienmēr ir tikai dīleru sludinājumi (nav privāto pārdevēju).
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

/** URL / slug / actor modelis: tikai pirmais tokens ("A6 C7 BI-TURBO Sline" -> "A6"). */
export function marketplaceModelSearchToken(model: string): string {
  return model
    .trim()
    .split(/[\s,/|+]+/)
    .map((part) => part.trim())
    .find(Boolean) ?? "";
}

/** Actor powerMin/powerMax ir PS. 1 kW = 1.36 PS. */
export function marketplaceKwToPs(kw: number): number {
  return Math.round(kw * 1.36);
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

function isAutomaticGear(t: string): boolean {
  // IRISS: AT / A/T / automāts / automats / automatic. AT only as a whole word.
  return /auto|dsg|tiptronic|cvt|a\s*\/\s*t|\bat\b/.test(t);
}

function isManualGear(t: string): boolean {
  return /manu|schalt|\bmt\b/.test(t);
}

function mobileGear(raw: string): "AUTOMATIC_GEAR" | "MANUAL_GEAR" | "" {
  const t = fold(raw);
  if (isAutomaticGear(t)) return "AUTOMATIC_GEAR";
  if (isManualGear(t)) return "MANUAL_GEAR";
  return "";
}

function as24Gear(raw: string): string {
  const t = fold(raw);
  if (isAutomaticGear(t)) return "A";
  if (isManualGear(t)) return "M";
  return "";
}

function mobileUrlBody(raw: string): string {
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

/** blackfalcondata~mobile-de-scraper bodyType enum. */
export function mobileActorBody(raw: string): string {
  const t = fold(raw);
  if (/suv|offroad|gelande/.test(t)) return "SUV";
  if (/wagon|estate|kombi|universal/.test(t)) return "KOMBI";
  if (/hatch|compact|hecb|klein/.test(t)) return "KLEINWAGEN";
  if (/coupe/.test(t)) return "COUPE";
  if (/cabrio|convert/.test(t)) return "CABRIO";
  if (/van|bus|mpv/.test(t)) return "VAN";
  if (/pickup/.test(t)) return "PICKUP";
  if (/sedan|limo|saloon/.test(t)) return "LIMOUSINE";
  return "";
}

/**
 * AutoScout24 /lst `body` numeric codes:
 * compact 1, convertible 2, coupe 3, suv 4, estate 5, saloon 6, van 12.
 */
export function as24Body(raw: string): string {
  const t = fold(raw);
  if (/hatch|compact/.test(t)) return "1";
  if (/cabrio|convert/.test(t)) return "2";
  if (/coupe/.test(t)) return "3";
  if (/suv|offroad/.test(t)) return "4";
  if (/wagon|estate|kombi|universal/.test(t)) return "5";
  if (/sedan|limo|saloon/.test(t)) return "6";
  if (/van|bus|mpv/.test(t)) return "12";
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
  const model = marketplaceModelSearchToken(q.model);
  url.searchParams.set("s", "Car");
  url.searchParams.set("vc", "Car");
  url.searchParams.set("isSearchRequest", "true");
  url.searchParams.set("dam", "0");
  url.searchParams.set("cn", "DE");
  // Anbieter: Händler. Aktuālais suchen.mobile.de param (st=PRIVATE = Privatanbieter).
  url.searchParams.set("st", "DEALER");
  const makeId = mobileDeMakeId(q.make);
  if (makeId) {
    url.searchParams.set("ms", makeId);
  } else if (q.make.trim()) {
    url.searchParams.set("make", q.make.trim());
    if (model) url.searchParams.set("model", model);
  }
  const years = colonRange(q.yearFrom, q.yearTo);
  if (years) url.searchParams.set("fr", years);
  const km = colonRange(q.mileageFrom, q.mileageTo);
  if (km) url.searchParams.set("ml", km);
  const price = colonRange(q.priceFrom, q.priceTo);
  if (price) url.searchParams.set("p", price);
  const cc = colonRange(q.displacementFromCc, q.displacementToCc);
  if (cc) url.searchParams.set("cc", cc);
  const power = colonRange(q.powerFromKw, q.powerToKw);
  if (power) url.searchParams.set("pw", power);
  const fuel = mobileFuel(q.fuel);
  if (fuel) url.searchParams.set("ft", fuel);
  const gear = mobileGear(q.gearbox);
  if (gear) url.searchParams.set("tr", gear);
  const body = mobileUrlBody(q.body);
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
  const model = slug(marketplaceModelSearchToken(q.model));
  const path = model ? `/lst/${make}/${model}` : `/lst/${make}`;
  const url = new URL(`https://www.autoscout24.de${path}`);
  url.searchParams.set("atype", "C");
  url.searchParams.set("cy", "D");
  url.searchParams.set("ustate", "N,U");
  url.searchParams.set("damaged_listing", "exclude");
  // Anbieter: Händler. Current autoscout24.de /lst param (custtype=P = Privat).
  url.searchParams.set("custtype", "D");
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

function mobileDeActorInput(q: MarketplaceQuery, maxResults: number, sortNewest: boolean): Record<string, unknown> {
  const model = marketplaceModelSearchToken(q.model);
  const input: Record<string, unknown> = {
    maxResults,
    includeDetails: false,
    category: "CAR",
    sellerType: "DEALER",
    damageStatus: "EXCLUDE",
  };
  if (q.make.trim()) input.make = q.make.trim();
  if (model) input.model = model;
  if (q.priceFrom != null) input.priceMin = q.priceFrom;
  if (q.priceTo != null) input.priceMax = q.priceTo;
  if (q.yearFrom != null) input.yearMin = q.yearFrom;
  if (q.yearTo != null) input.yearMax = q.yearTo;
  if (q.mileageFrom != null) input.mileageMin = q.mileageFrom;
  if (q.mileageTo != null) input.mileageMax = q.mileageTo;
  if (q.powerFromKw != null) input.powerMin = marketplaceKwToPs(q.powerFromKw);
  if (q.powerToKw != null) input.powerMax = marketplaceKwToPs(q.powerToKw);
  const gear = mobileGear(q.gearbox);
  if (gear) input.transmission = [gear];
  const body = mobileActorBody(q.body);
  if (body) input.bodyType = [body];
  const fuel = mobileFuel(q.fuel);
  if (fuel) input.fuelType = [fuel];
  if (sortNewest) input.sort = "newest";
  // Schema has no country field. customFilters keeps only DE rows after scrape.
  input.customFilters = [{ field: "country", op: "equals", value: "DE" }];
  return input;
}

/** Actor input: mobile.de strukturētie lauki; AutoScout24 searchUrls. */
export function marketplaceActorSearchInput(
  platform: MarketplacePlatform,
  q: MarketplaceQuery,
  limits?: Pick<MarketplaceLimits, "maxItems" | "sortNewest">,
): Record<string, unknown> {
  const sortNewest = Boolean(limits?.sortNewest);
  const maxResults = Math.max(1, Math.floor(limits?.maxItems ?? 1));
  if (platform === "autoscout24") {
    return {
      searchUrls: [{ url: buildAutoscout24SearchUrl(q, sortNewest) }],
      maxResults,
      includeDetails: false,
    };
  }
  return mobileDeActorInput(q, maxResults, sortNewest);
}
