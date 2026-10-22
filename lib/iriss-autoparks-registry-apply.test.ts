import { describe, expect, it } from "vitest";
import { normalizeAutoparksState, type AutoparksCar, type AutoparksState } from "@/lib/iriss-autoparks";
import { listAcceptedForTradeVehicles } from "@/lib/iriss-autoparks-accepted";
import { applyManualRegistryPatch, emptyAutoparksRegistry, parseRegistryFile, REGISTRY_SCHEMA_ID, type RegistryFile } from "@/lib/iriss-autoparks-registry";
import { applyRegistryFileToState, REGISTRY_REMOVED_STATUS } from "@/lib/iriss-autoparks-registry-apply";
import { isOlderRegistry } from "@/lib/iriss-autoparks-registry-dropbox";
import { verifyCsddRegistrsToken } from "@/lib/iriss-csdd-registrs-token";

const NOW = "2026-10-23T00:30:00.000Z";

function car(id: string, vin: string, extra: Partial<AutoparksCar> = {}): AutoparksCar {
  return {
    id,
    orderId: "",
    vin,
    make: "BMW",
    model: "330",
    year: "2019",
    plate: "",
    color: "",
    mileageKm: 100000,
    status: "for_sale",
    statusChangedAt: "2026-10-01T00:00:00.000Z",
    location: "",
    purchasePriceEur: 9000,
    salePriceEur: 14500,
    arrivedAt: "2026-10-01",
    archivedAt: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    displayName: "BMW 330i xDrive",
    listPriceEur: 14900,
    ...extra,
  };
}

function accepted(act: string, extra: Partial<AutoparksCar["registry"]> = {}) {
  return { ...emptyAutoparksRegistry(), tradeActNo: act, tradeActDate: "2026-10-01", status: "Tirdzniecībā", importedAt: "x", ...extra };
}

function state(cars: AutoparksCar[]): AutoparksState {
  return { ...normalizeAutoparksState({ version: 1 }), cars };
}

function file(vehicles: unknown[], snapshot?: unknown): RegistryFile {
  const r = parseRegistryFile({ schema: REGISTRY_SCHEMA_ID, generatedAt: "2026-10-23", vehicles, ...(snapshot ? { snapshot } : {}) });
  if (!r.ok) throw new Error(r.error);
  return r.file;
}

const FULL = { complete: true, owners: ["IRISS", "DZA"] };
const V1 = "WBA00000000000001";
const V2 = "WBA00000000000002";
const V3 = "WBA00000000000003";
const V4 = "WBA00000000000004";

describe("CSDD reģistra pilnais nolasījums (snapshot)", () => {
  it("parses optional owner and snapshot; old v1 files stay without them", () => {
    const f = file([{ vin: V1, owner: "dza" }, { vin: V2, owner: "kāds cits" }], FULL);
    expect(f.snapshot).toEqual({ complete: true, owners: ["IRISS", "DZA"] });
    expect(f.vehicles[0]!.owner).toBe("DZA");
    expect(f.vehicles[1]!.owner).toBeUndefined();
    expect(file([{ vin: V1 }]).snapshot).toBeUndefined();
    expect(file([{ vin: V1 }], { complete: false, owners: ["IRISS"] }).snapshot).toBeUndefined();
  });

  it("adds newly accepted cars with owner and registry fields, never manual fields", () => {
    const s = state([]);
    const { result } = applyRegistryFileToState(
      s,
      file([{ vin: V1, owner: "DZA", makeModel: "AUDI A4 AVANT", firstRegistrationDate: "2018-05-14", odometerKm: 123456, tradeAct: { number: "TA-7", date: "2026-10-20" }, status: "Tirdzniecībā" }], FULL),
      "registrs-auto.json",
      NOW,
    );
    expect(result.added).toBe(1);
    const c = s.cars[0]!;
    expect(c).toMatchObject({ vin: V1, owner: "DZA", make: "AUDI", model: "A4 AVANT", year: "2018", mileageKm: 123456, status: "prep_waiting", arrivedAt: "2026-10-20" });
    expect(c.purchasePriceEur).toBeNull();
    expect(c.listPriceEur).toBeUndefined();
    expect(c.registry?.tradeActNo).toBe("TA-7");
    expect(listAcceptedForTradeVehicles(s.cars).map((v) => v.vin)).toEqual([V1]);
  });

  it("does not add cars from a manual (non-snapshot) file or with status sold", () => {
    const s = state([]);
    const r1 = applyRegistryFileToState(s, file([{ vin: V1, tradeAct: { number: "TA-1" } }]), "rokas.json", NOW);
    expect(r1.result.added).toBe(0);
    expect(r1.result.unmatched).toEqual([V1]);
    const r2 = applyRegistryFileToState(s, file([{ vin: V2, status: "Pārdots", tradeAct: { number: "TA-2" } }], FULL), "auto.json", NOW);
    expect(r2.result.added).toBe(0);
    expect(s.cars).toHaveLength(0);
  });

  it("marks accepted cars missing from the snapshot as removed, keeping status, prices and notes", () => {
    const s = state([
      car("a", V1, { registry: accepted("TA-1") }),
      car("b", V2, { registry: accepted("TA-2") }),
      car("c", V3, { registry: accepted("TA-3") }),
      car("d", V4, { registry: accepted("TA-4") }),
    ]);
    const { result } = applyRegistryFileToState(s, file([{ vin: V1 }, { vin: V2 }, { vin: V3 }], FULL), "auto.json", NOW);
    expect(result.removed).toBe(1);
    const d = s.cars.find((c) => c.id === "d")!;
    expect(d.registry?.removedAt).toBe(NOW);
    expect(d.registry?.status).toBe(REGISTRY_REMOVED_STATUS);
    expect(d).toMatchObject({ status: "for_sale", salePriceEur: 14500, listPriceEur: 14900, displayName: "BMW 330i xDrive" });
    expect(listAcceptedForTradeVehicles(s.cars).map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("treats explicit sold status as not in trade, and a return clears removedAt", () => {
    const s = state([car("a", V1, { registry: accepted("TA-1") })]);
    const r1 = applyRegistryFileToState(s, file([{ vin: V1, status: "Pārdots" }], FULL), "auto.json", NOW);
    expect(r1.result).toMatchObject({ removed: 1, statusChanged: 1 });
    expect(listAcceptedForTradeVehicles(s.cars)).toEqual([]);
    const r2 = applyRegistryFileToState(s, file([{ vin: V1, status: "Tirdzniecībā" }], FULL), "auto.json", NOW);
    expect(r2.result.returned).toBe(1);
    expect(s.cars[0]!.registry?.removedAt).toBe("");
    expect(listAcceptedForTradeVehicles(s.cars)).toHaveLength(1);
  });

  it("guard: does not mass-remove when most cars vanish (likely a read failure) or an owner has no rows", () => {
    const cars = [V1, V2, V3, V4].map((v, i) => car(`c${i}`, v, { registry: accepted(`TA-${i}`) }));
    const s = state(cars);
    const { result } = applyRegistryFileToState(s, file([{ vin: V1 }], FULL), "auto.json", NOW);
    expect(result.removed).toBe(0);
    expect(result.removalGuarded).toEqual(["IRISS"]);
    const s2 = state([car("z", V1, { owner: "DZA", registry: accepted("TA-9") })]);
    const r2 = applyRegistryFileToState(s2, file([{ vin: V2, owner: "IRISS" }], FULL), "auto.json", NOW);
    expect(r2.result.removed).toBe(0);
    expect(r2.result.removalGuarded).toEqual(["DZA"]);
  });

  it("only snapshot owners are affected; manual files never remove", () => {
    const s = state([car("a", V1, { owner: "DZA", registry: accepted("TA-1") }), car("b", V2, { registry: accepted("TA-2") })]);
    applyRegistryFileToState(s, file([{ vin: V3, owner: "IRISS" }, { vin: V2 }], { complete: true, owners: ["IRISS"] }), "auto.json", NOW);
    expect(s.cars.find((c) => c.id === "a")!.registry?.removedAt).toBe("");
    const r = applyRegistryFileToState(s, file([]), "rokas.json", NOW);
    expect(r.result.removed).toBe(0);
  });

  it("updates act number but never a manually corrected field; archive untouched", () => {
    const manualReg = applyManualRegistryPatch(accepted("TA-1"), { fuel: "Benzīns" });
    const s = state([car("a", V1, { registry: manualReg }), car("old", V2, { archivedAt: "2026-09-01", registry: accepted("TA-OLD") })]);
    const { result } = applyRegistryFileToState(s, file([{ vin: V1, fuel: "Dīzelis", tradeAct: { number: "TA-1B", date: "2026-10-22" } }, { vin: V2, tradeAct: { number: "TA-NEW" } }], FULL), "auto.json", NOW);
    expect(result.actUpdated).toBe(1);
    expect(result.archivedOnly).toBe(1);
    expect(result.added).toBe(0);
    const a = s.cars.find((c) => c.id === "a")!;
    expect(a.registry?.tradeActNo).toBe("TA-1B");
    expect(a.registry?.fuel).toBe("Benzīns");
    expect(s.cars.find((c) => c.id === "old")!.registry?.tradeActNo).toBe("TA-OLD");
    expect(s.events.some((e) => e.carId === "a" && e.text.includes("TA-1 -> TA-1B"))).toBe(true);
  });

  it("unchanged snapshot reports no change (idempotent)", () => {
    const s = state([]);
    const f = file([{ vin: V1, makeModel: "AUDI A4", tradeAct: { number: "TA-1" } }], FULL);
    applyRegistryFileToState(s, f, "auto.json", NOW);
    const again = applyRegistryFileToState(s, f, "auto.json", NOW);
    expect(again.changed).toBe(false);
    expect(s.cars).toHaveLength(1);
  });
});

describe("listAcceptedForTradeVehicles", () => {
  it("keeps only currently accepted, not sold, not archived; no prices; owner filter", () => {
    const cars = [
      car("ok", V1, { registry: accepted("TA-1") }),
      car("dza", V2, { owner: "DZA", make: "", model: "", registry: accepted("TA-2", { makeModel: "VW GOLF" }) }),
      car("noact", V3, { registry: accepted("") }),
      car("sold", V4, { status: "sold", registry: accepted("TA-4") }),
      car("arch", "WBA00000000000005", { archivedAt: "2026-10-01", registry: accepted("TA-5") }),
      car("removed", "WBA00000000000006", { registry: accepted("TA-6", { removedAt: NOW }) }),
      car("regsold", "WBA00000000000007", { registry: accepted("TA-7", { status: "Pārdots" }) }),
    ];
    const all = listAcceptedForTradeVehicles(cars);
    expect(all.map((v) => v.id)).toEqual(["ok", "dza"]);
    expect(all[1]).toMatchObject({ owner: "DZA", brandModel: "VW GOLF", tradeActNo: "TA-2" });
    expect(Object.keys(all[0]!)).not.toContain("salePriceEur");
    expect(listAcceptedForTradeVehicles(cars, { owner: "DZA" }).map((v) => v.id)).toEqual(["dza"]);
  });
});

describe("importa palīgi", () => {
  it("isOlderRegistry compares dates; unknown is never older", () => {
    expect(isOlderRegistry("2026-10-20", "2026-10-23")).toBe(true);
    expect(isOlderRegistry("2026-10-23", "2026-10-23")).toBe(false);
    expect(isOlderRegistry("", "2026-10-23")).toBe(false);
    expect(isOlderRegistry("2026-10-20", undefined)).toBe(false);
  });

  it("verifyCsddRegistrsToken needs a configured 16+ char secret", () => {
    const env = { IRISS_CSDD_REGISTRS_TOKEN: "registrs-test-token-16" };
    expect(verifyCsddRegistrsToken("Bearer registrs-test-token-16", env)).toBe(true);
    expect(verifyCsddRegistrsToken("Bearer wrong", env)).toBe(false);
    expect(verifyCsddRegistrsToken(null, env)).toBe(false);
    expect(verifyCsddRegistrsToken("Bearer short", { IRISS_CSDD_REGISTRS_TOKEN: "short" })).toBe(false);
  });
});
