import { describe, expect, it } from "vitest";

import {
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
