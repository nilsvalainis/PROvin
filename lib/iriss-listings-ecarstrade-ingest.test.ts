import { describe, expect, it } from "vitest";
import { applyListingEntryFilter, applySearchFilterToVehicles, filterForListingSource } from "@/lib/iriss-listings-search-filter";
import { reconcileVehicles, sourceKey, type IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const T1 = "2026-10-13T10:05:00.000Z";
const T2 = "2026-10-14T10:05:00.000Z";
const T3 = "2026-10-15T10:05:00.000Z";

const BMW_2_SERIES_ESTATE =
  "https://ecarstrade.com/search?mark[]=7&model[]=2956&category[]=Estate%20Car&year_from=2016&year_to=2020&fuel[]=Diesel";
const MERCEDES_E_CLASS =
  "https://ecarstrade.com/search?mark[]=45&model[]=815&category[]=Estate%20Car";

function etFetched(partial: Partial<IrissFetchedVehicle> & { id: string; title: string }): IrissFetchedVehicle {
  return {
    platform: "ecarstrade",
    externalId: partial.id,
    detailUrl: `https://ecarstrade.com/cars/${partial.id}`,
    orderId: "o-et",
    orderBrandModel: "BMW 2 Series",
    manufacturer: "BMW",
    year: "2018",
    firstRegistration: "03.2018",
    mileageKm: 90_000,
    fuel: "Diesel",
    transmission: "Automatic",
    powerKw: "140",
    location: "Antwerp",
    countryCode: "BE",
    imageUrl: "",
    currency: "EUR",
    priceStart: null,
    priceMinimal: null,
    priceCurrent: null,
    priceBuyNow: 16200,
    vatNote: "",
    auctionId: "1",
    auctionStartAt: "2026-10-16T08:00:00+00:00",
    auctionEndAt: "",
    auctionStage: "STOCK",
    ...partial,
  };
}

describe("eCarsTrade ingest persist after #147", () => {
  it("keeps found 220d / E220 against catalog 2 Series / E-Class / Estate Car URLs", () => {
    const bmwSrc = {
      platform: "ecarstrade" as const,
      sourceUrl: BMW_2_SERIES_ESTATE,
      orderBrandModel: "BMW 2 Series",
    };
    const mercedesSrc = {
      platform: "ecarstrade" as const,
      sourceUrl: MERCEDES_E_CLASS,
      orderBrandModel: "Mercedes E-Class",
    };
    const bmw = {
      title: "BMW 220d Gran Tourer",
      manufacturer: "BMW",
      year: "2018",
      firstRegistration: "03.2018",
      fuel: "Diesel",
      transmission: "Automatic",
    };
    const mercedes = { title: "Mercedes-Benz E220", manufacturer: "Mercedes" };
    const tooNew = { ...bmw, title: "BMW 220d 2024", firstRegistration: "06/2024", year: "2024" };
    const petrol = { ...bmw, title: "BMW 220i", fuel: "Petrol" };

    expect(applySearchFilterToVehicles([bmw], filterForListingSource(bmwSrc.sourceUrl, bmwSrc.orderBrandModel))).toEqual([]);
    expect(applyListingEntryFilter([bmw, tooNew, petrol], bmwSrc).map((v) => v.title)).toEqual([
      "BMW 220d Gran Tourer",
    ]);
    expect(applyListingEntryFilter([mercedes], mercedesSrc)).toEqual([mercedes]);
  });

  it("drops cars outside year, mileage, price, fuel and gearbox on ET ingest", () => {
    const src = {
      platform: "ecarstrade" as const,
      sourceUrl:
        "https://ecarstrade.com/search?mark[]=68&year_from=2018&year_to=2020&mileage_to=150000&price_to=28000&fuel[]=Diesel&gearbox[]=Automatic",
      orderBrandModel: "Volvo XC60",
    };
    const ok = {
      title: "Volvo XC60",
      manufacturer: "Volvo",
      year: "",
      firstRegistration: "12/2019",
      mileageKm: 80_000,
      priceEstimate: 17_000,
      platform: "ecarstrade",
      fuel: "Diesel",
      transmission: "Automatic",
      priceCurrent: null,
      priceBuyNow: null,
      priceStart: null,
    };
    const kept = applyListingEntryFilter(
      [
        ok,
        { ...ok, title: "newer", firstRegistration: "01/2023" },
        { ...ok, title: "km", mileageKm: 180_000 },
        { ...ok, title: "price", priceEstimate: 40_000 },
        { ...ok, title: "fuel", fuel: "Petrol" },
        { ...ok, title: "gear", transmission: "Manual" },
        { ...ok, title: "noyear", firstRegistration: "", year: "" },
      ],
      src,
    );
    expect(kept.map((v) => v.title)).toEqual(["Volvo XC60"]);
  });

  it("still drops opposite drive on ET ingest and keeps every colour", () => {
    const src = {
      platform: "ecarstrade" as const,
      sourceUrl: "https://ecarstrade.com/search?mark[]=5&model[]=55&iriss_drive=awd&iriss_exclude_color=Yellow",
      orderBrandModel: "Audi A6",
    };
    expect(
      applyListingEntryFilter(
        [
          { title: "Audi A6 3.0 TDI quattro", manufacturer: "Audi", color: "Black" },
          { title: "Audi A6 2.0 TDI Front", manufacturer: "Audi", color: "Blue" },
          { title: "Audi A6 3.0 TDI quattro", manufacturer: "Audi", color: "Yellow" },
        ],
        src,
      ).map((v) => `${v.title} ${v.color}`),
    ).toEqual(["Audi A6 3.0 TDI quattro Black", "Audi A6 3.0 TDI quattro Yellow"]);
  });

  it("persists found ET cars across two ok reads and does not mark them gone", () => {
    const src = {
      platform: "ecarstrade" as const,
      sourceUrl: BMW_2_SERIES_ESTATE,
      orderBrandModel: "BMW 2 Series",
    };
    const previousStored = etFetched({ id: "prev-996", title: "BMW 218d" });
    const found = etFetched({ id: "220d", title: "BMW 220d Gran Tourer" });
    const kept = applyListingEntryFilter([found], src);
    expect(kept).toHaveLength(1);

    const ok = [sourceKey("ecarstrade", "o-et")];
    const first = reconcileVehicles({
      previous: [],
      fetched: kept,
      okSourceKeys: new Set(ok),
      activeOrderIds: new Set(["o-et"]),
      now: T1,
    });
    expect(first.newCount).toBe(1);
    expect(first.vehicles[0]?.change).toBe("new");
    expect(first.vehicles[0]?.id).toBe("220d");

    const prevRow: IrissListingVehicle = {
      ...previousStored,
      orderIds: ["o-et"],
      orderBrandModels: ["BMW 2 Series"],
      firstSeenAt: T1,
      lastSeenAt: T1,
      missingRuns: 0,
      change: "unchanged",
      priceHistory: [],
    };
    const withPrev = reconcileVehicles({
      previous: [...first.vehicles, prevRow],
      fetched: kept,
      okSourceKeys: new Set(ok),
      activeOrderIds: new Set(["o-et"]),
      now: T2,
    });
    expect(withPrev.vehicles.find((v) => v.id === "220d")?.change).toBe("unchanged");
    expect(withPrev.vehicles.find((v) => v.id === "prev-996")?.change).not.toBe("gone");

    const third = reconcileVehicles({
      previous: withPrev.vehicles,
      fetched: kept,
      okSourceKeys: new Set(ok),
      activeOrderIds: new Set(["o-et"]),
      now: T3,
    });
    expect(third.goneCount).toBe(1);
    expect(third.vehicles.find((v) => v.id === "220d")?.change).not.toBe("gone");
    expect(third.vehicles.find((v) => v.id === "220d")?.missingRuns).toBe(0);
    expect(third.vehicles.find((v) => v.id === "prev-996")?.change).toBe("gone");
  });
});
