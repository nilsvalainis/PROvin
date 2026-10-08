import { describe, expect, it } from "vitest";
import {
  applyAuto1CentsMigration,
  isAuto1CentsRescale,
  isRealListingPriceChange,
  listingAuctionTypeLabel,
  sanitizeAuto1CentsVehicle,
} from "@/lib/iriss-listings-auto1-cents";

function auto1(over: Partial<Parameters<typeof sanitizeAuto1CentsVehicle>[0]> = {}) {
  return {
    platform: "auto1",
    priceStart: null as number | null,
    priceMinimal: null as number | null,
    priceCurrent: null as number | null,
    priceBuyNow: null as number | null,
    priceHistory: [] as { at: string; field: "start" | "minimal" | "current" | "buy_now"; from: number | null; to: number | null }[],
    salesVatType: 1053 as number | null,
    stockNumber: "BW03512",
    ...over,
  };
}

describe("Auto1 cents guard and migration", () => {
  it("treats leftover current cents vs new euro start/min as a rescale, including buyNow", () => {
    const prev = auto1({
      priceStart: null,
      priceMinimal: null,
      priceCurrent: 899_700,
      priceBuyNow: 1_200_000,
      priceHistory: [{ at: "t1", field: "current", from: null, to: 899_700 }],
    });
    const next = auto1({
      priceStart: 8997,
      priceMinimal: 8997,
      priceCurrent: null,
      priceBuyNow: 12000,
    });
    expect(isAuto1CentsRescale(prev, next)).toBe(true);
  });

  it("same-field cents on start/min/current/buyNow is a rescale even with stockNumber", () => {
    const prev = auto1({ priceStart: 400_000, priceMinimal: 450_000, priceCurrent: 512_300, priceBuyNow: 890_000 });
    const next = auto1({ priceStart: 4000, priceMinimal: 4500, priceCurrent: 5123, priceBuyNow: 8900 });
    expect(isAuto1CentsRescale(prev, next)).toBe(true);
  });

  it("euro drop is not a rescale", () => {
    const prev = auto1({ priceMinimal: 6513, priceCurrent: 6400 });
    const next = auto1({ priceMinimal: 6400, priceCurrent: 6200 });
    expect(isAuto1CentsRescale(prev, next)).toBe(false);
  });

  it("migrates mixed Blob fields and drops fake history", () => {
    const { vehicle, changed } = sanitizeAuto1CentsVehicle(
      auto1({
        priceStart: 8997,
        priceMinimal: 8997,
        priceCurrent: 899_700,
        priceBuyNow: null,
        priceHistory: [
          { at: "t1", field: "current", from: null, to: 899_700 },
          { at: "t2", field: "start", from: null, to: 8997 },
          { at: "t2", field: "minimal", from: null, to: 8997 },
          { at: "t2", field: "current", from: 899_700, to: null },
          { at: "t3", field: "minimal", from: 8997, to: 8800 },
        ],
      }),
    );
    expect(changed).toBe(true);
    expect(vehicle.priceStart).toBe(8997);
    expect(vehicle.priceMinimal).toBe(8997);
    expect(vehicle.priceCurrent).toBe(8997);
    expect(vehicle.priceHistory).toEqual([{ at: "t3", field: "minimal", from: 8997, to: 8800 }]);
  });

  it("divides a snapshot that is still entirely cents", () => {
    const { vehicle, changed } = sanitizeAuto1CentsVehicle(
      auto1({
        priceStart: 400_000,
        priceMinimal: 450_000,
        priceCurrent: null,
        priceBuyNow: 890_000,
        priceHistory: [{ at: "t", field: "minimal", from: null, to: 450_000 }],
      }),
    );
    expect(changed).toBe(true);
    expect(vehicle.priceStart).toBe(4000);
    expect(vehicle.priceMinimal).toBe(4500);
    expect(vehicle.priceBuyNow).toBe(8900);
    expect(vehicle.priceHistory).toEqual([]);
  });

  it("leaves Autobid and already-euro Auto1 alone", () => {
    expect(sanitizeAuto1CentsVehicle({ ...auto1({ platform: "autobid", priceCurrent: 899_700 }), platform: "autobid" }).changed).toBe(false);
    expect(sanitizeAuto1CentsVehicle(auto1({ priceMinimal: 6513, priceCurrent: 6400 })).changed).toBe(false);
    const batch = applyAuto1CentsMigration([auto1({ priceCurrent: 899_700, priceStart: 8997 }), auto1({ priceMinimal: 5000 })]);
    expect(batch.changed).toBe(true);
    expect(batch.vehicles[0]!.priceCurrent).toBe(8997);
    expect(batch.vehicles[1]!.priceMinimal).toBe(5000);
  });

  it("real change requires both amounts and not a cents pair", () => {
    expect(isRealListingPriceChange({ from: null, to: 8997 })).toBe(false);
    expect(isRealListingPriceChange({ from: 899_700, to: null })).toBe(false);
    expect(isRealListingPriceChange({ from: 899_700, to: 8997 })).toBe(false);
    expect(isRealListingPriceChange({ from: 8997, to: 8800 })).toBe(true);
  });
});

describe("auctionType label", () => {
  it("hides 24D1/24D2 and translates LASTRUN", () => {
    expect(listingAuctionTypeLabel("24D2")).toBeNull();
    expect(listingAuctionTypeLabel("24D1")).toBeNull();
    expect(listingAuctionTypeLabel("LASTRUN")).toBe("pēdējā iespēja");
    expect(listingAuctionTypeLabel("")).toBeNull();
    expect(listingAuctionTypeLabel("BuyNow")).toBe("BuyNow");
  });
});
