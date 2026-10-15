import { describe, expect, it } from "vitest";
import { irissListingVin, irissOfferSeedFromListing, irissPasutijumsOfferSeedFromListing, irissPasutijumsSeedFromListing } from "@/lib/iriss-pasutijums-from-listing";

const vin = "WBAZZZ8V0K1237731";

describe("irissPasutijumsSeedFromListing", () => {
  it("fills brand, VIN and the platform listing link", () => {
    const rec = irissPasutijumsSeedFromListing(
      {
        id: "car-1",
        title: "BMW 520d",
        manufacturer: "BMW",
        year: "2019",
        firstRegistration: "2019-03",
        mileageKm: 120000,
        fuel: "Dīzelis",
        transmission: "Automāts",
        powerKw: "140 kW",
        vin,
        detailUrl: "https://www.auto1.com/a/1",
        platform: "auto1",
        color: "Melna",
        bodyType: "Sedans",
      },
      "ord-1",
      "2026-10-14T10:00:00.000Z",
    );
    expect(rec.id).toBe("ord-1");
    expect(rec.brandModel).toBe("BMW 520d");
    expect(rec.vin).toBe(vin);
    expect(rec.listingLinkAuto1).toEqual(["https://www.auto1.com/a/1"]);
    expect(rec.listStatus).toBe("active");
    expect(rec.engineType).toContain("140 kW");
    expect(irissListingVin("nope")).toBe("");
  });

  it("puts an eCarsTrade detail URL on listingLinkEcarstrade", () => {
    const rec = irissPasutijumsSeedFromListing(
      {
        id: "car-et",
        title: "VOLVO EX30",
        manufacturer: "Volvo",
        year: "2025",
        firstRegistration: "12/2025",
        mileageKm: 8388,
        fuel: "Electric",
        transmission: "Automatic",
        powerKw: "200",
        vin: "",
        detailUrl: "https://ecarstrade.com/cars/7672194",
        platform: "ecarstrade",
        color: "",
        bodyType: "",
      },
      "ord-et",
      "2026-10-14T10:00:00.000Z",
    );
    expect(rec.listingLinkEcarstrade).toEqual(["https://ecarstrade.com/cars/7672194"]);
    expect(rec.listingLinkAuto1).toEqual([""]);
  });

  it("seeds a LIST offer with validUntil date", () => {
    const offer = irissOfferSeedFromListing(
      {
        id: "car-1",
        title: "BMW 520d",
        manufacturer: "BMW",
        year: "2019",
        firstRegistration: "2019-03",
        mileageKm: 120000,
        fuel: "Dīzelis",
        transmission: "Automāts",
        powerKw: "140 kW",
        vin,
        detailUrl: "https://www.auto1.com/a/1",
        platform: "auto1",
        color: "Melna",
        bodyType: "Sedans",
        location: "Berlīne",
        priceCurrent: 12500,
        priceStart: 10000,
        priceBuyNow: null,
        priceMinimal: null,
      },
      "off-1",
      "2026-10-14T10:00:00.000Z",
    );
    expect(offer.brandModel).toBe("BMW 520d");
    expect(offer.vin).toBe(vin);
    expect(offer.validUntil).toBe("2026-10-17");
    expect(offer.carPrice).toContain("€");
    const rec = irissPasutijumsOfferSeedFromListing(
      {
        id: "car-1",
        title: "BMW 520d",
        manufacturer: "BMW",
        year: "2019",
        firstRegistration: "2019-03",
        mileageKm: 120000,
        fuel: "Dīzelis",
        transmission: "Automāts",
        powerKw: "140",
        vin,
        detailUrl: "https://autobid.de/en/item/1",
        platform: "autobid",
        color: "",
        bodyType: "",
        location: "",
        priceCurrent: null,
        priceStart: null,
        priceBuyNow: null,
        priceMinimal: null,
      },
      "ord-1",
      "2026-10-14T10:00:00.000Z",
      "off-1",
    );
    expect(rec.listStatus).toBe("offered");
    expect(rec.offers).toHaveLength(1);
    expect(rec.offers[0]?.validUntil).toBe("2026-10-17");
  });
});
