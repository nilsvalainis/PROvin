import { describe, expect, it } from "vitest";
import {
  applyOdometerAnomalyOverrides,
  classifyOdometerAnomalies,
  countChartMileageReadings,
  hasActiveRollbackAnomaly,
  looksArtificialMonthDay,
  odometerAnomalyOverridesSnapshotField,
  parseOdometerAnomalyOverrides,
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

  it("attīšana paliek rollback, arī ja pēc gadiem nobraukums pārsniedz veco maksimumu (Škoda SE → LV)", () => {
    const rows = [
      row({ date: "01.05.2019", odometer: "181849", sourceLabel: "AutoDNA", sourceOrder: 0, sortableTime: Date.UTC(2019, 4, 1), country: "Zviedrija" }),
      row({ date: "11.05.2020", odometer: "253760", sourceLabel: "AutoDNA", sourceOrder: 1, sortableTime: Date.UTC(2020, 4, 11), country: "Zviedrija" }),
      row({ date: "28.09.2020", odometer: "181345", sourceLabel: "CSDD", sourceOrder: 2, sortableTime: Date.UTC(2020, 8, 28) }),
      row({ date: "26.10.2021", odometer: "195748", sourceLabel: "CSDD", sourceOrder: 3, sortableTime: Date.UTC(2021, 9, 26) }),
      row({ date: "01.11.2024", odometer: "245236", sourceLabel: "CSDD", sourceOrder: 4, sortableTime: Date.UTC(2024, 10, 1) }),
      row({ date: "30.11.2025", odometer: "275181", sourceLabel: "CSDD", sourceOrder: 5, sortableTime: Date.UTC(2025, 10, 30) }),
    ];
    const out = classifyOdometerAnomalies(rows);
    expect(out.map((a) => a.class)).toEqual(["rollback"]);
    // 181 345 (≈ SE 05.2019 181 849) ir „novecojis dokuments”; kritums redzams pret nākamo LV rādījumu.
    expect(out[0]?.fromKm).toBe(253760);
    expect(out[0]?.toKm).toBe(195748);
    expect(hasActiveRollbackAnomaly(rows)).toBe(true);
  });

  it("kritums, kas atgūts dažu mēnešu laikā ar vairākiem rādījumiem, nav rollback", () => {
    const rows = [
      row({ date: "01.01.2020", odometer: "100000", sourceLabel: "CSDD", sourceOrder: 0, sortableTime: Date.UTC(2020, 0, 1) }),
      row({ date: "01.03.2020", odometer: "82000", sourceLabel: "CSDD", sourceOrder: 1, sortableTime: Date.UTC(2020, 2, 1) }),
      row({ date: "01.04.2020", odometer: "83000", sourceLabel: "CSDD", sourceOrder: 2, sortableTime: Date.UTC(2020, 3, 1) }),
      row({ date: "01.06.2020", odometer: "104000", sourceLabel: "CSDD", sourceOrder: 3, sortableTime: Date.UTC(2020, 5, 1) }),
    ];
    expect(hasActiveRollbackAnomaly(rows)).toBe(false);
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

describe("parseOdometerAnomalyOverrides", () => {
  it("returns undefined for missing or non-array values so old orders stay untouched", () => {
    expect(parseOdometerAnomalyOverrides(undefined)).toBeUndefined();
    expect(parseOdometerAnomalyOverrides(null)).toBeUndefined();
    expect(parseOdometerAnomalyOverrides({ key: "x", action: "dismiss" })).toBeUndefined();
    expect(odometerAnomalyOverridesSnapshotField(undefined)).toEqual({});
    expect(odometerAnomalyOverridesSnapshotField(null)).toEqual({});
  });

  it("keeps an empty array as a real clear and drops invalid items", () => {
    expect(parseOdometerAnomalyOverrides([])).toEqual([]);
    expect(odometerAnomalyOverridesSnapshotField([])).toEqual({ odometerAnomalyOverrides: [] });
    expect(
      parseOdometerAnomalyOverrides([
        { key: "a|1", action: "dismiss" },
        { key: "a|1", action: "confirm" },
        { key: "", action: "dismiss" },
        { key: "b|2", action: "skip" },
        { key: "c|3", action: "confirm" },
        null,
      ]),
    ).toEqual([
      { key: "a|1", action: "dismiss" },
      { key: "c|3", action: "confirm" },
    ]);
  });
});
