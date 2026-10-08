import { describe, expect, it } from "vitest";
import { reconcileVehicles, sourceKey, type IrissFetchedVehicle } from "@/lib/iriss-listings-reconcile";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const T1 = "2026-10-07T05:00:00.000Z";
const T2 = "2026-10-08T05:00:00.000Z";
const T3 = "2026-10-09T05:00:00.000Z";

function fetched(partial: Partial<IrissFetchedVehicle> & { id: string }): IrissFetchedVehicle {
  return {
    platform: "autobid",
    externalId: partial.id,
    detailUrl: `https://autobid.de/en/item/${partial.id}`,
    orderId: "o1",
    orderBrandModel: "Volvo XC60",
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

function run(previous: IrissListingVehicle[], list: IrissFetchedVehicle[], now: string, ok = [sourceKey("autobid", "o1")], active = ["o1"]) {
  return reconcileVehicles({ previous, fetched: list, okSourceKeys: new Set(ok), activeOrderIds: new Set(active), now });
}

describe("reconcileVehicles", () => {
  it("first run marks everything new", () => {
    const r = run([], [fetched({ id: "a" }), fetched({ id: "b" })], T1);
    expect(r.newCount).toBe(2);
    expect(r.vehicles.map((v) => v.change)).toEqual(["new", "new"]);
    expect(r.vehicles[0]!.firstSeenAt).toBe(T1);
    expect(r.vehicles[0]!.orderIds).toEqual(["o1"]);
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

  it("marks gone only after two consecutive successful reads without the car", () => {
    const first = run([], [fetched({ id: "a" }), fetched({ id: "b" })], T1).vehicles;
    const second = run(first, [fetched({ id: "b" })], T2);
    const a2 = second.vehicles.find((v) => v.id === "a")!;
    expect(a2.missingRuns).toBe(1);
    expect(a2.change).toBe("unchanged");
    expect(second.goneCount).toBe(0);

    const third = run(second.vehicles, [fetched({ id: "b" })], T3);
    const a3 = third.vehicles.find((v) => v.id === "a")!;
    expect(a3.missingRuns).toBe(2);
    expect(a3.change).toBe("gone");
    expect(third.goneCount).toBe(1);
  });

  it("does not count missing when the source read failed", () => {
    const first = run([], [fetched({ id: "a" })], T1).vehicles;
    const r = run(first, [], T2, []);
    expect(r.vehicles[0]!.missingRuns).toBe(0);
    expect(r.vehicles[0]!.change).toBe("unchanged");
  });

  it("drops vehicles whose orders are no longer active", () => {
    const first = run([], [fetched({ id: "a" })], T1).vehicles;
    const r = run(first, [], T2, [], []);
    expect(r.vehicles).toHaveLength(0);
  });

  it("merges order ids when two searches return the same car", () => {
    const r = run([], [fetched({ id: "a", orderId: "o1" }), fetched({ id: "a", orderId: "o2", orderBrandModel: "Volvo XC60 AWD" })], T1, [], ["o1", "o2"]);
    expect(r.vehicles).toHaveLength(1);
    expect(r.vehicles[0]!.orderIds).toEqual(["o1", "o2"]);
    expect(r.vehicles[0]!.orderBrandModels).toEqual(["Volvo XC60", "Volvo XC60 AWD"]);
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
    const { orderId, orderBrandModel, ...rest } = f;
    const prev: IrissListingVehicle = {
      ...rest,
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

  it("Auto1 leftover current/buyNow cents vs new euro start/min does not fake a change", () => {
    const f = fetched({
      id: "a",
      platform: "auto1",
      priceStart: null,
      priceMinimal: null,
      priceCurrent: 899_700,
      priceBuyNow: 1_200_000,
      salesVatType: 1053,
      stockNumber: "BW03512",
    });
    const { orderId, orderBrandModel, ...rest } = f;
    const prev: IrissListingVehicle = {
      ...rest,
      orderIds: [orderId],
      orderBrandModels: [orderBrandModel],
      firstSeenAt: T1,
      lastSeenAt: T1,
      missingRuns: 0,
      change: "unchanged",
      priceHistory: [
        { at: T1, field: "current", from: null, to: 899_700 },
        { at: T1, field: "buy_now", from: null, to: 1_200_000 },
      ],
    };
    const r = run(
      [prev],
      [
        fetched({
          id: "a",
          platform: "auto1",
          priceStart: 8997,
          priceMinimal: 8997,
          priceCurrent: null,
          priceBuyNow: 12000,
          salesVatType: 1053,
          stockNumber: "BW03512",
        }),
      ],
      T2,
    );
    expect(r.priceChangedCount).toBe(0);
    expect(r.vehicles[0]!.change).toBe("unchanged");
    expect(r.vehicles[0]!.priceStart).toBe(8997);
    expect(r.vehicles[0]!.priceMinimal).toBe(8997);
    expect(r.vehicles[0]!.priceCurrent).toBeNull();
    expect(r.vehicles[0]!.priceBuyNow).toBe(12000);
    expect(r.vehicles[0]!.priceHistory).toEqual([]);
    expect(JSON.stringify(r.vehicles[0])).not.toMatch(/899700|1200000/);
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
    const { orderId, orderBrandModel, ...rest } = f;
    const prev: IrissListingVehicle = {
      ...rest,
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
