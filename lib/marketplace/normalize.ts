import {
  isMarketplacePlatform,
  isMarketplaceProviderId,
  type MarketplaceNormalizedListing,
  type MarketplacePlatform,
  type MarketplaceProviderId,
  type MarketplaceRawListing,
} from "@/lib/marketplace/types";

const FORBIDDEN_KEYS = [
  "description",
  "sellerPhone",
  "sellerEmail",
  "phone",
  "email",
  "contact",
] as const;

function str(v: unknown, max = 240): string {
  return typeof v === "string" ? v.replace(/[\u2013\u2014]/g, "-").trim().slice(0, max) : "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function yearOf(raw: MarketplaceRawListing): string {
  const direct = str(raw.year, 8);
  if (/(?:19|20)\d{2}/.test(direct)) return direct.match(/(?:19|20)\d{2}/)![0]!;
  const first = str(raw.firstReg ?? raw.firstRegistration, 20);
  const m = first.match(/(?:19|20)\d{2}/);
  return m ? m[0]! : "";
}

function mileageOf(raw: MarketplaceRawListing): number | null {
  const n = num(raw.mileageKm);
  if (n == null) return null;
  return n > 0 && n < 2_000_000 ? Math.round(n) : null;
}

function priceOf(raw: MarketplaceRawListing): number | null {
  const n = num(raw.priceEur ?? raw.price);
  if (n == null) return null;
  return n > 0 && n < 2_000_000 ? Math.round(n) : null;
}

function countryOf(raw: MarketplaceRawListing): string {
  const code = str(raw.countryCode, 4).toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  const name = str(raw.country || raw.location || raw.city, 80);
  if (/\bDE\b|deutsch|germany|vācij/i.test(name)) return "DE";
  if (/\bAT\b|österr|austria/i.test(name)) return "AT";
  if (/\bNL\b|nether|holland/i.test(name)) return "NL";
  if (/\bBE\b|belgi/i.test(name)) return "BE";
  if (/\bFR\b|france|frankr/i.test(name)) return "FR";
  if (/\bIT\b|ital/i.test(name)) return "IT";
  if (/\bPL\b|polen|poland/i.test(name)) return "PL";
  if (/\bLV\b|latvij/i.test(name)) return "LV";
  return code || "";
}

function listingUrl(raw: MarketplaceRawListing): string {
  const url = str(raw.url, 500) || str(raw.canonicalUrl, 500) || str(raw.sourceUrl, 500);
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function listingTitleOf(raw: MarketplaceRawListing, make: string, model: string): string {
  const headline = str(raw.headline, 180);
  if (headline) return headline;
  const title = str(raw.title, 180);
  const extra = str(raw.makeModelDescription ?? raw.subTitle ?? raw.subtitle, 180);
  if (title && extra && !title.toLowerCase().includes(extra.toLowerCase())) {
    return `${title} ${extra}`.trim().slice(0, 180);
  }
  return title || `${make} ${model}`.trim();
}

/** Tikai skaidrs country/countryCode/sellerCountry. Pilsēta vien neizslēdz. */
export function marketplaceRawCountryCode(raw: MarketplaceRawListing): string {
  for (const value of [raw.countryCode, raw.country, raw.sellerCountry]) {
    const code = str(value, 40);
    if (/^[A-Z]{2}$/i.test(code)) return code.toUpperCase();
    if (/\bnether|holland|\bnl\b/i.test(code)) return "NL";
    if (/\bgerman|deutsch|\bde\b/i.test(code)) return "DE";
    if (/\bösterr|austria|\bat\b/i.test(code)) return "AT";
  }
  return "";
}

export function marketplaceRawIsNonDeWhenCountryKnown(raw: MarketplaceRawListing): boolean {
  const code = marketplaceRawCountryCode(raw);
  return Boolean(code) && code !== "DE";
}

function externalIdOf(platform: MarketplacePlatform, raw: MarketplaceRawListing, url: string): string {
  const id = str(raw.listingKey, 80) || str(raw.listingId, 80) || str(raw.externalId, 80);
  if (id) return id;
  try {
    const u = new URL(url);
    const fromQuery = u.searchParams.get("id") || u.searchParams.get("offerId") || "";
    if (fromQuery) return fromQuery.slice(0, 80);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return last.slice(0, 80);
  } catch {
    return `${platform}-${str(raw.title, 40)}`;
  }
}

function powerOf(raw: MarketplaceRawListing): string {
  const n = num(raw.powerKw ?? raw.power);
  if (n != null && n > 0) return String(Math.round(n));
  const direct = str(raw.powerKw, 12).replace(/[^\d]/g, "").slice(0, 4);
  return direct;
}

/** Nils 31.10: bilžu saites (http/https), max 12; saturs netiek kopēts. */
export const MARKETPLACE_MAX_IMAGE_URLS = 12;

function imageUrlOf(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["url", "uri", "src", "href", "large", "full", "original", "medium", "thumbnail"]) {
      if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
    }
  }
  return "";
}

export function marketplaceImageUrls(raw: MarketplaceRawListing): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = imageUrlOf(v);
    if (!s || s.length > 600) return;
    try {
      const u = new URL(s.startsWith("//") ? `https:${s}` : s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
      const href = u.toString();
      if (!out.includes(href)) out.push(href);
    } catch {
      /* nav URL */
    }
  };
  for (const key of ["images", "imageUrls", "photos", "imageUrl", "photo", "thumbnail"] as const) {
    const v = (raw as Record<string, unknown>)[key];
    if (Array.isArray(v)) v.forEach(push);
    else push(v);
    if (out.length >= MARKETPLACE_MAX_IMAGE_URLS) break;
  }
  return out.slice(0, MARKETPLACE_MAX_IMAGE_URLS);
}

function stripForbidden(raw: MarketplaceRawListing): MarketplaceRawListing {
  const out: Record<string, unknown> = { ...raw };
  for (const key of FORBIDDEN_KEYS) delete out[key];
  return out as MarketplaceRawListing;
}

/** Tikai skaidri atzīmēts privātais pārdevējs. Tukšs / dīleris / nezināms paliek. */
function isClearlyPrivateSeller(raw: MarketplaceRawListing): boolean {
  const t = str(raw.sellerType, 80).toLowerCase().replace(/ä/g, "ae");
  if (!t) return false;
  if (/\b(dealer|haendler|commercial)\b/.test(t)) return false;
  return /\b(private(\s+seller)?|privat(anbieter)?|fsbo)\b/.test(t);
}

export function normalizeMarketplaceListing(
  platform: MarketplacePlatform,
  providerId: MarketplaceProviderId,
  raw: MarketplaceRawListing,
  fetchedAt: string,
): MarketplaceNormalizedListing | null {
  if (!isMarketplacePlatform(platform) || !isMarketplaceProviderId(providerId)) return null;
  if (isClearlyPrivateSeller(raw)) return null;
  if (marketplaceRawIsNonDeWhenCountryKnown(raw)) return null;
  const cleaned = stripForbidden(raw);
  const url = listingUrl(cleaned);
  if (!url) return null;
  const make = str(cleaned.make, 40);
  const model = str(cleaned.model, 60);
  const title = listingTitleOf(cleaned, make, model);
  if (!title && !make) return null;
  const vin = str(cleaned.vin, 17).toUpperCase();
  const sellerName = str(cleaned.sellerName, 80);
  const location = str(cleaned.location ?? cleaned.city, 80);
  const imageUrls = marketplaceImageUrls(cleaned);
  return {
    platform,
    providerId,
    externalId: externalIdOf(platform, cleaned, url),
    listingUrl: url,
    title: title || `${make} ${model}`.trim(),
    make,
    model,
    year: yearOf(cleaned),
    mileageKm: mileageOf(cleaned),
    priceEur: priceOf(cleaned),
    fuel: str(cleaned.fuel ?? cleaned.fuelType, 40),
    gearbox: str(cleaned.gearbox || cleaned.transmission, 40),
    powerKw: powerOf(cleaned),
    locationCountry: countryOf(cleaned),
    fetchedAt,
    ...(vin.length === 17 ? { vin } : {}),
    ...(sellerName ? { sellerName } : {}),
    ...(location ? { location } : {}),
    ...(imageUrls.length > 0 ? { imageUrls } : {}),
  };
}

export function normalizeMarketplaceListings(
  platform: MarketplacePlatform,
  providerId: MarketplaceProviderId,
  rawItems: readonly MarketplaceRawListing[],
  fetchedAt: string,
): MarketplaceNormalizedListing[] {
  const out: MarketplaceNormalizedListing[] = [];
  const seen = new Set<string>();
  for (const raw of rawItems) {
    const item = normalizeMarketplaceListing(platform, providerId, raw, fetchedAt);
    if (!item) continue;
    const key = `${item.platform}|${item.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
