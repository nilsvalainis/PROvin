import { describe, expect, it } from "vitest";
import { classifyListingDamage, listingHasHardTechDamage } from "@/lib/iriss-listings-damage";

describe("classifyListingDamage", () => {
  it("empty is nodata; cosmetic without tech words is none", () => {
    expect(classifyListingDamage("").status).toBe("nodata");
    expect(classifyListingDamage("Steinschläge Motorhaube, Kratzer Tür. Keine technischen Mängel bekannt, kein Ölverlust.").status).toBe("none");
  });

  it("finds engine, gearbox and not-driveable across languages", () => {
    const nl = classifyListingDamage("Storingslampje motor brandt. Olielek bij de versnellingsbak.");
    expect(nl.cats.map((c) => c.name)).toEqual(expect.arrayContaining(["Motors", "Ātrumkārba", "Elektronika/kļūdu lampiņas", "Dzesēšana/noplūdes"]));
    const en = classifyListingDamage("Not driveable. Engine noise, gearbox slipping.");
    expect(listingHasHardTechDamage(en.cats.length ? "Not driveable. Engine noise, gearbox slipping." : "")).toBe(true);
    expect(en.cats.map((c) => c.name)).toEqual(expect.arrayContaining(["Motors", "Ātrumkārba", "Nav braucams"]));
    expect(listingHasHardTechDamage("Leichte Kratzer.")).toBe(false);
  });
});
