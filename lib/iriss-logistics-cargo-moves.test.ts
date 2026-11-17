import { describe, expect, it } from "vitest";
import { carsInCargoBucket, emptyCargoPlan, moveCargoCar, moveCargoCarBy, moveCargoCarsTo, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";

const AT = "2026-11-02T10:00:00.000Z";

function plan(): CargoPlanState {
  let p = emptyCargoPlan(AT);
  for (const id of ["a", "b", "c", "d"]) p = moveCargoCar(p, id, "next", undefined, AT);
  for (const id of ["e", "f"]) p = moveCargoCar(p, id, "after", undefined, AT);
  p = moveCargoCar(p, "g", "none", undefined, AT);
  return p;
}
const ids = (p: CargoPlanState, b: "next" | "after" | "none") => carsInCargoBucket(p, b).map((c) => c.carId);

describe("Nils 02.11: LogKravas - pārvietošana bez vilkšanas", () => {
  it("↑ ↓ par vienu vietu savā kravā; malā nekas nemainās", () => {
    const p = plan();
    expect(ids(moveCargoCarBy(p, "c", -1, AT), "next")).toEqual(["a", "c", "b", "d"]);
    expect(ids(moveCargoCarBy(p, "b", 1, AT), "next")).toEqual(["a", "c", "b", "d"]);
    expect(moveCargoCarBy(p, "a", -1, AT)).toBe(p);
    expect(moveCargoCarBy(p, "d", 1, AT)).toBe(p);
    expect(ids(moveCargoCarBy(p, "f", -1, AT), "after")).toEqual(["f", "e"]);
  });

  it("«Uz ▾»: uz citu kravu sākumā vai beigās, vai savas kravas sākumā", () => {
    const p = plan();
    expect(ids(moveCargoCarsTo(p, ["g"], "next", "start", AT), "next")).toEqual(["g", "a", "b", "c", "d"]);
    const q = moveCargoCarsTo(p, ["b"], "after", "end", AT);
    expect(ids(q, "after")).toEqual(["e", "f", "b"]);
    expect(ids(q, "next")).toEqual(["a", "c", "d"]);
    expect(ids(moveCargoCarsTo(p, ["d"], "next", "start", AT), "next")).toEqual(["d", "a", "b", "c"]);
  });

  it("Atzīmēti vairāki - visi uzreiz, secība kā sarakstā", () => {
    const p = plan();
    const q = moveCargoCarsTo(p, ["f", "c", "a"], "none", "end", AT);
    expect(ids(q, "none")).toEqual(["g", "a", "c", "f"]);
    expect(ids(q, "next")).toEqual(["b", "d"]);
    expect(ids(q, "after")).toEqual(["e"]);
    expect(q.cars).toHaveLength(p.cars.length);
  });
});
