import { describe, expect, it } from "vitest";

import {
  areUnifiedIncidentAmountsSimilar,
  mergeUnifiedIncidentRowsForPdf,
  prepareUnifiedIncidentDisplayRows,
  type UnifiedIncidentRow,
} from "@/lib/unified-incidents";

function row(
  partial: Partial<UnifiedIncidentRow> &
    Pick<UnifiedIncidentRow, "date" | "lossAmount" | "sourceLabel">,
): UnifiedIncidentRow {
  const sortableTime = partial.sortableTime ?? Date.parse(partial.date);
  return {
    country: "LV",
    sourceOrder: 0,
    ...partial,
    sortableTime: Number.isFinite(sortableTime) ? sortableTime : Number.NEGATIVE_INFINITY,
  };
}

describe("areUnifiedIncidentAmountsSimilar", () => {
  it("merges close small amounts within 15%", () => {
    expect(areUnifiedIncidentAmountsSimilar("1200 €", "1300 €")).toBe(true);
  });

  it("rejects large absolute gap even when under 15%", () => {
    expect(areUnifiedIncidentAmountsSimilar("5000 €", "5500 €")).toBe(false);
  });

  it("accepts within absolute 250 € cap", () => {
    expect(areUnifiedIncidentAmountsSimilar("5000 €", "5200 €")).toBe(true);
  });
});

describe("mergeUnifiedIncidentRowsForPdf", () => {
  it("merges same date + similar amount from different sources into one row with stripes labels", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2021-06-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2021-06-01", lossAmount: "1300 €", sourceLabel: "LTAB", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceLabels).toEqual(expect.arrayContaining(["AutoDNA", "LTAB"]));
    expect(merged[0]?.lossAmount).toContain("1 200");
    expect(merged[0]?.lossAmount).toContain("1 300");
  });

  it("keeps same-month different dates as separate incidents", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2021-06-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2021-06-15", lossAmount: "1200 €", sourceLabel: "LTAB", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does not merge two rows from the same source", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2021-06-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2021-06-01", lossAmount: "1250 €", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("does not merge dissimilar amounts on the same date", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2021-06-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2021-06-01", lossAmount: "8000 €", sourceLabel: "LTAB", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
  });

  it("prepareUnifiedIncidentDisplayRows sorts newest first", () => {
    const out = prepareUnifiedIncidentDisplayRows([
      row({ date: "2020-01-01", lossAmount: "500 €", sourceLabel: "LTAB", sourceOrder: 1 }),
      row({ date: "2021-06-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
    ]);
    expect(out[0]?.date).toBe("2021-06-01");
    expect(out[1]?.date).toBe("2020-01-01");
  });
});
