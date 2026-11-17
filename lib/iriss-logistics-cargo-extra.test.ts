import { describe, expect, it } from "vitest";
import {
  addCargo,
  cargoBucketLabel,
  cargoBuckets,
  cargoRoute,
  carsInCargoBucket,
  emptyCargoPlan,
  moveCargoCar,
  normalizeCargoPlan,
  removeCargo,
  renameCargo,
} from "@/lib/iriss-logistics-cargo-plan";

const AT = "2026-11-04T10:00:00.000Z";

describe("papildu kravas (neierobežotas)", () => {
  it("+ Jauna krava: Krava 3, sava krāsa, savs maršruts, secība pirms Nav kravā", () => {
    const a = addCargo(emptyCargoPlan(), "", AT);
    expect(a.id).toMatch(/^k-/);
    const b = addCargo(a.plan, "Somija", AT);
    const plan = b.plan;
    expect(cargoBucketLabel(plan, a.id!)).toBe("Krava 3");
    expect(cargoBucketLabel(plan, b.id!)).toBe("Somija");
    expect(plan.cargos[0]!.color).not.toBe(plan.cargos[1]!.color);
    expect(cargoBuckets(plan)).toEqual(["next", "after", a.id, b.id, "none"]);
    expect(cargoRoute(plan, b.id!).enabled).toBe(false);
  });

  it("auto var pārvietot uz papildu kravu un nosaukumu var mainīt", () => {
    const { plan: p0, id } = addCargo(emptyCargoPlan(), "", AT);
    let plan = moveCargoCar(p0, "car-1", id!);
    plan = renameCargo(plan, id!, "  Lietuva  ", AT);
    expect(carsInCargoBucket(plan, id!).map((c) => c.carId)).toEqual(["car-1"]);
    expect(cargoBucketLabel(plan, id!)).toBe("Lietuva");
    expect(renameCargo(plan, id!, "   ", AT)).toBe(plan);
  });

  it("dzēšot kravu, tās auto nonāk Nav kravā un maršruts pazūd", () => {
    const { plan: p0, id } = addCargo(emptyCargoPlan(), "", AT);
    const withCar = moveCargoCar(p0, "car-1", id!);
    const plan = removeCargo(withCar, id!, AT);
    expect(plan.cargos).toEqual([]);
    expect(carsInCargoBucket(plan, "none").map((c) => c.carId)).toContain("car-1");
    expect(Object.keys(plan.routes)).not.toContain(id);
  });

  it("saglabātais plāns: vecs plāns bez kravām strādā; auto nezināmā kravā -> Nav kravā", () => {
    const old = normalizeCargoPlan({ cars: [{ carId: "a", bucket: "next", sort: 0 }], updatedAt: AT });
    expect(old.cargos).toEqual([]);
    expect(carsInCargoBucket(old, "next").map((c) => c.carId)).toEqual(["a"]);
    const orphan = normalizeCargoPlan({ cars: [{ carId: "b", bucket: "k-zudusi", sort: 0 }], cargos: [], updatedAt: AT });
    expect(carsInCargoBucket(orphan, "none").map((c) => c.carId)).toEqual(["b"]);
    const { plan, id } = addCargo(emptyCargoPlan(), "Somija", AT);
    const round = normalizeCargoPlan(JSON.parse(JSON.stringify(moveCargoCar(plan, "c", id!))));
    expect(cargoBucketLabel(round, id!)).toBe("Somija");
    expect(carsInCargoBucket(round, id!).map((c) => c.carId)).toEqual(["c"]);
  });
});

describe("pārvietošana no papildu kravas", () => {
  it("«Uz ▾» no papildu kravas uz Nākošo strādā", async () => {
    const { moveCargoCarsTo } = await import("@/lib/iriss-logistics-cargo-plan");
    const { plan: p0, id } = addCargo(emptyCargoPlan(), "", AT);
    const plan = moveCargoCarsTo(moveCargoCar(p0, "x", id!), ["x"], "next", "end", AT);
    expect(carsInCargoBucket(plan, "next").map((c) => c.carId)).toEqual(["x"]);
    expect(carsInCargoBucket(plan, id!)).toEqual([]);
  });
});
