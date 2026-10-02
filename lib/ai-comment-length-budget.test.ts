import { describe, expect, it } from "vitest";

import {
  COMMENT_LENGTH_BUDGET,
  analyzeCommentDataDensity,
  buildCommentLengthBudgetBrief,
  commentLengthLimitsWaived,
  commentQualityMaxChars,
  measureOperatorSuppliedChars,
} from "@/lib/ai-comment-length-budget";
import { createDefaultSourceBlocks, emptyCsddFields } from "@/lib/admin-source-blocks";

describe("comment length budget", () => {
  it("keeps existing quality ceilings", () => {
    expect(COMMENT_LENGTH_BUDGET.source.maxChars).toBe(4000);
    expect(COMMENT_LENGTH_BUDGET.source.targetParas).toMatch(/1/);
    expect(COMMENT_LENGTH_BUDGET.source.targetChars).toMatch(/faktiem/);
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
    expect(brief).toMatch(/OPERATORA IELĪMĒTAIS TEKSTS|Esošais melnraksts/);
    expect(brief).toMatch(/Garums seko informācijai/);
  });

  it("waives length ceilings when the operator pasted a long comment", () => {
    const paste = "x".repeat(500);
    const prompt = [
      "=== OPERATORA IELĪMĒTAIS TEKSTS (pilns saturs jāsaglabā) ===",
      paste,
      "=== BEIGAS OPERATORA IELĪMĒTAJAM TEKSTAM ===",
    ].join("\n");
    expect(measureOperatorSuppliedChars(prompt)).toBe(500);
    expect(commentLengthLimitsWaived(prompt)).toBe(true);
    expect(commentQualityMaxChars("source", prompt)).toBeNull();
    expect(commentQualityMaxChars("summary", "īss prompts")).toBe(
      COMMENT_LENGTH_BUDGET.summary.maxChars,
    );
  });

  it("waives length ceilings for a long existing field draft", () => {
    const prompt = [
      "=== Esošais melnraksts (operators jau uzrakstījis klientam - NEĪSINĀT, saglabā visus faktus) ===",
      "y".repeat(450),
      "=== BEIGAS ESOŠAJAM MELNRAKSTAM ===",
    ].join("\n");
    expect(commentLengthLimitsWaived(prompt)).toBe(true);
  });

  it("raises the too_long ceiling when the length brief marks high density", () => {
    const prompt = "### Komentāru garuma budžets (deterministisks)\n- Datu blīvums: AUGSTS (5 avoti";
    expect(commentQualityMaxChars("source", prompt)).toBeGreaterThan(
      COMMENT_LENGTH_BUDGET.source.maxChars,
    );
    expect(commentLengthLimitsWaived(prompt)).toBe(false);
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
