import { describe, expect, it } from "vitest";
import { normalizeMarketplaceListing, normalizeMarketplaceListings } from "@/lib/marketplace/normalize";

describe("normalizeMarketplaceListing", () => {
  it("keeps normalized fields and photo links (Nils 31.10), drops description and seller contacts", () => {
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
    expect(item?.sellerName).toBe("Hans");
    expect(item?.imageUrls).toEqual(["https://example.com/a.jpg"]);
    expect(JSON.stringify(item)).not.toMatch(/1\.Hand|Scheckheft|111|a@b\.de/);
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

  it("takes externalId from listingKey then listingId before the URL", () => {
    const fromKey = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        listingKey: "451508690",
        listingId: "hash-id",
        canonicalUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=999",
        title: "Audi A6",
        make: "Audi",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(fromKey?.externalId).toBe("451508690");
    const fromId = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        listingId: "hash-id",
        url: "https://suchen.mobile.de/fahrzeuge/details.html?id=999",
        title: "Audi A6",
        make: "Audi",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(fromId?.externalId).toBe("hash-id");
  });

  it("uses title plus subTitle or makeModelDescription for the card headline", () => {
    const item = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        url: "https://suchen.mobile.de/fahrzeuge/details.html?id=330",
        title: "Audi A6",
        subTitle: "3.0 TDI quattro S line",
        make: "Audi",
        model: "A6",
        country: "DE",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(item?.title).toBe("Audi A6 3.0 TDI quattro S line");
    const headline = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        url: "https://suchen.mobile.de/fahrzeuge/details.html?id=331",
        headline: "Audi A6 Avant 3.0 TDI",
        title: "Audi A6",
        make: "Audi",
        country: "DE",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(headline?.title).toBe("Audi A6 Avant 3.0 TDI");
  });

  it("drops non-DE rows when the actor sent a country field and keeps unknown country", () => {
    const nl = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        url: "https://suchen.mobile.de/fahrzeuge/details.html?id=nl",
        title: "Audi A6",
        make: "Audi",
        country: "NL",
        location: "Hengelo",
        sellerName: "Auto NL",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(nl).toBeNull();
    const unknown = normalizeMarketplaceListing(
      "mobilede",
      "apify-mobilede",
      {
        url: "https://suchen.mobile.de/fahrzeuge/details.html?id=de-unknown",
        title: "Audi A6",
        make: "Audi",
        location: "Fulda",
        sellerName: "Autohaus Fulda",
      },
      "2026-10-19T12:00:00.000Z",
    );
    expect(unknown?.sellerName).toBe("Autohaus Fulda");
    expect(unknown?.location).toBe("Fulda");
  });
});
