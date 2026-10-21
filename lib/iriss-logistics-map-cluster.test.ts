import { describe, expect, it } from "vitest";
import { clusterIsSameSpot, clusterPixelPoints, clusterRingGradient } from "@/lib/iriss-logistics-map-cluster";

describe("clusterPixelPoints", () => {
  it("keeps distant points apart and merges close ones", () => {
    const groups = clusterPixelPoints(
      [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 10, y: 5 },
        { id: "c", x: 200, y: 200 },
      ],
      30,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]!.members.map((m) => m.id)).toEqual(["a", "b"]);
    expect(groups[0]!.x).toBe(5);
    expect(groups[1]!.members.map((m) => m.id)).toEqual(["c"]);
  });

  it("splits a cluster when the map zooms in (bigger pixel distance)", () => {
    const zoomedOut = clusterPixelPoints([{ id: "a", x: 0, y: 0 }, { id: "b", x: 20, y: 0 }], 30);
    const zoomedIn = clusterPixelPoints([{ id: "a", x: 0, y: 0 }, { id: "b", x: 80, y: 0 }], 30);
    expect(zoomedOut).toHaveLength(1);
    expect(zoomedIn).toHaveLength(2);
  });
});

describe("clusterRingGradient", () => {
  it("uses a solid colour for one cargo and a conic split for mixed", () => {
    expect(clusterRingGradient(["#1e9e57", "#1e9e57"])).toBe("#1e9e57");
    expect(clusterRingGradient(["#1e9e57", "#5e5ce6"])).toBe("conic-gradient(#1e9e57 0.0deg 180.0deg, #5e5ce6 180.0deg 360.0deg)");
  });
});

describe("clusterIsSameSpot", () => {
  it("detects cars at the same pickup address", () => {
    expect(clusterIsSameSpot([{ lat: 51.1, lng: 7.1 }, { lat: 51.1001, lng: 7.1002 }])).toBe(true);
    expect(clusterIsSameSpot([{ lat: 51.1, lng: 7.1 }, { lat: 51.3, lng: 7.4 }])).toBe(false);
  });
});

describe("maršruts mūsu kartē", () => {
  it("keeps start, cars in cargo order and end; key changes when order changes", async () => {
    const { cargoRoutePoints, cargoRoutePointsKey, emptyCargoPlan, moveCargoCar, normalizeCargoPlan } = await import("@/lib/iriss-logistics-cargo-plan");
    let plan = emptyCargoPlan("");
    plan = moveCargoCar(plan, "a", "next");
    plan = moveCargoCar(plan, "b", "next");
    plan = { ...plan, routes: { ...plan.routes, next: { ...plan.routes.next, start: { label: "S", address: "", lat: 1, lng: 1, type: "port", templateId: "" } } } };
    const orders = [
      { id: "a", pickupLat: 2, pickupLng: 2 },
      { id: "b", pickupLat: 3, pickupLng: 3 },
    ];
    const pts = cargoRoutePoints(plan, "next", orders);
    expect(pts).toEqual([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }]);
    const swapped = cargoRoutePoints(moveCargoCar(plan, "b", "next", 0), "next", orders);
    expect(cargoRoutePointsKey(swapped)).not.toBe(cargoRoutePointsKey(pts));
    // Līnija saglabājas plānā un pārdzīvo normalizāciju.
    const saved = normalizeCargoPlan({ ...plan, routes: { ...plan.routes, next: { ...plan.routes.next, path: [{ lat: 1.123456, lng: 2 }, { lat: "x" }], pathKey: "k" } } });
    expect(saved.routes.next.path).toEqual([{ lat: 1.12346, lng: 2 }]);
    expect(saved.routes.next.pathKey).toBe("k");
  });
});
