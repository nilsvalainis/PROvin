import { describe, expect, it } from "vitest";
import { applyListingMembership, listingSearchKey, listingSearchReadComplete } from "@/lib/iriss-listings-membership";
import { isLegacyStaleAuto1Vehicle, reconcileVehicles, type IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import type { IrissListingSource } from "@/lib/iriss-listings-sources";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const T1 = "2026-10-07T05:00:00.000Z";
const T2 = "2026-10-08T05:00:00.000Z";
const T3 = "2026-10-09T05:00:00.000Z";
const URL_O1 = "https://autobid.de/en/search-results?q=o1";
const URL_O1B = "https://autobid.de/en/search-results?q=o1b";
const URL_O2 = "https://autobid.de/en/search-results?q=o2";
const KEY_O1 = listingSearchKey("autobid", URL_O1);
const KEY_O1B = listingSearchKey("autobid", URL_O1B);
const KEY_O2 = listingSearchKey("autobid", URL_O2);

function src(orderId: string, sourceUrl: string, brand = "Volvo XC60"): IrissListingSource {
  return { id: `${orderId}-${sourceUrl.slice(-6)}`, orderId, orderBrandModel: brand, platform: "autobid", sourceUrl };
}

function fetched(partial: Partial<IrissFetchedVehicle> & { id: string }): IrissFetchedVehicle {
  return {
    platform: "autobid",
    externalId: partial.id,
    detailUrl: `https://autobid.de/en/item/${partial.id}`,
    orderId: "o1",
    orderBrandModel: "Volvo XC60",
    sourceKey: KEY_O1,
    title: `Car ${partial.id}`,
    manufacturer: "Volvo",
    year: "2020",
    firstRegistration: "01.2020",
    mileageKm: 100000,
    fuel: "Diesel",
    transmission: "Automatic",
    powerKw: "140",
    location: "Stuttgart",
    countryCode: "DE",
    imageUrl: "",
    currency: "EUR",
    priceStart: 20000,
    priceMinimal: 15000,
    priceCurrent: null,
    priceBuyNow: null,
    vatNote: "",
    auctionId: "1",
    auctionStartAt: "2026-10-10T08:00:00+00:00",
    auctionEndAt: "",
    auctionStage: "BEFORE_AUCTION",
    ...partial,
  };
}

function run(
  previous: IrissListingVehicle[],
  list: IrissFetchedVehicle[],
  now: string,
  ok: string[] = [KEY_O1],
  sources: IrissListingSource[] = [src("o1", URL_O1)],
  rejected: string[] = [],
) {
  return reconcileVehicles({
    previous,
    fetched: list,
    okCompleteSourceKeys: new Set(ok),
    activeSourceKeys: new Set(sources.map((s) => listingSearchKey(s.platform, s.sourceUrl))),
    activeSources: sources,
    rejectedIds: new Set(rejected),
    now,
  });
}

describe("listingSearchReadComplete", () => {
  it("requires ok status, all pages, and no cap truncation or page error", () => {
    expect(listingSearchReadComplete({ status: "ok", pagesFetched: 2, pageCount: 2, maxPages: 5 })).toBe(true);
    expect(listingSearchReadComplete({ status: "ok", pagesFetched: 1, pageCount: 0, maxPages: 5 })).toBe(true);
    expect(listingSearchReadComplete({ status: "ok", pagesFetched: 2, pageCount: 9, maxPages: 5 })).toBe(false);
    expect(listingSearchReadComplete({ status: "ok", pagesFetched: 1, pageCount: 3, maxPages: 5 })).toBe(false);
    expect(listingSearchReadComplete({ status: "ok", pagesFetched: 2, pageCount: 2, maxPages: 5, pageError: true })).toBe(false);
    expect(listingSearchReadComplete({ status: "fetch_failed", pagesFetched: 2, pageCount: 2, maxPages: 5 })).toBe(false);
    expect(listingSearchReadComplete({ status: "ok", pagesFetched: 0, pageCount: 0, maxPages: 5 })).toBe(false);
  });
});

describe("reconcileVehicles", () => {
  it("first run marks everything new", () => {
    const r = run([], [fetched({ id: "a" }), fetched({ id: "b" })], T1);
    expect(r.newCount).toBe(2);
    expect(r.vehicles.map((v) => v.change)).toEqual(["new", "new"]);
    expect(r.vehicles[0]!.firstSeenAt).toBe(T1);
    expect(r.vehicles[0]!.orderIds).toEqual(["o1"]);
    expect(r.vehicles[0]!.sourceKeys).toEqual([KEY_O1]);
  });

  it("detects price change and keeps history; unchanged otherwise", () => {
    const first = run([], [fetched({ id: "a" }), fetched({ id: "b" })], T1).vehicles;
    const r = run(first, [fetched({ id: "a", priceStart: 18500 }), fetched({ id: "b" })], T2);
    expect(r.newCount).toBe(0);
    expect(r.priceChangedCount).toBe(1);
    const a = r.vehicles.find((v) => v.id === "a")!;
    expect(a.change).toBe("price_changed");
    expect(a.priceHistory).toEqual([{ at: T2, field: "start", from: 20000, to: 18500 }]);
    expect(a.firstSeenAt).toBe(T1);
    expect(a.lastSeenAt).toBe(T2);
    expect(r.vehicles.find((v) => v.id === "b")!.change).toBe("unchanged");
  });

  it("first appearing current bid is not a price change", () => {
    const first = run([], [fetched({ id: "a" })], T1).vehicles;
    const r = run(first, [fetched({ id: "a", priceCurrent: 15100 })], T2);
    expect(r.priceChangedCount).toBe(0);
    expect(r.vehicles[0]!.priceHistory).toEqual([]);
  });

  it("removes a listing after one complete successful miss, not two plus 14 days", () => {
    const first = run([], [fetched({ id: "a" }), fetched({ id: "b" })], T1).vehicles;
    const second = run(first, [fetched({ id: "b" })], T2);
    expect(second.vehicles.find((v) => v.id === "a")).toBeUndefined();
    expect(second.goneCount).toBe(1);
    expect(second.vehicles.map((v) => v.id)).toEqual(["b"]);
  });

  it("does not remove when the search read failed or was incomplete", () => {
    const first = run([], [fetched({ id: "a" })], T1).vehicles;
    const failed = run(first, [], T2, []);
    expect(failed.vehicles).toHaveLength(1);
    expect(failed.vehicles[0]!.id).toBe("a");
    const incomplete = run(first, [], T2, []);
    expect(incomplete.vehicles).toHaveLength(1);
  });

  it("drops vehicles whose search link was removed, even if another link on the order remains", () => {
    const sourcesBoth = [src("o1", URL_O1), src("o1", URL_O1B)];
    const first = run(
      [],
      [fetched({ id: "from-a", sourceKey: KEY_O1 }), fetched({ id: "from-b", sourceKey: KEY_O1B })],
      T1,
      [KEY_O1, KEY_O1B],
      sourcesBoth,
    ).vehicles;
    expect(first).toHaveLength(2);
    const afterRemove = run(first, [], T2, [], [src("o1", URL_O1B)]);
    expect(afterRemove.vehicles.map((v) => v.id)).toEqual(["from-b"]);
    expect(afterRemove.vehicles[0]!.sourceKeys).toEqual([KEY_O1B]);
  });

  it("keeps a listing that still matches another valid search of a different order", () => {
    const sources = [src("o1", URL_O1), src("o2", URL_O1, "Volvo XC60 AWD")];
    const r = run(
      [],
      [fetched({ id: "a", orderId: "o1" }), fetched({ id: "a", orderId: "o2", orderBrandModel: "Volvo XC60 AWD" })],
      T1,
      [KEY_O1],
      sources,
    );
    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]!.orderIds).toEqual(["o1", "o2"]);
    const onlyO2 = run(r.vehicles, [], T2, [], [src("o2", URL_O1, "Volvo XC60 AWD")]);
    expect(onlyO2.vehicles).toHaveLength(1);
    expect(onlyO2.vehicles[0]!.orderIds).toEqual(["o2"]);
  });

  it("never re-adds a rejected id even if the search still returns it", () => {
    const first = run([], [fetched({ id: "a" })], T1).vehicles;
    const r = run(first, [fetched({ id: "a" }), fetched({ id: "b" })], T2, [KEY_O1], [src("o1", URL_O1)], ["a"]);
    expect(r.vehicles.map((v) => v.id)).toEqual(["b"]);
    expect(r.newCount).toBe(1);
  });

  it("treats a passed auction end time as inactive", () => {
    const first = run([], [fetched({ id: "a", auctionEndAt: "2026-10-07T12:00:00.000Z" })], T1).vehicles;
    expect(first).toHaveLength(1);
    const later = run(first, [fetched({ id: "a", auctionEndAt: "2026-10-07T12:00:00.000Z" })], T2);
    expect(later.vehicles).toHaveLength(0);
    expect(later.goneCount).toBe(1);
  });

  it("imports again as new if a removed listing reappears", () => {
    const first = run([], [fetched({ id: "a" })], T1).vehicles;
    const gone = run(first, [], T2);
    expect(gone.vehicles).toHaveLength(0);
    const back = run(gone.vehicles, [fetched({ id: "a" })], T3);
    expect(back.vehicles).toHaveLength(1);
    expect(back.vehicles[0]!.change).toBe("new");
    expect(back.newCount).toBe(1);
  });

  it("does not merge the same VIN-like id across platforms", () => {
    const auto1Key = listingSearchKey("auto1", "https://www.auto1.com/en/app/merchant/cars?q=1");
    const auto1Src: IrissListingSource = {
      id: "o1-auto1",
      orderId: "o1",
      orderBrandModel: "Volvo XC60",
      platform: "auto1",
      sourceUrl: "https://www.auto1.com/en/app/merchant/cars?q=1",
    };
    const r = run(
      [],
      [
        fetched({ id: "ab-vin1", externalId: "VIN1", platform: "autobid", sourceKey: KEY_O1 }),
        fetched({ id: "a1-vin1", externalId: "VIN1", platform: "auto1", sourceKey: auto1Key, orderId: "o1" }),
      ],
      T1,
      [KEY_O1, auto1Key],
      [src("o1", URL_O1), auto1Src],
    );
    expect(r.vehicles).toHaveLength(2);
    expect(r.vehicles.map((v) => v.externalId)).toEqual(["VIN1", "VIN1"]);
    expect(r.vehicles.map((v) => v.platform).sort()).toEqual(["auto1", "autobid"]);
  });

  it("sorts by auction start, then title", () => {
    const r = run([], [fetched({ id: "late", auctionStartAt: "2026-10-12T08:00:00+00:00" }), fetched({ id: "early", auctionStartAt: "2026-10-09T08:00:00+00:00" })], T1);
    expect(r.vehicles.map((v) => v.id)).toEqual(["early", "late"]);
  });

  it("Auto1 old cents snapshot does not record a fake price change", () => {
    const f = fetched({
      id: "a",
      platform: "auto1",
      priceStart: null,
      priceMinimal: 651300,
      priceCurrent: null,
      priceBuyNow: null,
      salesVatType: null,
      stockNumber: "",
    });
    const { orderId, orderBrandModel, sourceKey, ...rest } = f;
    const prev: IrissListingVehicle = {
      ...rest,
      sourceKeys: [sourceKey],
      orderIds: [orderId],
      orderBrandModels: [orderBrandModel],
      firstSeenAt: T1,
      lastSeenAt: T1,
      missingRuns: 0,
      change: "unchanged",
      priceHistory: [{ at: T1, field: "minimal", from: null, to: 651300 }],
      salesVatType: null,
      stockNumber: "",
    };
    const r = run(
      [prev],
      [fetched({ id: "a", platform: "auto1", priceStart: null, priceMinimal: 6513, priceCurrent: null, priceBuyNow: null, salesVatType: 1053, stockNumber: "BW03512" })],
      T2,
    );
    expect(r.priceChangedCount).toBe(0);
    expect(r.vehicles[0]!.change).toBe("unchanged");
    expect(r.vehicles[0]!.priceMinimal).toBe(6513);
    expect(r.vehicles[0]!.priceHistory).toEqual([]);
    expect(JSON.stringify(r.vehicles[0]!.priceHistory)).not.toMatch(/651300/);
  });

  it("drops carried Auto1 records that lack photo, VAT fields and end time", () => {
    const f = fetched({
      id: "stale",
      platform: "auto1",
      imageUrl: "",
      salesVatType: null,
      taxDeduction: null,
      auctionEndAt: "",
    });
    const { orderId, orderBrandModel, sourceKey, ...rest } = f;
    const prev: IrissListingVehicle = {
      ...rest,
      sourceKeys: [sourceKey],
      orderIds: [orderId],
      orderBrandModels: [orderBrandModel],
      firstSeenAt: T1,
      lastSeenAt: T1,
      missingRuns: 0,
      change: "unchanged",
      priceHistory: [],
    };
    expect(isLegacyStaleAuto1Vehicle(prev)).toBe(true);
    const r = run([prev], [], T2, []);
    expect(r.vehicles).toHaveLength(0);
  });

  it("Auto1 euro price drop is still a price change", () => {
    const f = fetched({
      id: "a",
      platform: "auto1",
      priceStart: null,
      priceMinimal: 6513,
      priceCurrent: null,
      priceBuyNow: null,
      salesVatType: 1053,
      stockNumber: "BW03512",
    });
    const { orderId, orderBrandModel, sourceKey, ...rest } = f;
    const prev: IrissListingVehicle = {
      ...rest,
      sourceKeys: [sourceKey],
      orderIds: [orderId],
      orderBrandModels: [orderBrandModel],
      firstSeenAt: T1,
      lastSeenAt: T1,
      missingRuns: 0,
      change: "unchanged",
      priceHistory: [],
      salesVatType: 1053,
      stockNumber: "BW03512",
    };
    const r = run(
      [prev],
      [fetched({ id: "a", platform: "auto1", priceStart: null, priceMinimal: 6400, priceCurrent: null, priceBuyNow: null, salesVatType: 1053, stockNumber: "BW03512" })],
      T2,
    );
    expect(r.priceChangedCount).toBe(1);
    expect(r.vehicles[0]!.change).toBe("price_changed");
    expect(r.vehicles[0]!.priceHistory).toEqual([{ at: T2, field: "minimal", from: 6513, to: 6400 }]);
  });
});

describe("applyListingMembership", () => {
  it("drops cars for a deactivated order immediately without waiting for a fetch", () => {
    const stored = run([], [fetched({ id: "a" })], T1).vehicles;
    const { vehicles, dropped } = applyListingMembership({
      vehicles: stored,
      sources: [],
      rejectedIds: new Set(),
      nowMs: Date.parse(T2),
    });
    expect(dropped).toBe(1);
    expect(vehicles).toHaveLength(0);
  });

  it("keeps a car that still belongs to another remaining search key", () => {
    const sources = [src("o1", URL_O1), src("o2", URL_O2, "Passat")];
    const stored = run(
      [],
      [fetched({ id: "a", sourceKey: KEY_O1 }), fetched({ id: "a", orderId: "o2", orderBrandModel: "Passat", sourceKey: KEY_O2 })],
      T1,
      [KEY_O1, KEY_O2],
      sources,
    ).vehicles;
    const { vehicles } = applyListingMembership({
      vehicles: stored,
      sources: [src("o2", URL_O2, "Passat")],
      rejectedIds: new Set(),
      nowMs: Date.parse(T2),
    });
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]!.orderIds).toEqual(["o2"]);
    expect(vehicles[0]!.sourceKeys).toEqual([KEY_O2]);
  });
});
