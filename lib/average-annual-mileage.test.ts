import { describe, expect, it } from "vitest";
import {
  computeAverageAnnualMileage,
  reconstructTheoreticalMileagePath,
} from "@/lib/average-annual-mileage";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

function row(
  date: string,
  odometer: string,
  sortableTime: number,
  sourceOrder = 0,
): UnifiedMileageRow {
  return {
    date,
    odometer,
    country: "Latvija",
    sortableTime,
    sourceOrder,
    sourceLabel: "CSDD",
  };
}

describe("reconstructTheoreticalMileagePath", () => {
  it("adds rollback offset so theoretical mileage stays continuous", () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2021, 0, 1);
    const t2 = Date.UTC(2022, 0, 1);
    const t3 = Date.UTC(2023, 0, 1);
    const { path, correctedForAnomaly, totalRollbackKm } = reconstructTheoreticalMileagePath([
      { t: t0, km: 100_000, dateDisplay: "01.01.2020" },
      { t: t1, km: 150_000, dateDisplay: "01.01.2021" },
      { t: t2, km: 80_000, dateDisplay: "01.01.2022" },
      { t: t3, km: 100_000, dateDisplay: "01.01.2023" },
    ]);
    expect(correctedForAnomaly).toBe(true);
    expect(totalRollbackKm).toBe(70_000);
    expect(path[2]?.theoreticalKm).toBe(150_000);
    expect(path[3]?.theoreticalKm).toBe(170_000);
  });
});

describe("computeAverageAnnualMileage", () => {
  it("computes span-based annual average without anomaly", () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2022, 0, 1);
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: [row("01.01.2020", "10 000", t0), row("01.01.2022", "50 000", t1)],
      referenceDate: new Date(t1),
    });
    expect(result?.method).toBe("theoretical_span");
    expect(result?.correctedForAnomaly).toBe(false);
    expect(result?.kmPerYear).toBeGreaterThan(19_900);
    expect(result?.kmPerYear).toBeLessThan(20_100);
    expect(result?.sentence).toContain("km");
    expect(result?.sentence).toContain("Intensīvākais periods");
  });

  it("reconstructs theoretical average after odometer rollback", () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2021, 0, 1);
    const t2 = Date.UTC(2022, 0, 1);
    const t3 = Date.UTC(2023, 0, 1);
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: [
        row("01.01.2020", "100000", t0, 0),
        row("01.01.2021", "150000", t1, 1),
        row("01.01.2022", "80000", t2, 2),
        row("01.01.2023", "100000", t3, 3),
      ],
      referenceDate: new Date(t3),
    });
    expect(result?.method).toBe("theoretical_span");
    expect(result?.correctedForAnomaly).toBe(true);
    // 100k → 170k teorētiski / ~3 gadi ≈ 23 300
    expect(result?.kmPerYear).toBeGreaterThan(22_000);
    expect(result?.kmPerYear).toBeLessThan(25_000);
    expect(result?.sentence).toMatch(/teorētiski koriģēto|neatbilstīb/i);
    expect(result?.sentence).toContain("Intensīvākais periods");
    expect(result?.peakFromDisplay).toBeTruthy();
    expect(result?.peakToDisplay).toBeTruthy();
  });

  it("falls back to first registration when only one reading", () => {
    const t1 = Date.UTC(2024, 0, 1);
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: [row("01.01.2024", "80 000", t1)],
      csddForm: {
        firstRegistration: "01.01.2020",
      } as import("@/lib/admin-source-blocks").CsddFormFields,
      referenceDate: new Date(t1),
    });
    expect(result?.method).toBe("first_registration");
    expect(result?.kmPerYear).toBe(20_000);
    expect(result?.sentence).toContain("Intensīvākais periods");
  });

  it("returns null without usable data", () => {
    expect(
      computeAverageAnnualMileage({
        unifiedMileageRows: [],
        referenceDate: new Date(),
      }),
    ).toBeNull();
  });
});
