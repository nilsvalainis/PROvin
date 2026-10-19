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

  it("maps mobile.de canonicalUrl, fuelType and firstRegistration", () => {
    const item = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        canonicalUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=7788",
        title: "Volvo XC60",
        make: "Volvo",
        model: "XC60",
        fuelType: "Diesel",
        firstRegistration: "03/2019",
        mileageKm: 88000,
        price: 17500,
        powerKw: 140,
        country: "DE",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(item?.listingUrl).toContain("id=7788");
    expect(item?.fuel).toBe("Diesel");
    expect(item?.year).toBe("2019");
  });

  it("maps AutoScout24 url, price, mileageKm, powerKw, firstRegistration, country", () => {
    const item = normalizeMarketplaceListing(
      "autoscout24",
      "apify-autoscout24",
      {
        url: "https://www.autoscout24.de/angebote/volvo-xc60-x",
        title: "Volvo XC60",
        make: "Volvo",
        model: "XC60",
        price: 19100,
        mileageKm: 90500,
        powerKw: 140,
        firstRegistration: "2019-06",
        country: "DE",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(item).toMatchObject({
      listingUrl: "https://www.autoscout24.de/angebote/volvo-xc60-x",
      priceEur: 19100,
      mileageKm: 90500,
      powerKw: "140",
      year: "2019",
      locationCountry: "DE",
    });
  });

  it("drops listings clearly marked as private seller and keeps dealer or unknown", () => {
    const base = {
      url: "https://suchen.mobile.de/fahrzeuge/details.html?id=2002",
      title: "Volvo XC60",
      make: "Volvo",
    };
    expect(
      normalizeMarketplaceListing("mobilede", "apify-mobilede", { ...base, sellerType: "Private Seller" }, "2026-10-19T12:00:00.000Z"),
    ).toBeNull();
    expect(
      normalizeMarketplaceListing(
        "autoscout24",
        "apify-autoscout24",
        { url: "https://www.autoscout24.de/angebote/x", title: "Volvo XC60", make: "Volvo", sellerType: "Private" },
        "2026-10-19T12:00:00.000Z",
      ),
    ).toBeNull();
    expect(
      normalizeMarketplaceListing("mobilede", "apify-mobilede", { ...base, sellerType: "Dealer" }, "2026-10-19T12:00:00.000Z")?.title,
    ).toBe("Volvo XC60");
    expect(normalizeMarketplaceListing("mobilede", "apify-mobilede", base, "2026-10-19T12:00:00.000Z")?.title).toBe("Volvo XC60");
  });
});
