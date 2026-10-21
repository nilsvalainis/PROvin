import { describe, expect, it } from "vitest";
import {
  CARGO_COLOR_FALLBACK,
  CARGO_CSS_VAR,
  DEFAULT_ROUTE_TEMPLATES,
  carsInCargoBucket,
  cargoClusterKey,
  emptyCargoPlan,
  endpointFromTemplate,
  ensureCargoCars,
  formatCargoDuration,
  formatCargoKm,
  formatCargoRouteCopy,
  formatLogisticsPostal,
  logisticsCarTitle,
  logisticsCopyAllCarText,
  logisticsCountryCode,
  logisticsDriverShareText,
  moveCargoCar,
  normalizeCargoPlan,
  pickupStageForCargoMove,
  setCargoShowOnMap,
} from "@/lib/iriss-logistics-cargo-plan";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

function order(partial: Partial<LogisticsOrder> = {}): LogisticsOrder {
  return {
    id: "lo-1",
    workspace: "iriss",
    source: "auction",
    auction: "Auto1",
    auctionUrl: "",
    listingUrl: "",
    listingParsed: null,
    make: "Volvo",
    model: "XC60",
    vin: "YV1UZA8VDN1234567",
    title: "Volvo XC60",
    priceEur: null,
    mileageKm: 80000,
    pickupPointId: "lp-1",
    pickupSnapshot: {
      name: "Dortmund",
      auction: "Auto1",
      street: "Industriestrasse 12",
      postcode: "44309",
      city: "Dortmund",
      country: "Vācija",
      lat: 51.5,
      lng: 7.5,
      hoursText: "",
      contactName: "",
      phone: "+491511234567",
      email: "",
      parkingRule: null,
      rules: "",
    },
    pickupRef: "PU-1",
    pickupAddress: "Industriestrasse 12, 44309 Dortmund",
    pickupLat: 51.5,
    pickupLng: 7.5,
    geocodeStatus: "ok",
    pickupDate: "2026-10-14",
    stockNo: "",
    freeParkingUntil: "",
    status: "ready",
    archived: false,
    archivedAt: "",
    previousStatus: "",
    statusNote: "",
    nextAction: "",
    sellerContact: "",
    notes: "",
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
    ...partial,
  };
}

describe("IRISS Loģistika kravu plāns", () => {
  it("keeps cargo colors as CSS variable names, not status fills", () => {
    expect(CARGO_CSS_VAR.next).toBe("--krava-next");
    expect(CARGO_CSS_VAR.after).toBe("--krava-next2");
    expect(CARGO_CSS_VAR.none).toBe("--krava-none");
    expect(CARGO_COLOR_FALLBACK.next).toBe("#1e9e57");
    expect(CARGO_COLOR_FALLBACK.after).toBe("#5e5ce6");
    expect(CARGO_COLOR_FALLBACK.none).toBe("#3a3a3c");
  });

  it("moves a car between buckets and reindexes without inventing status", () => {
    const plan = ensureCargoCars(emptyCargoPlan("t0"), ["a", "b", "c"], "t1");
    const next = moveCargoCar(plan, "b", "next", 0, "t2");
    const after = moveCargoCar(next, "c", "after", 0, "t3");
    expect(carsInCargoBucket(after, "next").map((c) => c.carId)).toEqual(["b"]);
    expect(carsInCargoBucket(after, "after").map((c) => c.carId)).toEqual(["c"]);
    expect(carsInCargoBucket(after, "none").map((c) => c.carId)).toEqual(["a"]);
    expect(pickupStageForCargoMove("next", "waiting")).toBe("planned");
    expect(pickupStageForCargoMove("none", "planned")).toBe("waiting");
    expect(pickupStageForCargoMove("next", "in_transit")).toBeNull();
    expect(pickupStageForCargoMove("none", "arrived")).toBeNull();
  });

  it("hides a car from the map with the row checkbox only", () => {
    const plan = setCargoShowOnMap(ensureCargoCars(emptyCargoPlan(), ["a"]), "a", false);
    expect(plan.cars[0]?.showOnMap).toBe(false);
  });

  it("reads legacy krava / radaKarte keys", () => {
    const plan = normalizeCargoPlan({
      cars: [{ car_id: "x", krava: "next", kravaKarta: 2, radaKarte: false }],
    });
    expect(plan.cars[0]).toMatchObject({ carId: "x", bucket: "next", sort: 0, showOnMap: false });
  });

  it("formats DE postal, driver text without passport, and route copy", () => {
    const o = order();
    expect(formatLogisticsPostal(o.pickupSnapshot)).toBe("DE-44309");
    expect(logisticsCountryCode("Deutschland")).toBe("DE");
    expect(logisticsCarTitle(o)).toBe("Volvo XC60");
    const share = logisticsDriverShareText(o);
    expect(share).toContain("VIN: YV1UZA8VDN1234567");
    expect(share).toContain("Pickup: PU-1");
    expect(share).not.toMatch(/pase|passport|personas/i);
    expect(logisticsCopyAllCarText(o, { cargoLv: "Nākošā krava", stageLv: "Ieplānots" })).toContain("Krava: Nākošā krava");
    expect(formatCargoKm(1640)).toBe("1 640 km");
    expect(formatCargoDuration(1120)).toBe("18 h 40 min");
    expect(
      formatCargoRouteCopy({
        start: { label: "Rostoka", address: "", lat: 1, lng: 2, type: "port", templateId: "t" },
        stops: [{ title: "Volvo XC60" }],
        end: endpointFromTemplate({
          ...DEFAULT_ROUTE_TEMPLATES[2]!,
          createdAt: "",
          updatedAt: "",
        }),
      }),
    ).toBe("1. Rostoka\n2. Volvo XC60\n3. Frankfurt (Oder)");
  });

  it("shortens the old default template names but keeps names the user changed", async () => {
    const { shortenLegacyRouteTemplateNames } = await import("@/lib/iriss-logistics-cargo-plan");
    const base = { address: "", lat: 1, lng: 1, type: "port" as const, createdAt: "", updatedAt: "" };
    const out = shortenLegacyRouteTemplateNames([
      { ...base, id: "tpl-stena-travemunde", name: "Stena Line osta, Travemünde" },
      { ...base, id: "tpl-de-pl-gorlitz", name: "Mana robeža" },
      { ...base, id: "tpl-x", name: "DE-PL robeža Görlitz" },
    ]);
    expect(out.changed).toBe(true);
    expect(out.items.map((t) => t.name)).toEqual(["Travemünde", "Mana robeža", "DE-PL robeža Görlitz"]);
  });

  it("clusters pins that share a place", () => {
    expect(cargoClusterKey(51.5134, 7.4653)).toBe(cargoClusterKey(51.51341, 7.46529));
    expect(DEFAULT_ROUTE_TEMPLATES).toHaveLength(3);
    expect(DEFAULT_ROUTE_TEMPLATES[0]?.name).toContain("Travemünde");
  });
});
