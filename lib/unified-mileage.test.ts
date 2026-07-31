import { describe, expect, it } from "vitest";

import {
  analyzeUnifiedMileageAnomalies,
  mergeUnifiedMileageRowsByOdometer,
  prepareUnifiedMileageDisplayRows,
  type UnifiedMileageRow,
} from "@/lib/unified-mileage";

function row(partial: Partial<UnifiedMileageRow> & Pick<UnifiedMileageRow, "date" | "odometer" | "sourceLabel">): UnifiedMileageRow {
  const sortableTime = partial.sortableTime ?? Date.parse(partial.date);
  return {
    country: "LV",
    sourceOrder: 0,
    ...partial,
    sortableTime,
  };
}

describe("mergeUnifiedMileageRowsByOdometer", () => {
  it("merges identical km from different sources within 2 months", () => {
    const merged = mergeUnifiedMileageRowsByOdometer([
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-07-15", odometer: "120000", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceLabels).toEqual(expect.arrayContaining(["CSDD", "AutoDNA"]));
    expect(merged[0]?.date).toBe("2020-07-15");
  });

  it("keeps separate rows when same km but dates exceed 2 months", () => {
    const merged = mergeUnifiedMileageRowsByOdometer([
      row({ date: "2020-01-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does not merge different km readings", () => {
    const merged = mergeUnifiedMileageRowsByOdometer([
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-06-02", odometer: "121000", sourceLabel: "CarVertical", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("prepareUnifiedMileageDisplayRows returns chronologically sorted merged rows", () => {
    const out = prepareUnifiedMileageDisplayRows([
      row({ date: "2021-01-01", odometer: "150000", sourceLabel: "LTAB", sourceOrder: 2 }),
      row({ date: "2020-06-01", odometer: "120000", sourceLabel: "CSDD", sourceOrder: 0 }),
      row({ date: "2020-07-01", odometer: "120000", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]?.odometer).toBe("120000");
    expect(out[0]?.sourceLabels).toHaveLength(2);
    expect(out[1]?.odometer).toBe("150000");
  });
});

describe("analyzeUnifiedMileageAnomalies", () => {
  it("flags extra-digit spike (255811) and excludes it from chart; does not flag recovery", () => {
    const rows = [
      row({
        date: "01.03.2010",
        odometer: "25381",
        sourceLabel: "CV",
        sourceOrder: 0,
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 1),
      }),
      row({
        date: "01.03.2010",
        odometer: "25581",
        sourceLabel: "DNA",
        sourceOrder: 1,
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 1),
      }),
      row({
        date: "29.03.2010",
        odometer: "255811",
        sourceLabel: "DEALER",
        sourceOrder: 2,
        country: "DE",
        sortableTime: Date.UTC(2010, 2, 29),
      }),
      row({
        date: "01.01.2011",
        odometer: "49481",
        sourceLabel: "CV",
        sourceOrder: 3,
        country: "DE",
        sortableTime: Date.UTC(2011, 0, 1),
      }),
      row({
        date: "11.01.2011",
        odometer: "49681",
        sourceLabel: "DEALER",
        sourceOrder: 4,
        country: "DE",
        sortableTime: Date.UTC(2011, 0, 11),
      }),
    ];
    const { anomalyBySourceOrder, chartExcludeSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
    expect(chartExcludeSourceOrders.has(2)).toBe(true);
    expect(anomalyBySourceOrder.get(2)).toBe(true);
    expect(anomalyBySourceOrder.get(3)).toBe(false);
    expect(anomalyBySourceOrder.get(4)).toBe(false);
  });

  it("still flags genuine odometer rollback", () => {
    const rows = [
      row({
        date: "01.01.2020",
        odometer: "150000",
        sourceLabel: "AutoDNA",
        sourceOrder: 0,
        country: "NL",
        sortableTime: Date.UTC(2020, 0, 1),
      }),
      row({
        date: "01.01.2022",
        odometer: "80000",
        sourceLabel: "CSDD",
        sourceOrder: 1,
        country: "LV",
        sortableTime: Date.UTC(2022, 0, 1),
      }),
    ];
    const { anomalyBySourceOrder, chartExcludeSourceOrders } = analyzeUnifiedMileageAnomalies(rows);
    expect(chartExcludeSourceOrders.size).toBe(0);
    expect(anomalyBySourceOrder.get(1)).toBe(true);
  });
});
