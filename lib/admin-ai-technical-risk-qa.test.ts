import { describe, expect, it } from "vitest";
import {
  applySentenceRewrites,
  parseTechnicalRiskQaResult,
  qaTextLooksLeaked,
} from "@/lib/admin-ai-technical-risk-qa-parse";

describe("technical risk QA helpers", () => {
  it("rewrites only flagged sentences", () => {
    const text = "Šī automašīna ir aprīkota ar N47. Ķēde jāklausās aukstā startā.";
    const out = applySentenceRewrites(text, [
      {
        sentence: "Šī automašīna ir aprīkota ar N47.",
        reason: "kalks",
        replacement: "N47 šajā posmā tipiski prasa klausīties auksto startu.",
      },
    ]);
    expect(out).toContain("Ķēde jāklausās aukstā startā.");
    expect(out).not.toContain("aprīkota ar");
  });

  it("parses QA JSON and falls back to the original text", () => {
    const parsed = parseTechnicalRiskQaResult(
      {
        flagged: [{ sentence: "A.", reason: "nav kartē", replacement: "B." }],
        rewritten_text: "B. C.",
      },
      "A. C.",
    );
    expect(parsed.flagged).toHaveLength(1);
    expect(parsed.rewritten_text).toBe("B. C.");
    expect(parseTechnicalRiskQaResult(null, "orig")).toEqual({ flagged: [], rewritten_text: "orig" });
  });

  it("rejects QA rewritten_text that leaks instructions or D-markers", () => {
    expect(qaTextLooksLeaked("Atzīmē teikumus, kas nav kartē. Pārraksti tikai tos.")).toBe(true);
    expect(qaTextLooksLeaked("Oficiālā dīlera datos (D12) eļļas maiņa.")).toBe(true);
    expect(qaTextLooksLeaked("Ķēde ir aizmugurē.")).toBe(false);
    const parsed = parseTechnicalRiskQaResult(
      {
        flagged: [],
        rewritten_text: "Atzīmē teikumus, kas nav kartē. Pārraksti tikai tos.",
      },
      "Ķēde ir aizmugurē.",
    );
    expect(parsed.rewritten_text).toBe("Ķēde ir aizmugurē.");
  });
});
