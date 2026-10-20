import { describe, expect, it } from "vitest";
import {
  formatIrissMonthlyDelta,
  formatIrissReportClientName,
  formatIrissReportMonthLocative,
  formatIrissReportNavLabel,
  IRISS_REPORT_PDF_VALUE,
  irissMonthlyMetricDeltas,
  irissMonthlyMetricSnapshot,
} from "@/lib/iriss-monthly-report-view";

describe("iriss monthly report view copy", () => {
  it("uses Oktobris 2026 in the toolbar and locative pret septembri", () => {
    expect(formatIrissReportNavLabel(2026, 10)).toBe("Oktobris 2026");
    expect(formatIrissReportMonthLocative(9)).toBe("septembri");
    expect(formatIrissMonthlyDelta(3, "septembri")).toBe("+3 pret septembri");
    expect(formatIrissMonthlyDelta(0, "septembri")).toBe("bez izmaiņām");
    expect(formatIrissMonthlyDelta(-1, "septembri")).toBe("-1 pret septembri");
  });

  it("shows Bez vārda and Nav datu without long dashes", () => {
    expect(formatIrissReportClientName("")).toBe("Bez vārda");
    expect(formatIrissReportClientName("-")).toBe("Bez vārda");
    expect(formatIrissReportClientName("Anna Bērziņa")).toBe("Anna Bērziņa");
    expect(IRISS_REPORT_PDF_VALUE).toBe("Nav datu");
    expect(formatIrissReportNavLabel(2026, 10)).not.toMatch(/\u2014|\u2013/);
  });

  it("diffs this month against the previous month", () => {
    const deltas = irissMonthlyMetricDeltas(
      irissMonthlyMetricSnapshot({
        ordersCreated: 6,
        ordersByStatus: { active: 3, completed: 1, inactive: 2 },
        offersCreated: 2,
        ordersWithOffers: 2,
        offersUpdated: 2,
      }),
      irissMonthlyMetricSnapshot({
        ordersCreated: 3,
        ordersByStatus: { active: 2, completed: 1, inactive: 0 },
        offersCreated: 1,
        ordersWithOffers: 1,
        offersUpdated: 0,
      }),
    );
    expect(deltas).toEqual({
      ordersCreated: 3,
      active: 1,
      completed: 0,
      inactive: 2,
      offersCreated: 1,
      ordersWithOffers: 1,
      offersUpdated: 2,
    });
  });
});
