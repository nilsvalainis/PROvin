import { describe, expect, it } from "vitest";

import {
  listingPriceChangeAbs,
  listingSortPrice,
  listingYear,
  listingYearLabel,
  parseListingSort,
  parseListingSources,
  parsePriceBound,
  sortListingVehicles,
  vehicleInPriceRange,
  vehicleInSources,
} from "@/lib/iriss-listings-list-view";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const NOW = Date.parse("2026-10-08T12:00:00.000Z");

function car(partial: Partial<IrissListingVehicle> & Pick<IrissListingVehicle, "id">): IrissListingVehicle {
  return {
    platform: "autobid",
    externalId: partial.id,
    detailUrl: "",
    orderIds: [],
    orderBrandModels: [],
    title: partial.id,
    manufacturer: "",
    year: "",
    firstRegistration: "",
    mileageKm: null,
    fuel: "",
    transmission: "",
    powerKw: "",
    location: "",
    countryCode: "",
    imageUrl: "",
    currency: "EUR",
    priceStart: null,
    priceMinimal: null,
    priceCurrent: null,
    priceBuyNow: null,
    vatNote: "",
    auctionId: "",
    auctionStartAt: "",
    auctionEndAt: "",
    auctionStage: "",
    firstSeenAt: "",
    lastSeenAt: "",
    missingRuns: 0,
    change: "unchanged",
    priceHistory: [],
    ...partial,
  };
}

function ids(sort: Parameters<typeof sortListingVehicles>[1], rows: IrissListingVehicle[]): string[] {
  return sortListingVehicles(rows, sort, NOW).map((v) => v.id);
}

describe("listing sort", () => {
  it("defaults to ending and ignores an unknown value", () => {
    expect(parseListingSort(null)).toBeNull();
    expect(parseListingSort("nope")).toBeNull();
    expect(parseListingSort("ending")).toBe("ending");
    expect(parseListingSort("price-change")).toBe("price-change");
  });

  it("puts the soonest live auction first and cars without an end time last", () => {
    const rows = [
      car({ id: "none" }),
      car({ id: "ended-old", auctionEndAt: "2026-10-01T12:00:00.000Z" }),
      car({ id: "later", auctionEndAt: "2026-10-09T18:00:00.000Z" }),
      car({ id: "soon", auctionEndAt: "2026-10-08T13:00:00.000Z" }),
      car({ id: "ended-new", auctionEndAt: "2026-10-08T09:00:00.000Z" }),
    ];
    expect(ids("ending", rows)).toEqual(["soon", "later", "ended-new", "ended-old", "none"]);
  });

  it("sorts price by current, then start, then buy now, with nulls last in both directions", () => {
    const rows = [
      car({ id: "none" }),
      car({ id: "buy", priceBuyNow: 5000 }),
      car({ id: "start", priceStart: 9000, priceBuyNow: 1000 }),
      car({ id: "current", priceCurrent: 3000, priceStart: 100 }),
    ];
    expect(listingSortPrice(rows[1]!)).toBe(5000);
    expect(listingSortPrice(rows[2]!)).toBe(9000);
    expect(listingSortPrice(rows[3]!)).toBe(3000);
    expect(ids("price-asc", rows)).toEqual(["current", "buy", "start", "none"]);
    expect(ids("price-desc", rows)).toEqual(["start", "buy", "current", "none"]);
  });

  it("sorts mileage and year with missing values last", () => {
    const rows = [
      car({ id: "none" }),
      car({ id: "high", mileageKm: 200_000, year: "2012" }),
      car({ id: "low", mileageKm: 40_000, year: "2020" }),
      car({ id: "zero", mileageKm: 0, year: "" }),
    ];
    expect(ids("km-asc", rows)).toEqual(["zero", "low", "high", "none"]);
    expect(ids("km-desc", rows)).toEqual(["high", "low", "zero", "none"]);
    expect(ids("year-desc", rows)).toEqual(["low", "high", "none", "zero"]);
    expect(ids("year-asc", rows)).toEqual(["high", "low", "none", "zero"]);
    expect(listingYear(car({ id: "reg", year: "", firstRegistration: "07.2018" }))).toBe(2018);
    expect(listingYearLabel(car({ id: "miss" }))).toBe("gads ?");
    expect(listingYearLabel(car({ id: "y", year: "2020" }))).toBe("2020");
  });

  it("sorts first seen newest first and the largest price change first", () => {
    const rows = [
      car({ id: "old", firstSeenAt: "2026-10-01T00:00:00.000Z", priceHistory: [{ at: "t", field: "current", from: 1000, to: 1100 }] }),
      car({ id: "new", firstSeenAt: "2026-10-08T00:00:00.000Z", priceHistory: [{ at: "t", field: "current", from: null, to: 5000 }] }),
      car({ id: "mid", firstSeenAt: "2026-10-04T00:00:00.000Z", priceHistory: [{ at: "t", field: "current", from: 2000, to: 8000 }] }),
      car({ id: "blank", firstSeenAt: "" }),
    ];
    expect(ids("seen", rows)).toEqual(["new", "mid", "old", "blank"]);
    expect(listingPriceChangeAbs(rows[1]!)).toBeNull();
    expect(ids("price-change", rows)).toEqual(["mid", "old", "blank", "new"]);
    expect(parseListingSort("make")).toBe("make");
    expect(parseListingSort("room")).toBe("room");
  });

  it("sorts remaining bid room descending, nulls last", () => {
    const rows = [
      car({ id: "none" }),
      { ...car({ id: "small" }), _room: 200 },
      { ...car({ id: "big" }), _room: 4000 },
    ];
    expect(ids("room", rows)).toEqual(["big", "small", "none"]);
  });
});

describe("listing filters", () => {
  it("treats an empty source list as all platforms", () => {
    expect(parseListingSources("")).toEqual([]);
    expect(parseListingSources("auto1,nope,autobid")).toEqual(["autobid", "auto1"]);
    expect(vehicleInSources("openline", [])).toBe(true);
    expect(vehicleInSources("openline", ["autobid"])).toBe(false);
    expect(vehicleInSources("autobid", ["autobid", "auto1"])).toBe(true);
  });

  it("drops cars without a price when a range is set", () => {
    const priced = car({ id: "a", priceCurrent: 4000 });
    const fallback = car({ id: "b", priceStart: 1500 });
    const none = car({ id: "c" });
    expect(parsePriceBound("")).toBeNull();
    expect(parsePriceBound("-5")).toBeNull();
    expect(parsePriceBound("1,5")).toBe(1.5);
    expect(vehicleInPriceRange(priced, 3000, 5000)).toBe(true);
    expect(vehicleInPriceRange(priced, 4500, null)).toBe(false);
    expect(vehicleInPriceRange(fallback, null, 2000)).toBe(true);
    expect(vehicleInPriceRange(none, 0, 99999)).toBe(false);
    expect(vehicleInPriceRange(none, null, null)).toBe(true);
  });
});
