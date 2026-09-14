import { describe, expect, it } from "vitest";

import {
  COMMENT_LENGTH_BUDGET,
  analyzeCommentDataDensity,
  buildCommentLengthBudgetBrief,
} from "@/lib/ai-comment-length-budget";
import { createDefaultSourceBlocks, emptyCsddFields } from "@/lib/admin-source-blocks";

describe("comment length budget", () => {
  it("keeps existing quality ceilings", () => {
    expect(COMMENT_LENGTH_BUDGET.source.maxChars).toBe(1400);
    expect(COMMENT_LENGTH_BUDGET.mileage.maxChars).toBe(2400);
    expect(COMMENT_LENGTH_BUDGET.technical_risks.maxChars).toBe(16_000);
    expect(COMMENT_LENGTH_BUDGET.inspection.maxChars).toBe(14_000);
    expect(COMMENT_LENGTH_BUDGET.summary.maxChars).toBe(1800);
    expect(COMMENT_LENGTH_BUDGET.technical_risks.flagship).toBe(true);
  });

  it("marks an empty order as low density and tells the model to stay short", () => {
    const empty = createDefaultSourceBlocks();
    expect(analyzeCommentDataDensity(empty).density).toBe("low");
    const brief = buildCommentLengthBudgetBrief(empty);
    expect(brief).toMatch(/ZEMS/);
    expect(brief).toMatch(/datu ir MAZ/);
    expect(brief).toMatch(/OPERATORA KOMANDAS/);
  });

  it("marks a filled CSDD form as at least medium when mileage exists", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.csdd = {
      ...emptyCsddFields(),
      makeModel: "BMW X5",
      mileageHistory: [
        { date: "01.01.2018", odometer: "80000", country: "LV" },
        { date: "01.01.2019", odometer: "100000", country: "LV" },
        { date: "01.01.2020", odometer: "120000", country: "LV" },
        { date: "01.01.2021", odometer: "140000", country: "LV" },
      ],
    };
    const d = analyzeCommentDataDensity(blocks);
    expect(d.sourceCount).toBeGreaterThanOrEqual(1);
    expect(d.mileageRowCount).toBe(4);
    expect(d.density).not.toBe("low");
  });
});
