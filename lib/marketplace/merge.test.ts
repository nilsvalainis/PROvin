import { describe, expect, it } from "vitest";
import { mergeMarketplaceIntoLatestView } from "@/lib/marketplace/merge";
import { marketplaceListingExpiresAt } from "@/lib/marketplace/to-listing-vehicle";
import type { MarketplaceStoredListing } from "@/lib/marketplace/types";

function stored(partial: Partial<MarketplaceStoredListing>): MarketplaceStoredListing {
  return {
    platform: "mobilede",
    providerId: "apify-mobilede",
    externalId: "md-1",
    listingUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=md-1",
    title: "Audi A6 3.0 TDI",
    make: "Audi",
    model: "A6",
    year: "2014",
    mileageKm: 212000,
    priceEur: 12900,
    fuel: "Diesel",
    gearbox: "Automatic",
    powerKw: "230",
    locationCountry: "DE",
    fetchedAt: "2026-10-19T12:00:00.000Z",
    id: "veh-md-1",
    orderId: "ord-1",
    tenantScope: "iriss",
    groupId: "g1",
    priceCompare: { sampleSize: 1, medianEur: 12900, p25Eur: 12900, p75Eur: 12900, deltaPct: 0, note: "" },
    expiresAt: marketplaceListingExpiresAt("2026-10-19T12:00:00.000Z"),
    ...partial,
  };
}

describe("mergeMarketplaceIntoLatestView", () => {
  it("collapses the same car from two portals into one card and keeps both links", () => {
    const view = mergeMarketplaceIntoLatestView(null, [
      stored({}),
      stored({
        platform: "autoscout24",
        providerId: "apify-autoscout24",
        externalId: "as-1",
        listingUrl: "https://www.autoscout24.de/angebote/as-1",
        id: "veh-as-1",
        mileageKm: 212070,
      }),
    ]);
    expect(view?.vehicles).toHaveLength(1);
    expect(view?.vehicles[0]?.platform).toBe("mobilede");
    expect(view?.vehicles[0]?.detailUrl).toContain("mobile.de");
    expect(view?.vehicles[0]?.sourceLinks?.map((l) => l.url)).toEqual(["https://www.autoscout24.de/angebote/as-1"]);
  });
});
