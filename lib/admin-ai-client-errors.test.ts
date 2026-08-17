import { describe, expect, it } from "vitest";
import { applyGeneratedAdminAiText, readGeneratedAdminAiText } from "@/lib/admin-ai-client-errors";

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
    const ok = applyGeneratedAdminAiText(generated, (text) => {
      applied = text;
    }, (msg) => {
      error = msg;
    });
    expect(ok).toBe(false);
    expect(applied).toBe("**CSDD.** Sākums.");
    expect(error).toMatch(/nav pabeigts/i);
  });
});
