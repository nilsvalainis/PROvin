import { describe, expect, it } from "vitest";
import {
  cheapIrissMenuCount,
  irissMobileMenuGroups,
  irissMobileMenuItemsFor,
} from "@/lib/iriss-mobile-menu";

describe("IRISS mobile menu home", () => {
  it("admin redz visu izvēlni ar Iestatījumiem, bez Mēneša atskaites", () => {
    const items = irissMobileMenuItemsFor([], true);
    expect(items.map((row) => row.id)).toEqual([
      "pasutijumi",
      "sludinajumi",
      "radars",
      "logistika",
      "autoparks",
      "pavadzimes",
      "vin",
      "iestatijumi",
    ]);
    expect(items.find((row) => row.id === "iestatijumi")?.label).toBe("Iestatījumi");
    expect(irissMobileMenuGroups(items)).toHaveLength(3);
  });

  it("filters staff to granted sections and treats Grāmatvede as Loģistika", () => {
    const items = irissMobileMenuItemsFor(["gramatvede", "pavadzimes"], false);
    expect(items.map((row) => row.id)).toEqual(["logistika", "autoparks", "pavadzimes"]);
    expect(items.some((row) => row.id === "iestatijumi")).toBe(false);
  });

  it("Sludinājumiem un Loģistikai skaitļa nav (Nils 26.10), Pavadzīmēm paliek", () => {
    const items = irissMobileMenuItemsFor([], true);
    expect(items.filter((row) => row.badge).map((row) => row.badge)).toEqual(["waybills"]);
    const counts = { irissMatches: 120, irissLogistics: 3, waybills: 2 };
    expect(cheapIrissMenuCount(items.find((r) => r.id === "sludinajumi")!, counts)).toBe(0);
    expect(cheapIrissMenuCount(items.find((r) => r.id === "logistika")!, counts)).toBe(0);
    expect(cheapIrissMenuCount(items.find((r) => r.id === "pavadzimes")!, counts)).toBe(2);
  });
});
