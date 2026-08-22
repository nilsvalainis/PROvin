import { describe, expect, it } from "vitest";
import { emptyCsddFields } from "@/lib/admin-source-blocks";
import {
  analyzeTechnicalInspectionCoverage,
  buildTechnicalInspectionCoverageBrief,
  TA_FRESH_MAX_DAYS,
} from "@/lib/admin-ai-ta-coverage";

const NOW = Date.parse("2026-08-23T00:00:00Z");

function daysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString().slice(0, 10);
}

describe("analyzeTechnicalInspectionCoverage", () => {
  it("returns none when CSDD has no inspection dates", () => {
    const c = analyzeTechnicalInspectionCoverage({ csdd: emptyCsddFields(), nowMs: NOW });
    expect(c.level).toBe("none");
    expect(c.coveredGroups).toEqual([]);
    expect(buildTechnicalInspectionCoverageBrief({ csdd: emptyCsddFields(), nowMs: NOW })).toMatch(
      /NAV DATU/,
    );
  });

  it("marks a successful inspection within 3 months as fresh", () => {
    const csdd = emptyCsddFields();
    csdd.prevInspectionDate = daysAgo(20);
    csdd.nextInspectionDate = "2027-05-12";
    csdd.firstRegistration = "2018-03-01";
    csdd.technicalInspectionHistory = [
      {
        date: daysAgo(20),
        inspectionType: "Pamatpārbaude",
        ratingLabel: "1",
        ratingLevel: 1,
        maxDefectLevel: 1,
        smokeCoefficient: "0.03",
        notes: "",
        defects: [],
      },
    ];
    const c = analyzeTechnicalInspectionCoverage({ csdd, nowMs: NOW });
    expect(c.level).toBe("fresh");
    expect(c.lastInspectionAgeDays).toBe(20);
    expect(c.lastInspectionAgeDays).toBeLessThanOrEqual(TA_FRESH_MAX_DAYS);
    expect(c.nextInspectionValid).toBe(true);
    expect(c.coveredGroups.length).toBeGreaterThan(2);
    const brief = buildTechnicalInspectionCoverageBrief({ csdd, nowMs: NOW });
    expect(brief).toMatch(/SVAIGA/);
    expect(brief).toMatch(/NEPARĀDĀS/);
    expect(brief).toMatch(/balstiekārta/);
  });

  it("marks a still-valid older inspection as valid, not fresh", () => {
    const csdd = emptyCsddFields();
    csdd.prevInspectionDate = daysAgo(200);
    csdd.nextInspectionDate = "2027-01-10";
    csdd.firstRegistration = "2010-01-01";
    const c = analyzeTechnicalInspectionCoverage({ csdd, nowMs: NOW });
    expect(c.level).toBe("valid");
    expect(c.vehicleAgeYears).toBeGreaterThanOrEqual(15);
    const brief = buildTechnicalInspectionCoverageBrief({ csdd, nowMs: NOW });
    expect(brief).toMatch(/SPĒKĀ, BET NAV SVAIGA/);
    expect(brief).toMatch(/vienu īsa rindiņa|viena īsa rindiņa/i);
  });

  it("treats a level-1 finding on a 15+ year car as a one-sentence caution", () => {
    const csdd = emptyCsddFields();
    csdd.prevInspectionDate = daysAgo(40);
    csdd.nextInspectionDate = "2027-06-01";
    csdd.firstRegistration = "2008-04-01";
    csdd.technicalInspectionHistory = [
      {
        date: daysAgo(40),
        inspectionType: "Pamatpārbaude",
        ratingLabel: "1",
        ratingLevel: 1,
        maxDefectLevel: 1,
        smokeCoefficient: "",
        notes: "eļļas noplūde",
        defects: [{ code: "", rating: "1", description: "eļļas noplūde" }],
      },
    ];
    const c = analyzeTechnicalInspectionCoverage({ csdd, nowMs: NOW });
    expect(c.level).toBe("fresh");
    expect(c.minorDefectOnOlderCar).toBe(true);
    expect(buildTechnicalInspectionCoverageBrief({ csdd, nowMs: NOW })).toMatch(/VIENS teikums/);
  });

  it("marks an expired inspection as expired", () => {
    const csdd = emptyCsddFields();
    csdd.prevInspectionDate = daysAgo(500);
    csdd.nextInspectionDate = daysAgo(140);
    const c = analyzeTechnicalInspectionCoverage({ csdd, nowMs: NOW });
    expect(c.level).toBe("expired");
    expect(c.nextInspectionValid).toBe(false);
    expect(buildTechnicalInspectionCoverageBrief({ csdd, nowMs: NOW })).toMatch(/BEIGUSIES/);
  });

  it("computes km since inspection from CSDD mileage rows", () => {
    const csdd = emptyCsddFields();
    csdd.prevInspectionDate = daysAgo(15);
    csdd.nextInspectionDate = "2027-08-01";
    csdd.prevInspectionBlock = {
      ...csdd.prevInspectionBlock,
      inspectionDateText: daysAgo(15),
      odometer: "184000",
    };
    csdd.mileageHistory = [
      { date: daysAgo(15), odometer: "184000", country: "LV" },
      { date: daysAgo(1), odometer: "186500", country: "LV" },
    ];
    const c = analyzeTechnicalInspectionCoverage({ csdd, nowMs: NOW });
    expect(c.kmSinceInspection).toBe(2500);
  });
});
