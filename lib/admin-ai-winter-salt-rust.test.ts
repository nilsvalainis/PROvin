import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  analyzeWinterSaltRust,
  buildWinterSaltRustBrief,
  winterSaltRustRequiredInPrompt,
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
});
