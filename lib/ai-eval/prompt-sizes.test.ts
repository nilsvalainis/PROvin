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
 * 21.11.2026: +~235 zīmes (~60 tokeni) - pirmās reģistrācijas nosaukuma noteikums (viena „Pirmā reģistrācija”).
 * 22.11.2026: source_dealer +~1 250, oil_intervals +~600 zīmes - dīlera „Komentāri” un eļļas lauka lomu dalījums, PDF tabulas nedublēt.
 * 22.11.2026 (2): source_dealer +~350 zīmes - „tikai fakti, nekādu ieteikumu” un „pozīcija nav darbība” (audits K4/AI).
 * 24.11.2026: source_csdd +~320 zīmes (~80 tokeni) - „Īpašnieku periodi” fakti CSDD komentārā (bloks «Īpašnieki un nobraukums»).
 * 24.11.2026 (2): lauku aģenta prompti +~265 zīmes (~65 tokeni) - „Pārdevēja apgalvojumi sludinājumā” salīdzināšana ar datiem.
 */
const PROMPT_CHAR_CEILINGS: Record<string, number> = {
  source_csdd: 32_400,
  source_dealer: 38_500,
  technical_risks_v1: 89_920,
  inspection: 82_410,
  summary: 81_550,
  mileage: 81_590,
  incidents: 83_180,
  price: 29_450,
  seller: 78_000,
  oil_intervals: 35_600,
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
