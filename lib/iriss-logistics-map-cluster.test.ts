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

describe("layoutMapPins", () => {
  it("never merges route stops into a count and spreads stops at the same address", async () => {
    const { layoutMapPins, PIN_SPREAD_PX } = await import("@/lib/iriss-logistics-map-cluster");
    const out = layoutMapPins([
      { id: "a", x: 100, y: 100, lat: 50.9, lng: 5.5, routeNumber: 5 },
      { id: "b", x: 100, y: 100, lat: 50.9, lng: 5.5, routeNumber: 2 },
      { id: "c", x: 110, y: 104, lat: 51.0, lng: 5.6, routeNumber: 3 },
      { id: "d", x: 300, y: 300, lat: 52, lng: 7 },
      { id: "e", x: 305, y: 302, lat: 52.01, lng: 7.01 },
    ]);
    const stops = out.filter((p) => p.kind === "stop");
    expect(stops).toHaveLength(3);
    const same = stops.filter((p) => p.kind === "stop" && p.anchorX === 100 && p.dx !== 0);
    expect(same.map((p) => (p.kind === "stop" ? p.point.routeNumber : 0))).toEqual([2, 5]);
    expect(Math.abs((same[1] as { dx: number }).dx - (same[0] as { dx: number }).dx)).toBe(PIN_SPREAD_PX);
    const group = out.find((p) => p.kind === "group");
    expect(group && group.kind === "group" ? group.members.map((m) => m.id) : []).toEqual(["d", "e"]);
  });
});

describe("maršruta līnijas retināšana", () => {
  it("thins a long path evenly and keeps the start and the end", async () => {
    const { normalizeCargoPath, CARGO_PATH_MAX_POINTS } = await import("@/lib/iriss-logistics-cargo-plan");
    const raw = Array.from({ length: 9001 }, (_, i) => ({ lat: 50 + i / 10000, lng: 10 }));
    const out = normalizeCargoPath(raw);
    expect(out).toHaveLength(CARGO_PATH_MAX_POINTS);
    expect(out[0]).toEqual({ lat: 50, lng: 10 });
    expect(out[out.length - 1]).toEqual({ lat: 50.9, lng: 10 });
  });
});
