import { describe, expect, it } from "vitest";

import {
  applyListingListQuery,
  countActiveListingFilters,
  listingFilterPills,
  LISTING_DEFAULT_SORT,
  LISTING_SOURCE_CHIPS,
  listingPriceChangeAbs,
  listingSortPrice,
  listingYear,
  listingYearLabel,
  parseListingSort,
  parseListingSources,
  parseListingView,
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

  it("sorts by comparison price: buy-now first, then current, nulls last", () => {
    const rows = [
      car({ id: "none" }),
      car({ id: "buy", priceBuyNow: 5000 }),
      car({ id: "start", priceStart: 9000, priceBuyNow: 12000 }),
      car({ id: "current", priceCurrent: 3000, priceStart: 100 }),
    ];
    expect(listingSortPrice(rows[1]!)).toBe(5000);
    expect(listingSortPrice(rows[2]!)).toBe(12000);
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
    expect(parseListingSources("auto1,nope,autobid")).toEqual(["auto1", "autobid"]);
    expect(parseListingSources("ecarstrade,auto1")).toEqual(["auto1", "ecarstrade"]);
    expect(vehicleInSources("openline", [])).toBe(true);
    expect(vehicleInSources("openline", ["autobid"])).toBe(false);
    expect(vehicleInSources("autobid", ["autobid", "auto1"])).toBe(true);
  });

  it("drops cars without a price when a range is set", () => {
    const priced = car({ id: "a", priceCurrent: 4000 });
    const fallback = car({ id: "b", priceStart: 2500 });
    const none = car({ id: "c" });
    const floor = car({ id: "d", platform: "ecarstrade", priceCurrent: 850, priceStart: 850 });
    const buyNow = car({ id: "e", platform: "ecarstrade", priceCurrent: 850, priceBuyNow: 16200 });
    expect(parsePriceBound("")).toBeNull();
    expect(parsePriceBound("-5")).toBeNull();
    expect(parsePriceBound("1,5")).toBe(1.5);
    expect(vehicleInPriceRange(priced, 3000, 5000)).toBe(true);
    expect(vehicleInPriceRange(priced, 4500, null)).toBe(false);
    expect(vehicleInPriceRange(fallback, null, 3000)).toBe(true);
    expect(vehicleInPriceRange(none, 0, 99999)).toBe(false);
    expect(vehicleInPriceRange(none, null, null)).toBe(true);
    expect(vehicleInPriceRange(floor, 0, 5000)).toBe(false);
    expect(vehicleInPriceRange(buyNow, 10000, 20000)).toBe(true);
  });

  it("keeps mobile.de and AutoScout24 in src", () => {
    expect(parseListingSources("mobilede,autoscout24,auto1")).toEqual(["auto1", "mobilede", "autoscout24"]);
    expect(vehicleInSources("mobilede", ["mobilede"])).toBe(true);
    expect(vehicleInSources("autoscout24", ["auto1"])).toBe(false);
  });
});

describe("listing list query view and filters", () => {
  it("parses view=grid and omits the default list param", () => {
    expect(parseListingView(null)).toBe("list");
    expect(parseListingView("")).toBe("list");
    expect(parseListingView("grid")).toBe("grid");
    expect(parseListingView("list")).toBe("list");
    expect(LISTING_DEFAULT_SORT).toBe("seen");
    const fromList = applyListingListQuery(new URLSearchParams("listing=abc&sort=ending"), { view: "list" }, {
      sort: "ending",
      view: "grid",
      sourceChipCount: LISTING_SOURCE_CHIPS.length,
    });
    expect(fromList.get("listing")).toBe("abc");
    expect(fromList.get("sort")).toBe("ending");
    expect(fromList.has("view")).toBe(false);
    const toGrid = applyListingListQuery(new URLSearchParams("ord=o:1"), { view: "grid" }, {
      sort: LISTING_DEFAULT_SORT,
      view: "list",
      sourceChipCount: LISTING_SOURCE_CHIPS.length,
    });
    expect(toGrid.get("view")).toBe("grid");
    expect(toGrid.has("sort")).toBe(false);
    expect(toGrid.get("ord")).toBe("o:1");
    const clearSrc = applyListingListQuery(new URLSearchParams("src=auto1"), { sources: [] }, {
      sort: LISTING_DEFAULT_SORT,
      view: "list",
      sourceChipCount: LISTING_SOURCE_CHIPS.length,
    });
    expect(clearSrc.has("src")).toBe(false);
  });

  it("counts Slēpt virs budžeta in activeFilterCount and pills", () => {
    expect(
      countActiveListingFilters({
        sources: [],
        priceMin: null,
        priceMax: null,
        hideTech: false,
        hideOverBudget: false,
        listScope: "all",
      }),
    ).toBe(0);
    expect(
      countActiveListingFilters({
        sources: ["auto1", "openline"],
        priceMin: null,
        priceMax: 18000,
        hideTech: false,
        hideOverBudget: true,
        listScope: "all",
      }),
    ).toBe(3);
    const pills = listingFilterPills({
      sources: ["auto1", "openline"],
      sourceLabels: {
        auto1: "Auto1",
        openline: "Openlane",
        autobid: "Autobid",
        ecarstrade: "eCarsTrade",
        mobilede: "mobile.de",
        autoscout24: "AutoScout24",
      },
      priceMin: null,
      priceMax: 18000,
      hideTech: false,
      hideOverBudget: true,
      overBudgetThreshold: 2000,
      listScope: "all",
    });
    expect(pills.map((p) => p.id)).toEqual(["src", "price", "budget"]);
    expect(pills[0]?.label).toBe("Avoti: Auto1, Openlane");
    expect(pills[1]?.label).toBe("Cena līdz 18 000 €");
    expect(pills[2]?.label).toBe("Slēpt virs budžeta + 2 000 €");
  });
});
