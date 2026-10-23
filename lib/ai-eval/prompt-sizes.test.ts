import { describe, expect, it } from "vitest";
import { collectAdminSystemPromptSizes, formatPromptSizeTable } from "@/lib/ai-eval/prompt-sizes";

describe("admin system prompt sizes", () => {
  it("prints a size table and keeps prompts non-empty", () => {
    const rows = collectAdminSystemPromptSizes();
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const row of rows) {
      expect(row.chars).toBeGreaterThan(1000);
      expect(row.tokens).toBeGreaterThan(300);
    }
    // eslint-disable-next-line no-console
    console.log(`\nPROMPT SIZES\n${formatPromptSizeTable(rows)}\n`);
  });
});

/**
 * Griesti (BMW plāns, 23.10.2026): izmērs pēc 1.-5. posma + ~150 zīmju rezerve.
 * Ja jauns noteikums tos pārsniedz, apzināti paceļ griestus un PR aprakstā norāda tokenu pieaugumu.
 */
const PROMPT_CHAR_CEILINGS: Record<string, number> = {
  source_csdd: 31_950,
  source_dealer: 36_650,
  technical_risks_v1: 89_250,
  inspection: 81_750,
  summary: 80_900,
  mileage: 80_950,
  incidents: 82_500,
  price: 29_450,
  seller: 77_350,
  oil_intervals: 34_850,
};

describe("admin system prompt size ceilings", () => {
  it("no prompt grows past its ceiling unnoticed", () => {
    for (const row of collectAdminSystemPromptSizes()) {
      const ceiling = PROMPT_CHAR_CEILINGS[row.field];
      expect(ceiling, `ceiling for ${row.field}`).toBeDefined();
      expect(row.chars, `${row.field} prompt grew past ceiling`).toBeLessThanOrEqual(ceiling!);
    }
  });
});
