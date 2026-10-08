import { describe, expect, it } from "vitest";
import { classifyListingDamage, highlightListingDamage, listingHasHardTechDamage } from "@/lib/iriss-listings-damage";

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

  it("does not treat letters inside another word as a hit, and spans skip the leading separator", () => {
    expect(classifyListingDamage("automotive inspection").status).toBe("none");
    const hit = classifyListingDamage(" Sichtbar: Motorschaden vorn.");
    expect(hit.cats.map((c) => c.name)).toContain("Motors");
    expect(hit.spans[0]).toMatchObject({ s: 11, e: 23 });
    expect(" Sichtbar: Motorschaden vorn.".slice(hit.spans[0]!.s, hit.spans[0]!.e)).toBe("Motorschaden");
    const html = highlightListingDamage(" Sichtbar: Motorschaden vorn.", hit.spans);
    expect(html).toContain("<mark");
    expect(html).not.toContain("> Motorschaden");
  });
});
