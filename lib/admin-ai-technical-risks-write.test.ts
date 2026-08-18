import { describe, expect, it } from "vitest";
import {
  countExpertCommentParagraphs,
  isTechnicalRisksClientRewriteTooThin,
  shouldChainClaudeTechnicalRisksToGeminiWrite,
} from "@/lib/admin-ai-technical-risks-write";

function paras(n: number, charsEach = 280): string {
  return Array.from({ length: n }, (_, i) => `**Mezgls ${i + 1}.** ${"teksts ".repeat(Math.ceil(charsEach / 7))}`).join(
    "\n\n",
  );
}

describe("technical risks Claude→Gemini write chain", () => {
  it("chains only when Claude is the analyst and Gemini key exists", () => {
    expect(shouldChainClaudeTechnicalRisksToGeminiWrite("flash", true)).toBe(true);
    expect(shouldChainClaudeTechnicalRisksToGeminiWrite("pro", true)).toBe(true);
    expect(shouldChainClaudeTechnicalRisksToGeminiWrite("lite", true)).toBe(true);
    expect(shouldChainClaudeTechnicalRisksToGeminiWrite("gemini-flash", true)).toBe(false);
    expect(shouldChainClaudeTechnicalRisksToGeminiWrite("gemini", true)).toBe(false);
    expect(shouldChainClaudeTechnicalRisksToGeminiWrite("flash", false)).toBe(false);
  });

  it("rejects a Gemini rewrite that summarised away the flagship length", () => {
    const source = paras(10, 320);
    expect(countExpertCommentParagraphs(source)).toBe(10);
    expect(isTechnicalRisksClientRewriteTooThin(source, paras(3, 200))).toBe(true);
    expect(isTechnicalRisksClientRewriteTooThin(source, paras(9, 300))).toBe(false);
  });

  it("rejects a rewrite below the client char floor when the brief was long enough", () => {
    const source = paras(8, 300);
    expect(source.length).toBeGreaterThan(1800);
    expect(isTechnicalRisksClientRewriteTooThin(source, "Īss pārstāsts.")).toBe(true);
  });
});
