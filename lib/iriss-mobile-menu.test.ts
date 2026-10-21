import { describe, expect, it } from "vitest";
import {
  cheapIrissMenuCount,
  irissMobileMenuGroups,
  irissMobileMenuItemsFor,
} from "@/lib/iriss-mobile-menu";

describe("IRISS mobile menu home", () => {
  it("shows the full menu for admin, including Pārvaldība", () => {
    const items = irissMobileMenuItemsFor([], true);
    expect(items.map((row) => row.id)).toEqual([
      "pasutijumi",
      "sludinajumi",
      "radars",
      "logistika",
      "autoparks",
      "pavadzimes",
      "vin",
      "atskaite",
      "iestatijumi",
    ]);
    expect(irissMobileMenuGroups(items)).toHaveLength(3);
  });

  it("filters staff to granted sections and treats Grāmatvede as Loģistika", () => {
    const items = irissMobileMenuItemsFor(["gramatvede", "pavadzimes"], false);
    expect(items.map((row) => row.id)).toEqual(["logistika", "autoparks", "pavadzimes"]);
    expect(items.some((row) => row.id === "iestatijumi")).toBe(false);
  });

  it("exposes only cheap badge keys", () => {
    const items = irissMobileMenuItemsFor([], true);
    expect(items.filter((row) => row.badge).map((row) => row.badge)).toEqual([
      "irissMatches",
      "irissLogistics",
      "waybills",
    ]);
    expect(cheapIrissMenuCount(items[0]!, { irissMatches: 12, irissLogistics: 3, waybills: 2 })).toBe(0);
    expect(cheapIrissMenuCount(items[1]!, { irissMatches: 12, irissLogistics: 3, waybills: 2 })).toBe(12);
    expect(cheapIrissMenuCount(items[3]!, { irissMatches: 12, irissLogistics: 3, waybills: 2 })).toBe(3);
    expect(cheapIrissMenuCount(items[5]!, { irissMatches: 12, irissLogistics: 3, waybills: 2 })).toBe(2);
  });
});
