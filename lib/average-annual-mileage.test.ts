import { describe, expect, it } from "vitest";
import { computeAverageAnnualMileage } from "@/lib/average-annual-mileage";
import type { UnifiedMileageRow } from "@/lib/unified-mileage";

function row(
  date: string,
  odometer: string,
  sortableTime: number,
): UnifiedMileageRow {
  return {
    date,
    odometer,
    country: "Latvija",
    sortableTime,
    sourceOrder: 0,
    sourceLabel: "CSDD",
  };
}

describe("computeAverageAnnualMileage", () => {
  it("computes span-based annual average", () => {
    const t0 = Date.UTC(2020, 0, 1);
    const t1 = Date.UTC(2022, 0, 1);
    const result = computeAverageAnnualMileage({
      unifiedMileageRows: [row("01.01.2020", "10 000", t0), row("01.01.2022", "50 000", t1)],
      referenceDate: new Date(t1),
    });
    expect(result?.method).toBe("span");
    expect(result?.kmPerYear).toBeGreaterThan(19_900);
    expect(result?.kmPerYear).toBeLessThan(20_100);
    expect(result?.sentence).toContain("km");
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
