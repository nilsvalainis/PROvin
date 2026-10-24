import { describe, expect, it } from "vitest";
import type { AutoparksCar } from "@/lib/iriss-autoparks";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import { offerSeedFromAutoparks, offerSeedFromLogistics, offerSeedTaggedKeys } from "@/lib/iriss-offer-seed";

const car = {
  id: "car1",
  orderId: "ord1",
  vin: "wba8j11000a123456",
  make: "BMW",
  model: "320d Touring",
  year: "2020",
  plate: "",
  color: "melna metālika",
  mileageKm: 98000,
  status: "for_sale",
  location: "Tukums",
  purchasePriceEur: 21000,
  salePriceEur: 27900,
  listPriceEur: 28500,
  equipmentLine: "Panorāmas jumts, LED",
  registry: { makeModel: "BMW 320D", firstRegDate: "06.2020", odometerKm: 98400, fuel: "Dīzelis", gearbox: "Automātiskā" },
} as unknown as AutoparksCar;

describe("offer seed", () => {
  it("fills Autoparks fields from CSDD and v2 tech, but never the price", () => {
    const f = offerSeedFromAutoparks(car, { tech: { firstRegDate: "", powerKw: 140, displacementCm3: 1995 }, location: "" });
    expect(f).toEqual({
      brandModel: "BMW 320d Touring",
      vin: "WBA8J11000A123456",
      firstRegistration: "06.2020",
      year: "06.2020",
      odometerReading: "98 400 km",
      mileage: "98 400 km",
      fuel: "Dīzelis",
      transmission: "Automātiskā",
      powerKw: "140 kW",
      engineDisplacement: "1995 cm³",
      color: "melna metālika",
      location: "Tukums",
      equipmentHighlights: "Panorāmas jumts, LED",
    });
    const blob = JSON.stringify(f);
    for (const sum of ["21000", "27900", "28500", "21 000", "27 900"]) expect(blob).not.toContain(sum);
    expect(f.carPrice).toBeUndefined();
    expect(offerSeedTaggedKeys(f)).toContain("powerKw");
    expect(offerSeedTaggedKeys(f)).not.toContain("carPrice");
  });

  it("fills the Lot/stock nr. and PVN status from Autoparka v2 purchase data", () => {
    const f = offerSeedFromAutoparks(car, {
      purchase: { auction: "Auto1", auctionNo: "568808", vat: { mode: "margin" } },
    });
    expect(f.auctionPlatform).toBe("Auto1");
    expect(f.auctionStockNumber).toBe("568808");
    expect(f.vatStatus).toBe("Margin");
    expect(offerSeedTaggedKeys(f)).toEqual(expect.arrayContaining(["auctionStockNumber", "vatStatus"]));
  });

  it("leaves the Lot/stock nr. and PVN status empty when there is no purchase vat mode", () => {
    const f = offerSeedFromAutoparks(car, { purchase: { auction: "", auctionNo: "", vat: { mode: "" } } });
    expect(f.auctionPlatform).toBeUndefined();
    expect(f.auctionStockNumber).toBeUndefined();
    expect(f.vatStatus).toBeUndefined();
  });

  it("prefers the v2 name, place and CSDD first registration", () => {
    const f = offerSeedFromAutoparks(car, { displayName: "BMW 320d xDrive", location: "Rīga", tech: { firstRegDate: "15.06.2020" } });
    expect(f.brandModel).toBe("BMW 320d xDrive");
    expect(f.location).toBe("Rīga");
    expect(f.firstRegistration).toBe("15.06.2020");
  });

  it("fills Logistics fields including auction, stock no. and price", () => {
    const order = {
      id: "ord1",
      make: "Audi",
      model: "A6",
      vin: "WAUZZZ4G0EN123456",
      title: "",
      auction: "Autobid",
      stockNo: "S-1234",
      priceEur: 15400,
      mileageKm: 120500,
      listingParsed: { make: "", model: "", vin: "", priceEur: null, mileageKm: null, address: "Berlin, DE", source: "", parsedAt: "" },
    } as unknown as LogisticsOrder;
    expect(offerSeedFromLogistics(order)).toEqual({
      brandModel: "Audi A6",
      vin: "WAUZZZ4G0EN123456",
      odometerReading: "120 500 km",
      mileage: "120 500 km",
      auctionPlatform: "Autobid",
      auctionStockNumber: "S-1234",
      carPrice: "15400",
      priceGermany: "15400",
      location: "Berlin, DE",
    });
  });

  it("j41 F1: fills the origin country (valsts) from the Logistics pickup point", () => {
    const order = {
      id: "ord3",
      make: "Audi",
      model: "A6",
      vin: "WAUZZZ4G0EN123456",
      title: "",
      auction: "",
      stockNo: "",
      priceEur: null,
      mileageKm: null,
      listingParsed: null,
      pickupSnapshot: { country: "DE" },
    } as unknown as LogisticsOrder;
    expect(offerSeedFromLogistics(order).originCountry).toBe("DE");
  });

  it("drops the logistics price when sums are hidden for the user", () => {
    const order = {
      id: "ord2",
      make: "Audi",
      model: "A6",
      vin: "WAUZZZ4G0EN123456",
      title: "",
      auction: "Autobid",
      stockNo: "",
      priceEur: 15400,
      mileageKm: null,
      listingParsed: { make: "", model: "", vin: "", priceEur: 16000, mileageKm: null, address: "", source: "", parsedAt: "" },
    } as unknown as LogisticsOrder;
    const f = offerSeedFromLogistics(order, { hideSums: true });
    expect(f.carPrice).toBeUndefined();
    expect(f.priceGermany).toBeUndefined();
    expect(offerSeedTaggedKeys(f)).not.toContain("carPrice");
  });

  it("prefills Apraksti fields (damage grade, key count, service summary) from v2 service data", () => {
    const f = offerSeedFromAutoparks(car, {
      service: {
        problems: [{ text: "Motora kontrollampa deg", fixedByService: false }],
        notes: "Nodotas 2 atslēgas.",
        invoiceCount: 1,
      },
    });
    expect(f.damageGrade).toContain("Zināmas problēmas (1)");
    expect(f.technicalAssessment).toContain("Motora kontrollampa deg");
    expect(f.keyCount).toBe("2");
    expect(f.hasFullServiceHistory).toBe(true);
    expect(f.summary).toContain("1 rēķins");
  });

  it("leaves empty fields out", () => {
    const empty = { ...car, vin: "", color: "", location: "", mileageKm: null, equipmentLine: "", registry: undefined } as unknown as AutoparksCar;
    const f = offerSeedFromAutoparks(empty);
    expect(Object.keys(f).sort()).toEqual(["brandModel", "firstRegistration", "year"]);
  });
});
