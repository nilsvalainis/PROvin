import { describe, expect, it } from "vitest";
import { marketplaceListingToVehicle, marketplaceListingExpiresAt, marketplaceListingIsExpired } from "@/lib/marketplace/to-listing-vehicle";
import type { MarketplaceStoredListing } from "@/lib/marketplace/types";

const item: MarketplaceStoredListing = {
  platform: "mobilede",
  providerId: "apify-mobilede",
  externalId: "1001",
  listingUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=1001",
  title: "Volvo XC60",
  make: "Volvo",
  model: "XC60",
  year: "2019",
  mileageKm: 98000,
  priceEur: 18900,
  fuel: "Diesel",
  gearbox: "Automatic",
  powerKw: "140",
  locationCountry: "DE",
  fetchedAt: "2026-10-19T12:00:00.000Z",
  id: "veh-1001",
  orderId: "ord-1",
  tenantScope: "iriss",
  groupId: "g1",
  priceCompare: { sampleSize: 3, medianEur: 19000, p25Eur: 18000, p75Eur: 20000, deltaPct: -1, note: "Cena tuvu mediānai (3 sludinājumi)." },
  expiresAt: marketplaceListingExpiresAt("2026-10-19T12:00:00.000Z"),
};

describe("marketplaceListingToVehicle", () => {
  it("reuses the IRISS listing card shape without photos", () => {
    const v = marketplaceListingToVehicle(item);
    expect(v.platform).toBe("mobilede");
    expect(v.detailUrl).toContain("mobile.de");
    expect(v.priceCurrent).toBe(18900);
    expect(v.imageUrl).toBe("");
    expect(v.orderIds).toEqual(["ord-1"]);
    expect(v.priceCompareNote).toMatch(/mediān/);
  });

  it("puts the dealer name on the card location and keeps extra source links", () => {
    const v = marketplaceListingToVehicle({
      ...item,
      sellerName: "Autohaus Fulda",
      location: "Fulda",
      sourceLinks: [{ platform: "autoscout24", url: "https://www.autoscout24.de/angebote/x" }],
    });
    expect(v.location).toBe("Autohaus Fulda");
    expect(v.sourceLinks).toEqual([{ platform: "autoscout24", url: "https://www.autoscout24.de/angebote/x" }]);
  });

  it("expires after 30 days", () => {
    const exp = marketplaceListingExpiresAt("2026-10-01T00:00:00.000Z", 30);
    expect(marketplaceListingIsExpired(exp, Date.parse("2026-10-31T00:00:01.000Z"))).toBe(true);
    expect(marketplaceListingIsExpired(exp, Date.parse("2026-10-15T00:00:00.000Z"))).toBe(false);
  });
});
