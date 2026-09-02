import { describe, expect, it } from "vitest";
import {
  applyGeneratedAdminAiText,
  formatAdminAiFetchError,
  readGeneratedAdminAiText,
} from "@/lib/admin-ai-client-errors";

describe("readGeneratedAdminAiText", () => {
  it("treats HTTP 200 with empty text as a visible error, not a silent no-op", () => {
    const result = readGeneratedAdminAiText({ ok: true, status: 200 }, { text: "  " }, false, "AI: neizdevās");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/tukšu atbildi/i);
    }
  });

  it("returns trimmed text on success", () => {
    const result = readGeneratedAdminAiText(
      { ok: true, status: 200 },
      { text: "  **CSDD.** Teksts.  " },
      false,
      "AI: neizdevās",
    );
    expect(result).toEqual({ ok: true, text: "**CSDD.** Teksts." });
  });

  it("treats incomplete comments as an error but keeps the paid partial text", () => {
    const result = readGeneratedAdminAiText(
      { ok: false, status: 422 },
      { error: "ai_incomplete_comment", text: "**CSDD.** Sākums.", incomplete: true },
      false,
      "AI: neizdevās",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/nav pabeigts/i);
      expect(result.text).toBe("**CSDD.** Sākums.");
    }
  });

  it("applies paid partial text even when the generation is marked incomplete", () => {
    const generated = readGeneratedAdminAiText(
      { ok: false, status: 422 },
      { error: "ai_incomplete_comment", text: "**CSDD.** Sākums.", incomplete: true },
      false,
      "AI: neizdevās",
    );
    let applied = "";
    let error = "";
    const ok = applyGeneratedAdminAiText(
      generated,
      (text) => {
        applied = text;
      },
      (msg) => {
        error = msg;
      },
    );
    expect(ok).toBe(false);
    expect(applied).toBe("**CSDD.** Sākums.");
    expect(error).toMatch(/nav pabeigts/i);
  });
});

describe("formatAdminAiFetchError", () => {
  it("does not treat a rate-limit message that mentions Console as a credit shortage", () => {
    const msg = formatAdminAiFetchError(
      {
        error: "generation_failed",
        detail: "Anthropic API limits pārsniegts — uzgaidi vai pārbaudi Anthropic Console billing",
      },
      { status: 429 },
    );
    expect(msg).toMatch(/limits pārsniegts/i);
    expect(msg).not.toMatch(/nepietiek kredīta/i);
  });

  it("still maps a real Anthropic credit-balance error", () => {
    const msg = formatAdminAiFetchError(
      {
        error: "generation_failed",
        detail:
          "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to purchase credits.",
      },
      { status: 400 },
    );
    expect(msg).toMatch(/nepietiek kredīta/i);
  });
});
