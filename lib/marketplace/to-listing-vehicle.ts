import { createHash } from "node:crypto";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";
import { mobileDeImageDisplayUrl } from "@/lib/marketplace/image-url";
import type { MarketplaceStoredListing } from "@/lib/marketplace/types";

export function marketplaceListingVehicleId(platform: MarketplaceStoredListing["platform"], externalId: string): string {
  return createHash("sha1").update(platform).update("|").update(externalId).digest("hex").slice(0, 20);
}

function expiresAt(fetchedAt: string, ttlDays: number): string {
  const t = Date.parse(fetchedAt);
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + ttlDays * 86_400_000).toISOString();
}

export function marketplaceListingExpiresAt(fetchedAt: string, ttlDays = 30): string {
  return expiresAt(fetchedAt, ttlDays);
}

export function marketplaceListingIsExpired(expiresAtIso: string, nowMs = Date.now()): boolean {
  const t = Date.parse(expiresAtIso);
  return Number.isFinite(t) && t <= nowMs;
}

/** Pārvērš saglabāto sludinājumu tajā pašā kartītes formā, ko lieto izsoles. Bildes - avota saites. */
export function marketplaceListingToVehicle(item: MarketplaceStoredListing): IrissListingVehicle {
  const year = item.year;
  return {
    id: item.id || marketplaceListingVehicleId(item.platform, item.externalId),
    platform: item.platform,
    externalId: item.externalId,
    detailUrl: item.listingUrl,
    orderIds: item.orderId ? [item.orderId] : [],
    orderBrandModels: [],
    title: item.title,
    manufacturer: item.make,
    year,
    firstRegistration: year,
    mileageKm: item.mileageKm,
    fuel: item.fuel,
    transmission: item.gearbox,
    powerKw: item.powerKw,
    location: item.sellerName || item.location || item.locationCountry,
    countryCode: item.locationCountry,
    // Nils 31.10: mobile.de bildes tieši no CDN (m.mobile.de bloķē IP); sarakstam mazāka, galerijai lielāka.
    imageUrl: mobileDeImageDisplayUrl(item.imageUrls?.[0] ?? "", 1024),
    ...(item.imageUrls?.[0] ? { thumbUrl: mobileDeImageDisplayUrl(item.imageUrls[0], 640) } : {}),
    ...(item.imageUrls && item.imageUrls.length > 1 ? { imageUrls: item.imageUrls.map((u) => mobileDeImageDisplayUrl(u, 1024)) } : {}),
    currency: "EUR",
    priceStart: null,
    priceMinimal: null,
    priceCurrent: item.priceEur,
    priceBuyNow: item.priceEur,
    vatNote: item.priceCompare.note,
    auctionId: "",
    auctionStartAt: "",
    auctionEndAt: "",
    auctionStage: "",
    firstSeenAt: item.fetchedAt,
    lastSeenAt: item.fetchedAt,
    missingRuns: 0,
    change: "new",
    priceHistory: [],
    ...(item.vin ? { vin: item.vin, vinSource: "source" as const } : {}),
    priceCompareNote: item.priceCompare.note,
    ...(item.sourceLinks?.length
      ? {
          sourceLinks: item.sourceLinks.map((link) => ({ platform: link.platform, url: link.url })),
        }
      : {}),
  };
}

export function marketplaceListingsToVehicles(items: readonly MarketplaceStoredListing[], nowMs = Date.now()): IrissListingVehicle[] {
  return items.filter((item) => !marketplaceListingIsExpired(item.expiresAt, nowMs)).map(marketplaceListingToVehicle);
}
