import { describe, expect, it } from "vitest";
import {
  applyLogisticsMapCamera,
  LOGISTICS_PRINT_MAP_HEIGHT_MM,
  LOGISTICS_PRINT_MAP_WIDTH_MM,
  LOGISTICS_PRINT_PAGE_CSS,
  logisticsOrdersForMapPrint,
  logisticsPrintLegendLeaksForbidden,
  logisticsPrintLegendRows,
  logisticsPrintNumberMap,
  logisticsPrintSheetTitle,
  readLogisticsMapCamera,
  waitForGoogleMapTilesIdle,
} from "@/lib/iriss-logistics-map-print";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

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

describe("Loģistika map print helpers", () => {
  it("prints checked points; if none checked, all visible with coords", () => {
    const a = order({ id: "a" });
    const b = order({ id: "b", pickupLat: null, pickupLng: null });
    const c = order({ id: "c" });
    expect(logisticsOrdersForMapPrint([a, b, c], new Set(["a", "b", "missing"])).map((o) => o.id)).toEqual(["a"]);
    expect(logisticsOrdersForMapPrint([a, b, c], new Set()).map((o) => o.id)).toEqual(["a", "c"]);
  });

  it("uses A4 landscape with 10 mm margin and a dated sheet title", () => {
    expect(LOGISTICS_PRINT_MAP_WIDTH_MM).toBe(277);
    expect(LOGISTICS_PRINT_MAP_HEIGHT_MM).toBe(170);
    expect(logisticsPrintNumberMap([order({ id: "a" }), order({ id: "b" })]).get("b")).toBe(2);
    expect(LOGISTICS_PRINT_PAGE_CSS).toContain("A4 landscape");
    expect(LOGISTICS_PRINT_PAGE_CSS).toContain("margin: 10mm");
    const sheet = logisticsPrintSheetTitle(new Date(2026, 9, 20, 16, 52), 3);
    expect(sheet.heading).toBe("IRISS · Loģistika - karte");
    expect(sheet.meta).toContain("20.10.2026 16:52");
    expect(sheet.meta).toContain("3 atzīmēti punkti");
    expect(sheet.heading).not.toMatch(/\u2014/);
  });

  it("legend is make/model · auction plus place/hours, never price or client", () => {
    const src = [order()];
    const rows = logisticsPrintLegendRows(src);
    expect(rows).toEqual([
      {
        id: "lo-1",
        n: 1,
        label: "VW Passat · Openlane",
        place: "Musterstraße 1, 28000 Bremen, DE",
        hours: "P-Pk 7:00-15:30",
      },
    ]);
    expect(logisticsPrintLegendLeaksForbidden(rows, src)).toBe(false);
    const blob = JSON.stringify(rows);
    expect(blob).not.toContain("12490");
    expect(blob).not.toContain("Anna");
    expect(blob).not.toContain("+371");
    expect(blob).not.toContain("€");
    expect(blob).not.toMatch(/price/i);
    expect(blob).not.toMatch(/klient/i);
  });

  it("reads and restores zoom/center", () => {
    const state = { lat: 51.2, lng: 9.5, zoom: 7 };
    const map = {
      getCenter: () => ({
        lat: () => state.lat,
        lng: () => state.lng,
      }),
      getZoom: () => state.zoom,
      setCenter: (pos: { lat: number; lng: number }) => {
        state.lat = pos.lat;
        state.lng = pos.lng;
      },
      setZoom: (z: number) => {
        state.zoom = z;
      },
    };
    expect(readLogisticsMapCamera(map)).toEqual({ lat: 51.2, lng: 9.5, zoom: 7 });
    applyLogisticsMapCamera(map, { lat: 53.08, lng: 8.8, zoom: 10 });
    expect(readLogisticsMapCamera(map)).toEqual({ lat: 53.08, lng: 8.8, zoom: 10 });
  });

  it("waits for idle then tilesloaded before resolving", async () => {
    const handlers: Record<string, () => void> = {};
    const pending = waitForGoogleMapTilesIdle((event, fn) => {
      handlers[event] = fn;
    }, { timeoutMs: 2000, afterIdleMs: 30 });
    expect(handlers.idle).toBeTypeOf("function");
    handlers.idle!();
    expect(handlers.tilesloaded).toBeTypeOf("function");
    handlers.tilesloaded!();
    await pending;
  });

  it("resolves after idle if tilesloaded does not fire", async () => {
    const handlers: Record<string, () => void> = {};
    const pending = waitForGoogleMapTilesIdle((event, fn) => {
      handlers[event] = fn;
    }, { timeoutMs: 2000, afterIdleMs: 5 });
    handlers.idle!();
    await pending;
  });
});
