import { describe, expect, it } from "vitest";
import {
  assignMarketplaceGroupIds,
  collapseMarketplaceListings,
  collapseMarketplaceListingsByOrder,
  marketplaceListingFingerprint,
  marketplaceListingsAreSameCar,
} from "@/lib/marketplace/dedupe";
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

  it("matches make+model+year+price and mileage within 100 km", () => {
    const a = item({ mileageKm: 212000, priceEur: 12900 });
    const b = item({
      platform: "autoscout24",
      providerId: "apify-autoscout24",
      externalId: "as",
      listingUrl: "https://www.autoscout24.de/angebote/as",
      mileageKm: 212080,
      priceEur: 12900,
    });
    const far = item({ externalId: "far", mileageKm: 212200, priceEur: 12900 });
    const otherPrice = item({ externalId: "p", mileageKm: 212000, priceEur: 13000 });
    expect(marketplaceListingsAreSameCar(a, b)).toBe(true);
    expect(marketplaceListingsAreSameCar(a, far)).toBe(false);
    expect(marketplaceListingsAreSameCar(a, otherPrice)).toBe(false);
  });

  it("collapses cross-source and same-source duplicates, keeping mobile.de first and extra links", () => {
    const md = item({
      externalId: "md",
      listingUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=md",
      mileageKm: 180000,
      priceEur: 11900,
    });
    const as1 = item({
      platform: "autoscout24",
      providerId: "apify-autoscout24",
      externalId: "as1",
      listingUrl: "https://www.autoscout24.de/angebote/as1",
      mileageKm: 180050,
      priceEur: 11900,
    });
    const as2 = item({
      platform: "autoscout24",
      providerId: "apify-autoscout24",
      externalId: "as2",
      listingUrl: "https://www.autoscout24.de/angebote/as2",
      mileageKm: 180040,
      priceEur: 11900,
    });
    const other = item({ externalId: "other", make: "BMW", model: "X5", mileageKm: 90000, priceEur: 22000 });
    const collapsed = collapseMarketplaceListings([as1, as2, md, other]);
    expect(collapsed).toHaveLength(2);
    const car = collapsed.find((x) => x.make === "Volvo");
    expect(car?.platform).toBe("mobilede");
    expect(car?.listingUrl).toContain("mobile.de");
    expect(car?.sourceLinks?.map((l) => l.url).sort()).toEqual(
      ["https://www.autoscout24.de/angebote/as1", "https://www.autoscout24.de/angebote/as2"].sort(),
    );
    expect(collapsed.find((x) => x.make === "BMW")?.sourceLinks).toBeUndefined();
  });

  it("collapses only within the same order", () => {
    const a = { ...item({ mileageKm: 180000, priceEur: 11900 }), orderId: "o1" };
    const b = { ...item({ mileageKm: 180000, priceEur: 11900 }), orderId: "o2" };
    expect(collapseMarketplaceListingsByOrder([a, b])).toHaveLength(2);
  });
});
