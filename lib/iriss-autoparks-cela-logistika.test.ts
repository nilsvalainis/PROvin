import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autoparksSyncForLogisticsAction,
  carIdsWithActiveLogistics,
  findActiveOrderForVin,
  findAutoparksCarForOrder,
  isTransitWithoutLogistics,
} from "@/lib/iriss-autoparks-transit";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";

vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => null,
}));

const VIN_A = "WVWZZZ3CZKE012345";
const VIN_B = "WAUZZZ4G6JN445566";
const order = (id: string, vin: string, archived = false) => ({ id, vin, archived, status: archived ? ("delivered" as const) : ("ready" as const) });
const car = (id: string, status: string, extra: Partial<{ orderId: string; vin: string; archivedAt: string }> = {}) => ({
  id,
  status,
  orderId: extra.orderId ?? "",
  vin: extra.vin ?? "",
  archivedAt: extra.archivedAt ?? "",
});

describe("P2: «Ceļā» tikai ar aktīvu Loģistikas ierakstu", () => {
  it("aktīvs ieraksts pēc orderId vai VIN; arhivēts neskaitās", () => {
    const cars = [car("c1", "in_transit", { orderId: "o1" }), car("c2", "in_transit", { vin: VIN_B }), car("c3", "in_transit", { orderId: "o3" })];
    const ids = carIdsWithActiveLogistics(cars, [order("o1", ""), order("o2", VIN_B.toLowerCase()), order("o3", "", true)], isLogisticsOrderActive);
    expect([...ids].sort()).toEqual(["c1", "c2"]);
    expect(isTransitWithoutLogistics(cars[2]!, ids)).toBe(true);
    expect(isTransitWithoutLogistics(cars[0]!, ids)).toBe(false);
  });

  it("brīdinājums tikai «Ceļā» statusam un ne arhīvā", () => {
    const none = new Set<string>();
    expect(isTransitWithoutLogistics(car("x", "prep_waiting"), none)).toBe(false);
    expect(isTransitWithoutLogistics(car("x", "in_transit", { archivedAt: "2026-11-01" }), none)).toBe(false);
  });

  it("īss VIN (<11) nesaista", () => {
    expect(carIdsWithActiveLogistics([car("c", "in_transit", { vin: "ABC" })], [order("o", "ABC")], isLogisticsOrderActive).size).toBe(0);
    expect(findActiveOrderForVin([order("o", "ABC")], "ABC", isLogisticsOrderActive)).toBeUndefined();
    expect(findActiveOrderForVin([order("o", VIN_A, true), order("p", VIN_A)], VIN_A, isLogisticsOrderActive)?.id).toBe("p");
  });

  it("saistītais auto: vispirms orderId, tad VIN; arhīva auto izlaiž", () => {
    const cars = [car("byvin", "in_transit", { vin: VIN_A }), car("byid", "in_transit", { orderId: "o1" }), car("old", "in_transit", { orderId: "o2", archivedAt: "x" })];
    expect(findAutoparksCarForOrder(cars, { id: "o1", vin: VIN_A })?.id).toBe("byid");
    expect(findAutoparksCarForOrder(cars, { id: "o9", vin: VIN_A })?.id).toBe("byvin");
    expect(findAutoparksCarForOrder(cars, { id: "o2", vin: "" })).toBeUndefined();
  });

  it("darbību noteikumi: delivered/archive -> Noliktavā, other_company statusu nemaina, citus statusus neaiztiek", () => {
    expect(autoparksSyncForLogisticsAction({ status: "in_transit" }, "delivered")).toMatchObject({ status: "prep_waiting", setArrived: true });
    expect(autoparksSyncForLogisticsAction({ status: "in_transit" }, "archive")).toMatchObject({ status: "prep_waiting", setArrived: false });
    expect(autoparksSyncForLogisticsAction({ status: "in_transit" }, "other_company")).toMatchObject({ status: null });
    expect(autoparksSyncForLogisticsAction({ status: "in_service" }, "delivered")).toBeNull();
  });
});

describe("P2: krātuve (sinhronizācija un admina pārcelšana)", () => {
  const actor = { id: "u1", name: "Tests" };
  let dir = "";
  async function loadStore() {
    vi.resetModules();
    return import("@/lib/iriss-autoparks-store");
  }
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-p2-"));
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
    vi.stubEnv("VERCEL", "");
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("delivered: Ceļā -> Noliktavā + atvešanas datums; nekas netiek dzēsts", async () => {
    const store = await loadStore();
    const c = await store.createAutoparksCar({ make: "VW", vin: VIN_A, status: "in_transit", orderId: "o1" }, actor);
    const out = await store.syncAutoparksCarWithLogisticsAction({ id: "o1", vin: "" }, "delivered", actor, new Date("2026-11-20T10:00:00Z"));
    expect(out).toMatchObject({ id: c.id, status: "prep_waiting", arrivedAt: "2026-11-20" });
    const state = await store.readAutoparksState();
    expect(state.cars).toHaveLength(1);
  });

  it("archive: Noliktavā bez atvešanas datuma; other_company: statuss nemainās", async () => {
    const store = await loadStore();
    await store.createAutoparksCar({ make: "VW", vin: VIN_A, status: "in_transit" }, actor);
    await store.createAutoparksCar({ make: "Audi", vin: VIN_B, status: "in_transit" }, actor);
    const a = await store.syncAutoparksCarWithLogisticsAction({ id: "oa", vin: VIN_A }, "archive", actor);
    expect(a).toMatchObject({ status: "prep_waiting", arrivedAt: "" });
    const b = await store.syncAutoparksCarWithLogisticsAction({ id: "ob", vin: VIN_B }, "other_company", actor);
    expect(b).toMatchObject({ status: "in_transit" });
    const none = await store.syncAutoparksCarWithLogisticsAction({ id: "oz", vin: "" }, "delivered", actor);
    expect(none).toBeNull();
  });

  it("admina pārcelšana: tikai serverī pārbaudītie un «Ceļā» auto", async () => {
    const store = await loadStore();
    const a = await store.createAutoparksCar({ make: "VW", vin: VIN_A, status: "in_transit" }, actor);
    const b = await store.createAutoparksCar({ make: "Audi", vin: VIN_B, status: "in_transit" }, actor);
    const c = await store.createAutoparksCar({ make: "BMW", status: "in_service" }, actor);
    const moved = await store.moveTransitCarsToStock([a.id, b.id, c.id, "nav"], new Set([a.id, c.id]), actor);
    expect(moved).toEqual([a.id]);
    const state = await store.readAutoparksState();
    expect(state.cars.find((x) => x.id === a.id)?.status).toBe("prep_waiting");
    expect(state.cars.find((x) => x.id === b.id)?.status).toBe("in_transit");
    expect(state.cars.find((x) => x.id === c.id)?.status).toBe("in_service");
  });
});
