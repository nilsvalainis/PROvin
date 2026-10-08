import { describe, expect, it } from "vitest";
import {
  isVolkswagenBrand,
  isVwGroupBrand,
  sunroofInspectionFlagLine,
  textIndicatesSunroof,
} from "@/lib/sunroof-equipment";

describe("textIndicatesSunroof", () => {
  it("detects Latvian, German and English sunroof wording", () => {
    expect(textIndicatesSunroof("Panorāmas lūka")).toBe(true);
    expect(textIndicatesSunroof("Jumta lūka, elektriska")).toBe(true);
    expect(textIndicatesSunroof("Schiebedach")).toBe(true);
    expect(textIndicatesSunroof("Panoramadach")).toBe(true);
    expect(textIndicatesSunroof("Glass roof")).toBe(true);
    expect(textIndicatesSunroof("Panoramic sunroof")).toBe(true);
  });

  it("ignores roof rails, visors and panoramic cameras", () => {
    expect(textIndicatesSunroof("Jumta relingi")).toBe(false);
    expect(textIndicatesSunroof("Dachreling")).toBe(false);
    expect(textIndicatesSunroof("Saulessargi")).toBe(false);
    expect(textIndicatesSunroof("Panorāmas kamera")).toBe(false);
  });
});

describe("sunroofInspectionFlagLine", () => {
  it("marks clogged drains as typical on Volkswagen", () => {
    const line = sunroofInspectionFlagLine({
      evidence: "Panoramadach",
      makeModel: "VW Passat",
      makeTokens: ["VW", "VOLKSWAGEN"],
    });
    expect(line).toMatch(/LŪKA \/ PANORĀMAS LŪKA/);
    expect(line).toMatch(/grīdas paklāji/);
    expect(line).toMatch(/drenāžas/);
    expect(line).toMatch(/īpaši Volkswagen/);
  });

  it("uses VW-group wording for Audi and a generic check for other brands", () => {
    expect(
      sunroofInspectionFlagLine({
        evidence: "Schiebedach",
        makeModel: "Audi A4",
        makeTokens: ["AUDI"],
      }),
    ).toMatch(/VW grupā/);
    const bmw = sunroofInspectionFlagLine({
      evidence: "Glass roof",
      makeModel: "BMW 525",
      makeTokens: ["BMW"],
    });
    expect(bmw).toMatch(/grīdas paklāji/);
    expect(bmw).not.toMatch(/Volkswagen/);
  });

  it("classifies VW-group brands", () => {
    expect(isVwGroupBrand("Škoda Octavia", [])).toBe(true);
    expect(isVolkswagenBrand("VW Golf", ["VW"])).toBe(true);
    expect(isVolkswagenBrand("Audi A6", ["AUDI"])).toBe(false);
  });
});
