import { describe, expect, it } from "vitest";
import {
  applyAdminAiSseDataLine,
  applyGeneratedAdminAiText,
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

  it("reads comments when text is absent", () => {
    const result = readGeneratedAdminAiText(
      { ok: true, status: 200 },
      { comments: "  Tirgus komentārs.  " },
      false,
      "AI: neizdevās",
    );
    expect(result).toEqual({ ok: true, text: "Tirgus komentārs." });
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

  it("treats an error code on HTTP 200 as a visible failure, keeping any paid text", () => {
    const result = readGeneratedAdminAiText(
      { ok: true, status: 200 },
      { error: "empty_order_context", text: "" },
      false,
      "AI: neizdevās",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/avotu datu/i);
    }
  });
});

describe("applyAdminAiSseDataLine", () => {
  it("keeps the latest streamed text", () => {
    const acc = { text: "", last: {} as { done?: boolean } };
    applyAdminAiSseDataLine(JSON.stringify({ text: "**A.**" }), acc);
    applyAdminAiSseDataLine(JSON.stringify({ text: "**A.** **B.**", done: true }), acc);
    expect(acc.text).toBe("**A.** **B.**");
    expect(acc.last.done).toBe(true);
  });

  it("uses comments when the JSON agent has not sent text yet", () => {
    const acc = { text: "", last: {} };
    applyAdminAiSseDataLine(JSON.stringify({ comments: "Tirgū **12** dienas." }), acc);
    expect(acc.text).toBe("Tirgū **12** dienas.");
  });
});
