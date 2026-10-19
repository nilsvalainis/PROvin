import { describe, expect, it } from "vitest";
import { attachMarketplacePriceCompare, compareMarketplacePrice } from "@/lib/marketplace/price-compare";

describe("compareMarketplacePrice", () => {
  it("compares one listing against the others in the same fetch", () => {
    const peers = [{ priceEur: 16000 }, { priceEur: 18000 }, { priceEur: 20000 }, { priceEur: 22000 }];
    const cheap = compareMarketplacePrice({ priceEur: 16000 }, peers);
    expect(cheap.sampleSize).toBe(4);
    expect(cheap.medianEur).toBe(19000);
    expect(cheap.deltaPct).toBeLessThan(0);
    expect(cheap.note).toMatch(/zem mediānas/);
    const lonely = compareMarketplacePrice({ priceEur: 16000 }, [{ priceEur: 16000 }]);
    expect(lonely.note).toMatch(/par maz/);
  });

  it("attaches a note to every kept listing", () => {
    const items = attachMarketplacePriceCompare([
      {
        platform: "mobilede",
        providerId: "apify-mobilede",
        externalId: "1",
        listingUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=1",
        title: "A",
        make: "Volvo",
        model: "XC60",
        year: "2019",
        mileageKm: 1,
        priceEur: 10000,
        fuel: "",
        gearbox: "",
        powerKw: "",
        locationCountry: "DE",
        fetchedAt: "2026-10-19T12:00:00.000Z",
      },
      {
        platform: "autoscout24",
        providerId: "apify-autoscout24",
        externalId: "2",
        listingUrl: "https://www.autoscout24.com/offers/2",
        title: "B",
        make: "Volvo",
        model: "XC60",
        year: "2019",
        mileageKm: 1,
        priceEur: 20000,
        fuel: "",
        gearbox: "",
        powerKw: "",
        locationCountry: "DE",
        fetchedAt: "2026-10-19T12:00:00.000Z",
      },
    ]);
    expect(items.every((x) => x.priceCompare.note.length > 0)).toBe(true);
  });
});
