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
 * 26.10.2026: technical_risks/inspection/summary/mileage/incidents/seller + vismaz 10-50,
 * jo etiķete „Izsoļu portālu arhīvs” ir garāka par iepriekšējo īso zīmolu.
 */
const PROMPT_CHAR_CEILINGS: Record<string, number> = {
  source_csdd: 31_950,
  source_dealer: 36_650,
  technical_risks_v1: 89_270,
  inspection: 81_770,
  summary: 80_930,
  mileage: 81_000,
  incidents: 82_540,
  price: 29_450,
  seller: 77_360,
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
