import { describe, expect, it } from "vitest";
import { formatIrissListingsForAi, pickIrissListingComps } from "@/lib/iriss-listings-ai-filter";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

function vehicle(partial: Partial<IrissListingVehicle> & Pick<IrissListingVehicle, "title">): IrissListingVehicle {
  return {
    id: "1",
    platform: "autobid",
    externalId: "1",
    detailUrl: "https://autobid.de/en/item/x-1",
    orderIds: ["o1"],
    orderBrandModels: ["BMW 520"],
    manufacturer: "BMW",
    year: "2018",
    firstRegistration: "05.2018",
    mileageKm: 123456,
    fuel: "Diesel",
    transmission: "Automatic",
    powerKw: "140",
    location: "Stuttgart",
    countryCode: "DE",
    imageUrl: "",
    currency: "EUR",
    priceStart: 18900,
    priceMinimal: 15000,
    priceCurrent: null,
    priceBuyNow: null,
    vatNote: "",
    auctionId: "1",
    auctionStartAt: "2026-10-10T08:00:00+00:00",
    auctionEndAt: "",
    auctionStage: "BEFORE_AUCTION",
    firstSeenAt: "2026-10-01T00:00:00Z",
    lastSeenAt: "2026-10-07T00:00:00Z",
    missingRuns: 0,
    change: "unchanged",
    priceHistory: [],
    ...partial,
  };
}

describe("pickIrissListingComps", () => {
  it("prefers matching brand/model and skips gone vehicles", () => {
    const items = [
      vehicle({ title: "Audi A4" }),
      vehicle({ title: "BMW 520d xDrive" }),
      vehicle({ title: "BMW 520 Touring" }),
      vehicle({ title: "BMW 520i", change: "gone" }),
    ];
    const picked = pickIrissListingComps(items, "BMW 520");
    expect(picked.filter((i) => i.title.includes("BMW")).length).toBeGreaterThanOrEqual(2);
    expect(picked.some((i) => i.title === "BMW 520i")).toBe(false);
  });
});

describe("formatIrissListingsForAi", () => {
  it("includes platform label, prices and mileage without em dashes", () => {
    const text = formatIrissListingsForAi([vehicle({ title: "Test" })]);
    expect(text).toContain("Autobid");
    expect(text).toContain("18 900 EUR");
    expect(text).toContain("123 456 km");
    expect(text).not.toContain("\u2014");
  });
});
