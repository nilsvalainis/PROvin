import { describe, expect, it } from "vitest";
import { irissListingPlatformIngestStats } from "@/lib/iriss-listings-ingest-stats";
import type { IrissListingSourceRun, IrissListingVehicle } from "@/lib/iriss-listings-types";

function run(platform: IrissListingSourceRun["platform"], status: IrissListingSourceRun["status"]): IrissListingSourceRun {
  return {
    id: `${platform}-${status}`,
    orderId: "o1",
    orderBrandModel: "X",
    platform,
    sourceUrl: `https://example.com/${platform}`,
    status,
    note: "",
    vehicleCount: 2,
    pagesFetched: 1,
    pageCount: 1,
    fetchedAt: "2026-10-14T00:00:00.000Z",
  };
}

function car(platform: IrissListingVehicle["platform"], change: IrissListingVehicle["change"] = "unchanged"): IrissListingVehicle {
  return {
    id: `${platform}-${change}`,
    platform,
    externalId: "1",
    detailUrl: "",
    orderIds: [],
    orderBrandModels: [],
    title: "X",
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
    change,
    priceHistory: [],
  };
}

describe("irissListingPlatformIngestStats", () => {
  it("counts eCarsTrade sources and live cars separately from other platforms", () => {
    const stats = irissListingPlatformIngestStats(
      [run("ecarstrade", "ok"), run("ecarstrade", "ok"), run("auto1", "login_required")],
      [car("ecarstrade"), car("ecarstrade", "gone"), car("auto1")],
    );
    const ect = stats.find((s) => s.platform === "ecarstrade");
    expect(ect).toMatchObject({ sourceCount: 2, okCount: 2, vehicleCount: 1, status: "ok" });
    const a1 = stats.find((s) => s.platform === "auto1");
    expect(a1).toMatchObject({ sourceCount: 1, okCount: 0, vehicleCount: 1, status: "login_required" });
    expect(stats.find((s) => s.platform === "openline")?.status).toBe("none");
  });
});
