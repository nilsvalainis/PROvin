import { describe, expect, it } from "vitest";

import {
  areUnifiedIncidentAmountsSimilar,
  formatUnifiedIncidentCountSummaryLine,
  mergeUnifiedIncidentRowsForPdf,
  prepareUnifiedIncidentDisplayRows,
  summarizeUnifiedIncidentCounts,
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
  it("merges same month + different days from different sources into one MM.YYYY row", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2021-06-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2021-06-15", lossAmount: "1300 €", sourceLabel: "LTAB", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.date).toBe("06.2021");
    expect(merged[0]?.sourceLabels).toEqual(expect.arrayContaining(["AutoDNA", "LTAB"]));
    expect(merged[0]?.lossAmount).toContain("1 200");
    expect(merged[0]?.lossAmount).toContain("1 300");
    expect(merged[0]?.sourceRecordCount).toBe(2);
  });

  it("merges all records in the same month including same source", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2012-10-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2012-10-01", lossAmount: "800 €", sourceLabel: "AutoDNA", sourceOrder: 1 }),
      row({ date: "2012-10-01", lossAmount: "1001 - 1500 €", sourceLabel: "CarVertical", sourceOrder: 2 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.date).toBe("10.2012");
    expect(merged[0]?.sourceRecordCount).toBe(3);
    expect(merged[0]?.lossAmount).toMatch(/800/);
    expect(merged[0]?.lossAmount).toMatch(/1\s*500/);
  });

  it("keeps different months as separate periods", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2014-04-01", lossAmount: "1100 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2014-08-01", lossAmount: "3200 €", sourceLabel: "CarVertical", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.date)).toEqual(["08.2014", "04.2014"]);
  });

  it("keeps non-numeric labels like theft alongside amount range", () => {
    const merged = mergeUnifiedIncidentRowsForPdf([
      row({ date: "2013-01-01", lossAmount: "1001 - 1500 €", sourceLabel: "CarVertical", sourceOrder: 0 }),
      row({ date: "2013-01-01", lossAmount: "Zādzība", sourceLabel: "AutoDNA", sourceOrder: 1 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.lossAmount).toContain("Zādzība");
    expect(merged[0]?.lossAmount).toMatch(/1\s*001/);
  });

  it("prepareUnifiedIncidentDisplayRows sorts newest month first", () => {
    const out = prepareUnifiedIncidentDisplayRows([
      row({ date: "2020-01-01", lossAmount: "500 €", sourceLabel: "LTAB", sourceOrder: 1 }),
      row({ date: "2021-06-01", lossAmount: "1200 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
    ]);
    expect(out[0]?.date).toBe("06.2021");
    expect(out[1]?.date).toBe("01.2020");
  });

  it("summarizes period vs source record counts", () => {
    const collected = [
      row({ date: "2012-10-01", lossAmount: "800 €", sourceLabel: "AutoDNA", sourceOrder: 0 }),
      row({ date: "2012-10-01", lossAmount: "900 €", sourceLabel: "CarVertical", sourceOrder: 1 }),
      row({ date: "2014-08-01", lossAmount: "3200 €", sourceLabel: "AutoDNA", sourceOrder: 2 }),
    ];
    const display = mergeUnifiedIncidentRowsForPdf(collected);
    const summary = summarizeUnifiedIncidentCounts(collected, display);
    expect(summary.periodCount).toBe(2);
    expect(summary.sourceRecordCount).toBe(3);
    expect(formatUnifiedIncidentCountSummaryLine(summary)).toContain("Negadījumu periodi: 2");
    expect(formatUnifiedIncidentCountSummaryLine(summary)).toContain("AutoDNA: 2");
    expect(formatUnifiedIncidentCountSummaryLine(summary)).toContain("CarVertical: 1");
  });
});
