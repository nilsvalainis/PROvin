import { describe, expect, it } from "vitest";
import {
  emptyIrissListingsOperatorState,
  filterRejectedVehicles,
  mergeMigratedClientIds,
  operatorRejectedIds,
  withFavorite,
  withRejected,
} from "@/lib/iriss-listings-operator-state";

describe("iriss listings operator state", () => {
  it("merges localStorage fav/hidden once and keeps reject permanent until undo", () => {
    const at = "2026-10-09T10:00:00.000Z";
    const merged = mergeMigratedClientIds(emptyIrissListingsOperatorState(), {
      fav: ["a", "a", "b"],
      hidden: ["c", "a"],
      at,
    });
    expect(merged.fav.sort()).toEqual(["a", "b"]);
    expect(operatorRejectedIds(merged)).toEqual(new Set(["c", "a"]));
    const undone = withRejected(merged, "c", false, at, null);
    expect(operatorRejectedIds(undone).has("c")).toBe(false);
    expect(operatorRejectedIds(undone).has("a")).toBe(true);
  });

  it("toggles favorites without touching rejected", () => {
    let s = withFavorite(emptyIrissListingsOperatorState(), "x", true);
    s = withFavorite(s, "x", true);
    expect(s.fav).toEqual(["x"]);
    s = withFavorite(s, "x", false);
    expect(s.fav).toEqual([]);
  });

  it("filters rejected vehicles out of an import list", () => {
    const kept = filterRejectedVehicles([{ id: "a" }, { id: "b" }], new Set(["b"]));
    expect(kept.map((v) => v.id)).toEqual(["a"]);
  });
});
