import { describe, expect, it } from "vitest";
import {
  applyProvinReportCopyVocabulary,
  normalizeProvinExpertGeminiComment,
} from "@/lib/source-summary-comment-format";

describe("applyProvinReportCopyVocabulary", () => {
  it("replaces automobīlis forms with automašīna", () => {
    expect(applyProvinReportCopyVocabulary("Šis automobīlis ir labs.")).toBe("Šis automašīna ir labs.");
    expect(applyProvinReportCopyVocabulary("Automobīļa vēsture.")).toBe("Automašīnas vēsture.");
  });
});

describe("normalizeProvinExpertGeminiComment", () => {
  it("strips leading dash from paragraph openers and keeps bold hooks", () => {
    const raw = `- **Nobraukums.** Automašīna ar **120 000 km**.\n\n- Otrā rindkopa bez treknraksta.`;
    const out = normalizeProvinExpertGeminiComment(raw);
    expect(out).toContain("**Nobraukums.**");
    expect(out).not.toMatch(/^-\s/m);
    expect(out).not.toMatch(/\n\n-\s/);
  });

  it("replaces automobīlis inside normalized paragraphs", () => {
    const out = normalizeProvinExpertGeminiComment("**Tests.** Šis automobīlis ir ok.");
    expect(out).toContain("automašīna");
    expect(out).not.toContain("automobīlis");
  });
});
