import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  analyzeWinterSaltRust,
  buildWinterSaltRustBrief,
  inferTailgateRustMaterial,
  winterSaltRustRequiredInPrompt,
  winterSaltTailgateMaterialFromPrompt,
} from "@/lib/admin-ai-winter-salt-rust";

const NOW = Date.parse("2026-08-24T00:00:00Z");

describe("analyzeWinterSaltRust", () => {
  it("requires rust advice for an Audi Q7 after ~10 years in Latvia", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "AUDI Q7";
    csdd.firstRegistration = "2016-03-12";
    csdd.ownerRegistrationEvents = [{ date: "2016-04-01", label: "Reģistrācija" }];
    csdd.mileageHistory = [{ date: "2016-05-10", odometer: "85 000", country: "Latvija" }];
    const c = analyzeWinterSaltRust({ csdd, nowMs: NOW });
    expect(c.required).toBe(true);
    expect(c.isSuvCrossoverWagon).toBe(true);
    expect(c.yearsInRegion).toBeGreaterThanOrEqual(10);
    expect(c.vehicleAgeYears).toBeGreaterThanOrEqual(10);
    const brief = buildWinterSaltRustBrief({ csdd, nowMs: NOW });
    expect(brief).toMatch(/Statuss: OBLIGĀTI/);
    expect(brief).toMatch(/riteņu arkas/);
    expect(brief).toMatch(/sliekšņu/);
    expect(brief).toMatch(/numura zīmes/);
    expect(winterSaltRustRequiredInPrompt(brief)).toBe(true);
  });

  it("does not require rust advice without CSDD or regional signal", () => {
    const c = analyzeWinterSaltRust({ csdd: emptyCsddFields(), nowMs: NOW });
    expect(c.required).toBe(false);
    expect(buildWinterSaltRustBrief({ csdd: emptyCsddFields(), nowMs: NOW })).toBe("");
  });

  it("requires rust for a sedan after many years in Latvia even without SUV tokens", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "BMW 320d";
    csdd.firstRegistration = "2014-06-01";
    csdd.ownerRegistrationEvents = [{ date: "2014-07-01", label: "Reģistrācija" }];
    const c = analyzeWinterSaltRust({ csdd, nowMs: NOW });
    expect(c.isSuvCrossoverWagon).toBe(false);
    expect(c.required).toBe(true);
    expect(c.yearsInRegion).toBeGreaterThanOrEqual(12);
  });

  it("does not treat a young non-SUV with a short Latvia history as mandatory", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "BMW 320d";
    csdd.firstRegistration = "2024-03-01";
    csdd.ownerRegistrationEvents = [{ date: "2024-04-01", label: "Reģistrācija" }];
    const c = analyzeWinterSaltRust({ csdd, nowMs: NOW });
    expect(c.required).toBe(false);
  });

  it("reads years-in-Latvia from listing text when dates are thin", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "AUDI Q7";
    csdd.comments = "Auto 10 gadus Latvijā, SUV.";
    const c = analyzeWinterSaltRust({ csdd, nowMs: NOW });
    expect(c.required).toBe(true);
    expect(c.yearsInRegion).toBe(10);
  });

  it("does not require rust advice for a German-only SUV with no Baltic use", () => {
    const csdd = emptyCsddFields();
    csdd.makeModel = "AUDI Q7";
    csdd.firstRegistration = "2018-03-12";
    csdd.previousRegistrationCountry = "Vācija";
    csdd.mileageHistory = [
      { date: "2020-05-10", odometer: "85 000", country: "Vācija" },
    ];
    const c = analyzeWinterSaltRust({ csdd, nowMs: NOW });
    expect(c.required).toBe(false);
    expect(c.evidencedCountries).toEqual([]);
    expect(buildWinterSaltRustBrief({ csdd, nowMs: NOW })).toBe("");
  });

  it("names the tailgate rust spot only for a known steel lid (Audi Q7)", () => {
    expect(inferTailgateRustMaterial("AUDI Q7")).toBe("steel");
    const csdd = emptyCsddFields();
    csdd.makeModel = "AUDI Q7";
    csdd.firstRegistration = "2016-03-12";
    csdd.ownerRegistrationEvents = [{ date: "2016-04-01", label: "Reģistrācija" }];
    const brief = buildWinterSaltRustBrief({ csdd, nowMs: NOW });
    expect(brief).toMatch(/Bagāžnieka vāks: tērauds/);
    expect(brief).toMatch(/numura zīmes/);
    expect(winterSaltTailgateMaterialFromPrompt(brief)).toBe("steel");
  });

  it("does not name the tailgate as a rust spot on a plastic / composite lid", () => {
    expect(inferTailgateRustMaterial("PEUGEOT 3008")).toBe("non_steel");
    expect(inferTailgateRustMaterial("CITROEN C4 PICASSO")).toBe("non_steel");
    expect(inferTailgateRustMaterial("BMW I3")).toBe("non_steel");
    const csdd = emptyCsddFields();
    csdd.makeModel = "PEUGEOT 3008";
    csdd.firstRegistration = "2016-03-12";
    csdd.ownerRegistrationEvents = [{ date: "2016-04-01", label: "Reģistrācija" }];
    const c = analyzeWinterSaltRust({ csdd, nowMs: NOW });
    expect(c.required).toBe(true);
    expect(c.tailgateMaterial).toBe("non_steel");
    expect(c.typicalSpots.join(" ")).not.toMatch(/bagāžniek|numura zīm/);
    const brief = buildWinterSaltRustBrief({ csdd, nowMs: NOW });
    expect(brief).toMatch(/Bagāžnieka vāks: plastmasa/);
    expect(brief).toMatch(/NENOSAUKT bagāžnieka vāka malu/);
    expect(winterSaltTailgateMaterialFromPrompt(brief)).toBe("non_steel");
  });

  it("omits the canned tailgate sentence when the lid material is unknown", () => {
    expect(inferTailgateRustMaterial("BMW 320d")).toBe("unknown");
    const csdd = emptyCsddFields();
    csdd.makeModel = "BMW 320d";
    csdd.firstRegistration = "2014-06-01";
    csdd.ownerRegistrationEvents = [{ date: "2014-07-01", label: "Reģistrācija" }];
    const brief = buildWinterSaltRustBrief({ csdd, nowMs: NOW });
    expect(brief).toMatch(/Bagāžnieka vāks: materiāls nav droši zināms/);
    expect(brief).not.toMatch(/nosauc vietas vārdā —[^\n]*bagāžniek/);
    expect(winterSaltTailgateMaterialFromPrompt(brief)).toBe("unknown");
  });
});
