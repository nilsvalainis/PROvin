import { describe, expect, it } from "vitest";
import { assignMarketplaceGroupIds, marketplaceListingFingerprint } from "@/lib/marketplace/dedupe";
import type { MarketplaceNormalizedListing } from "@/lib/marketplace/types";

function item(partial: Partial<MarketplaceNormalizedListing>): MarketplaceNormalizedListing {
  return {
    platform: "mobilede",
    providerId: "apify-mobilede",
    externalId: "1",
    listingUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=1",
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
    ...partial,
  };
}

describe("marketplace listing fingerprint", () => {
  it("groups the same car across sources and keeps VIN as the strongest key", () => {
    const a = item({ platform: "mobilede", externalId: "md", vin: "YV1DZ57H5F1234567", mileageKm: 98200, priceEur: 19000 });
    const b = item({
      platform: "autoscout24",
      providerId: "apify-autoscout24",
      externalId: "as",
      listingUrl: "https://www.autoscout24.com/offers/as",
      vin: "YV1DZ57H5F1234567",
      mileageKm: 97900,
      priceEur: 19100,
    });
    expect(marketplaceListingFingerprint(a)).toBe(marketplaceListingFingerprint(b));
    const grouped = assignMarketplaceGroupIds([a, b, item({ externalId: "other", make: "BMW", model: "X5", vin: undefined })]);
    const vinGroup = grouped.filter((x) => x.vin === "YV1DZ57H5F1234567");
    expect(vinGroup).toHaveLength(2);
    expect(vinGroup[0]?.groupId).toBe(vinGroup[1]?.groupId);
    expect(grouped.find((x) => x.make === "BMW")?.groupId).not.toBe(vinGroup[0]?.groupId);
  });
});
