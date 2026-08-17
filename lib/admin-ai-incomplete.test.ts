import { describe, expect, it } from "vitest";
import {
  AiIncompleteCommentError,
  throwIfBlankGeneratedComment,
  throwIncompleteOrEmptyComment,
} from "@/lib/admin-ai-incomplete";

describe("throwIfBlankGeneratedComment", () => {
  it("rejects whitespace-only output", () => {
    expect(() => throwIfBlankGeneratedComment("  \n")).toThrow(/ai_empty_content/);
  });

  it("returns trimmed text", () => {
    expect(throwIfBlankGeneratedComment("  **CSDD.**  ")).toBe("**CSDD.**");
  });
});

describe("throwIncompleteOrEmptyComment", () => {
  it("throws incomplete with the paid fragment when any text exists", () => {
    try {
      throwIncompleteOrEmptyComment("  **CSDD.** Sākums.  ", "timeout");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AiIncompleteCommentError);
      if (e instanceof AiIncompleteCommentError) {
        expect(e.partialText).toBe("**CSDD.** Sākums.");
        expect(e.reason).toBe("timeout");
      }
    }
  });

  it("throws empty when there is nothing to salvage", () => {
    expect(() => throwIncompleteOrEmptyComment("  ", "max_tokens")).toThrow(/ai_empty_content_max_tokens/);
    expect(() => throwIncompleteOrEmptyComment("", "timeout")).toThrow(/ai_empty_content/);
  });
});
