import { describe, expect, it } from "vitest";
import { offerAprakstiSeedFromAuto1 } from "@/lib/iriss-offer-apraksti-seed";

describe("offerAprakstiSeedFromAuto1", () => {
  it("returns nothing when there is no service data at all", () => {
    expect(offerAprakstiSeedFromAuto1({})).toEqual({});
  });

  it("marks damage grade clean when all recorded problems were fixed", () => {
    const seed = offerAprakstiSeedFromAuto1({
      problems: [{ text: "Bremžu klucīši nodilti", fixedByService: true }],
    });
    expect(seed.damageGrade).toBe("Bez atklātām problēmām - servisā novērsts");
    expect(seed.technicalAssessment).toBeUndefined();
  });

  it("lists still-open problems in damageGrade and technicalAssessment", () => {
    const seed = offerAprakstiSeedFromAuto1({
      problems: [
        { text: "Motora kontrollampa deg", fixedByService: false },
        { text: "Amortizatoru noplūde", fixedByService: true },
      ],
    });
    expect(seed.damageGrade).toContain("Zināmas problēmas (1)");
    expect(seed.damageGrade).toContain("Motora kontrollampa deg");
    expect(seed.technicalAssessment).toContain("Motora kontrollampa deg");
    expect(seed.technicalAssessment).not.toContain("Amortizatoru");
  });

  it("extracts key count from notes when mentioned", () => {
    const seed = offerAprakstiSeedFromAuto1({ notes: "Nodotas 2 atslēgas pie saņemšanas." });
    expect(seed.keyCount).toBe("2");
  });

  it("leaves key count unset when not mentioned", () => {
    const seed = offerAprakstiSeedFromAuto1({ notes: "Viss kārtībā." });
    expect(seed.keyCount).toBeUndefined();
  });

  it("sets hasNoRustBody false when rust is mentioned", () => {
    const seed = offerAprakstiSeedFromAuto1({
      problems: [{ text: "Sliekšņi sākuši rūsēt", fixedByService: false }],
    });
    expect(seed.hasNoRustBody).toBe(false);
  });

  it("sets hasNoRustBody true when there is service data and no rust mentioned", () => {
    const seed = offerAprakstiSeedFromAuto1({ notes: "Nomainīti eļļas filtri." });
    expect(seed.hasNoRustBody).toBe(true);
  });

  it("sets hasFactoryPaint false when a repaint is mentioned", () => {
    const seed = offerAprakstiSeedFromAuto1({
      problems: [{ text: "Priekšējais spārns pārkrāsots", fixedByService: true }],
    });
    expect(seed.hasFactoryPaint).toBe(false);
  });

  it("sets hasFullServiceHistory true only when there are invoices", () => {
    expect(offerAprakstiSeedFromAuto1({ invoiceCount: 2 }).hasFullServiceHistory).toBe(true);
    expect(offerAprakstiSeedFromAuto1({ invoiceCount: 0 }).hasFullServiceHistory).toBeUndefined();
  });

  it("builds a short summary combining invoices, fixed/open problems and equipment", () => {
    const seed = offerAprakstiSeedFromAuto1({
      problems: [
        { text: "Bremžu klucīši nodilti", fixedByService: true },
        { text: "Motora kontrollampa deg", fixedByService: false },
      ],
      invoiceCount: 1,
      equipmentLine: "ACC, Lane Assist",
    });
    expect(seed.summary).toContain("1 rēķins");
    expect(seed.summary).toContain("1 problēma novērsta");
    expect(seed.summary).toContain("1 zināma problēma vēl atklāta");
    expect(seed.summary).toContain("ACC, Lane Assist");
  });
});
