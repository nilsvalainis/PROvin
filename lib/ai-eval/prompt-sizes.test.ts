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
