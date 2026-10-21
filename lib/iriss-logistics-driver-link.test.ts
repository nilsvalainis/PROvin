import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { emptyCargoPlan, moveCargoCar } from "@/lib/iriss-logistics-cargo-plan";
import { buildDriverRouteView, driverLinkExpired, driverNavToUrl } from "@/lib/iriss-logistics-driver-link";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

vi.mock("server-only", () => ({}));

function order(partial: Partial<LogisticsOrder> = {}): LogisticsOrder {
  return {
    id: "lo-1",
    workspace: "iriss",
    source: "auction",
    auction: "Openlane",
    auctionUrl: "https://openlane.eu/car/1",
    listingUrl: "",
    listingParsed: null,
    make: "Volkswagen",
    model: "Passat Variant 2.0 TDI",
    vin: "WVWZZZ3CZLE012345",
    title: "VW Passat Variant 2.0 TDI",
    priceEur: 12490,
    mileageKm: 180000,
    pickupPointId: "lp-1",
    pickupSnapshot: {
      name: "Openlane Bremen",
      auction: "Openlane",
      street: "Musterstraße 1",
      postcode: "28000",
      city: "Bremen",
      country: "DE",
      lat: 53.08,
      lng: 8.8,
      hoursText: "P-Pk 7:00-15:30",
      contactName: "Hof",
      phone: "+49421111",
      email: "yard@example.com",
      parkingRule: { freeDays: 3, adminFee: 40, perDay: 12, starts: "" },
      rules: "",
    },
    pickupRef: "1",
    pickupAddress: "Musterstraße 1, 28000 Bremen, DE",
    pickupLat: 53.08,
    pickupLng: 8.8,
    geocodeStatus: "ok",
    pickupDate: "2026-10-21",
    stockNo: "",
    freeParkingUntil: "",
    status: "ready",
    archived: false,
    archivedAt: "",
    previousStatus: "",
    statusNote: "",
    nextAction: "",
    sellerContact: "Klients Anna +37120000000",
    notes: "",
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
    ...partial,
  };
}

describe("šofera maršruts", () => {
  it("pieturas kravas secībā, bez cenas un klienta kontakta", () => {
    let plan = emptyCargoPlan("2026-10-21T00:00:00Z");
    plan = moveCargoCar(plan, "b", "next");
    plan = moveCargoCar(plan, "a", "next");
    plan = moveCargoCar(plan, "c", "after");
    const orders = [order({ id: "a" }), order({ id: "b", pickupLat: 52.5, pickupLng: 13.4 }), order({ id: "c" })];
    const view = buildDriverRouteView(plan, orders, "next");
    expect(view.stops.map((s) => [s.id, s.n])).toEqual([["b", 1], ["a", 2]]);
    expect(view.stops[0]!.navUrl).toBe(driverNavToUrl(52.5, 13.4));
    const blob = JSON.stringify(view);
    expect(blob).not.toContain("12490");
    expect(blob).not.toContain("Klients Anna");
    expect(view.fullNavUrl).toContain("google.com/maps/dir");
  });

  it("derīguma termiņš", () => {
    const rec = { token: "x".repeat(32), bucket: "next" as const, createdAt: "", expiresAt: "2026-10-22T00:00:00Z" };
    expect(driverLinkExpired(rec, Date.parse("2026-10-21T00:00:00Z"))).toBe(false);
    expect(driverLinkExpired(rec, Date.parse("2026-10-23T00:00:00Z"))).toBe(true);
  });
});

describe("šofera saišu krātuve", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "driver-"));
  beforeAll(() => {
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
    vi.stubEnv("VERCEL", "");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("izveido, atrod, atsauc", async () => {
    const store = await import("@/lib/iriss-logistics-driver-link-store");
    const rec = await store.createDriverLink("next");
    expect(rec.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect((await store.findDriverLink(rec.token))?.bucket).toBe("next");
    expect(await store.findDriverLink("nav-tada-saite-nav-tada-saite")).toBeNull();
    expect(await store.revokeDriverLinks("next")).toBe(1);
    expect(await store.findDriverLink(rec.token)).toBeNull();
  });
});
