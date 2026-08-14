import { describe, expect, it } from "vitest";
import { readGeneratedAdminAiText } from "@/lib/admin-ai-client-errors";

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
});
