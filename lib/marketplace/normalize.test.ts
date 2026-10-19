import { describe, expect, it } from "vitest";
import { normalizeMarketplaceListing, normalizeMarketplaceListings } from "@/lib/marketplace/normalize";

describe("normalizeMarketplaceListing", () => {
  it("keeps normalized fields and drops photos, description and seller contacts", () => {
    const item = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        externalId: "1001",
        url: "https://suchen.mobile.de/fahrzeuge/details.html?id=1001",
        title: "Volvo XC60",
        make: "Volvo",
        model: "XC60",
        year: "2019",
        mileageKm: 98000,
        priceEur: 18900,
        fuel: "Diesel",
        gearbox: "Automatic",
        powerKw: 140,
        countryCode: "DE",
        description: "aus 1.Hand, Scheckheft",
        images: ["https://example.com/a.jpg"],
        sellerPhone: "+49 111",
        sellerEmail: "a@b.de",
        sellerName: "Hans",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(item).toMatchObject({
      platform: "mobilede",
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
    });
    expect(JSON.stringify(item)).not.toMatch(/1\.Hand|Scheckheft|example\.com\/a|111|a@b\.de|Hans/);
  });

  it("dedupes the same external id in one source", () => {
    const items = normalizeMarketplaceListings(
      "autoscout24",
      "apify-autoscout24",
      [
        { externalId: "as-1", url: "https://www.autoscout24.com/offers/1", title: "A", make: "Volvo" },
        { externalId: "as-1", url: "https://www.autoscout24.com/offers/1", title: "A copy", make: "Volvo" },
        { url: "ftp://bad.example/x", title: "Nope" },
      ],
      "2026-10-19T12:00:00.000Z",
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("as-1");
  });
});
