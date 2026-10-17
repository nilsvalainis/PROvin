import { describe, expect, it } from "vitest";
import {
  applyOdometerAnomalyOverrides,
  classifyOdometerAnomalies,
  countChartMileageReadings,
  hasActiveRollbackAnomaly,
  looksArtificialMonthDay,
  selectNewestChartMileageRow,
} from "@/lib/odometer-anomaly-classify";
import type { UnifiedMileageRow as MileageRow } from "@/lib/unified-mileage";

function row(
  partial: Partial<MileageRow> & Pick<MileageRow, "date" | "odometer" | "sourceLabel" | "sourceOrder">,
): MileageRow {
  return {
    country: "LV",
    sortableTime: partial.sortableTime ?? Date.UTC(2020, 0, 1),
    ...partial,
  };
}

describe("classifyOdometerAnomalies", () => {
  it("marks an isolated drop that later recovers as a typo", () => {
    const rows = [
      row({ date: "01.01.2020", odometer: "100000", sourceLabel: "CSDD", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) }),
      row({ date: "01.03.2020", odometer: "82000", sourceLabel: "CSDD", sourceOrder: 1, sortableTime: Date.UTC(2020, 2, 1) }),
      row({ date: "15.03.2020", odometer: "105000", sourceLabel: "CSDD", sourceOrder: 2, sortableTime: Date.UTC(2020, 2, 15) }),
    ];
    const out = classifyOdometerAnomalies(rows);
    expect(out).toHaveLength(1);
    expect(out[0]?.class).toBe("typo_outlier");
    expect(out[0]?.labelLv).toBe("Iespējama ievades kļūda");
    expect(hasActiveRollbackAnomaly(rows)).toBe(false);
  });

  it("marks a lasting drop as rollback", () => {
    const rows = [
      row({ date: "01.01.2020", odometer: "180000", sourceLabel: "CSDD", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) }),
      row({ date: "01.06.2024", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 1, sortableTime: Date.UTC(2024, 5, 1) }),
    ];
    const out = classifyOdometerAnomalies(rows);
    expect(out.map((a) => a.class)).toEqual(["rollback"]);
    expect(out[0]?.dropKm).toBe(60000);
    expect(hasActiveRollbackAnomaly(rows)).toBe(true);
  });

  it("marks same-month 01.MM drop as date precision", () => {
    const rows = [
      row({
        date: "01.03.2020",
        odometer: "150000",
        sourceLabel: "CarVertical",
        sourceOrder: 0,
        sortableTime: Date.UTC(2020, 2, 1),
        datePrecision: "month",
      }),
      row({
        date: "18.03.2020",
        odometer: "148200",
        sourceLabel: "CSDD",
        sourceOrder: 1,
        sortableTime: Date.UTC(2020, 2, 18),
      }),
    ];
    expect(looksArtificialMonthDay(rows[0]!)).toBe(true);
    const out = classifyOdometerAnomalies(rows);
    expect(out.map((a) => a.class)).toEqual(["date_precision"]);
    expect(hasActiveRollbackAnomaly(rows)).toBe(false);
  });

  it("dismiss override removes the flag from active rollback", () => {
    const rows = [
      row({ date: "01.01.2020", odometer: "180000", sourceLabel: "CSDD", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) }),
      row({ date: "01.06.2024", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 1, sortableTime: Date.UTC(2024, 5, 1) }),
    ];
    const [flag] = classifyOdometerAnomalies(rows);
    expect(flag).toBeTruthy();
    const dismissed = applyOdometerAnomalyOverrides([flag!], [{ key: flag!.key, action: "dismiss" }]);
    expect(dismissed).toEqual([]);
    expect(hasActiveRollbackAnomaly(rows, [{ key: flag!.key, action: "dismiss" }])).toBe(false);
    expect(hasActiveRollbackAnomaly(rows, [{ key: flag!.key, action: "confirm" }])).toBe(true);
  });

  it("counts chart readings without excluded typos and picks last verified km", () => {
    const rows = [
      row({ date: "01.01.2020", odometer: "100000", sourceLabel: "CSDD", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) }),
      row({ date: "01.03.2020", odometer: "1000000", sourceLabel: "CSDD", sourceOrder: 1, sortableTime: Date.UTC(2020, 2, 1) }),
      row({ date: "15.03.2020", odometer: "110000", sourceLabel: "CSDD", sourceOrder: 2, sortableTime: Date.UTC(2020, 2, 15) }),
      row({ date: "01.06.2024", odometer: "111200", sourceLabel: "ss.lv", sourceOrder: 3, sortableTime: Date.UTC(2024, 5, 1) }),
    ];
    expect(countChartMileageReadings(rows)).toBe(3);
    expect(selectNewestChartMileageRow(rows)?.odometer).toBe("110000");
  });
});
