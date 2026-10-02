import { describe, expect, it } from "vitest";
import { AiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import {
  GEMINI_MODEL_FLASH,
  GEMINI_MODEL_FLASH_25,
  GEMINI_MODEL_LEGACY_FLASH,
  shouldGeminiModelFailover,
} from "@/lib/gemini-model-failover";

describe("shouldGeminiModelFailover", () => {
  it("moves to a cheaper model when the paid answer came back empty", () => {
    expect(shouldGeminiModelFailover(new Error("gemini_empty_content"))).toBe(true);
    expect(shouldGeminiModelFailover(new Error("ai_empty_content"))).toBe(true);
    expect(shouldGeminiModelFailover(new Error("ai_empty_content_max_tokens"))).toBe(true);
  });

  it("keeps a partial paid comment on the first model", () => {
    expect(shouldGeminiModelFailover(new AiIncompleteCommentError("CSDD sākums.", "max_tokens"))).toBe(
      false,
    );
  });

  it("does not double-bill after a timeout", () => {
    expect(shouldGeminiModelFailover(new Error("timeout"))).toBe(false);
    expect(shouldGeminiModelFailover(new Error("DEADLINE_EXCEEDED"))).toBe(false);
  });

  it("still failsover on overload", () => {
    expect(shouldGeminiModelFailover(new Error("503 SERVICE_UNAVAILABLE"))).toBe(true);
    expect(shouldGeminiModelFailover(new Error(`404 models/${GEMINI_MODEL_FLASH} is not found for API version`))).toBe(
      true,
    );
    expect(GEMINI_MODEL_FLASH_25).toBe("gemini-2.5-flash");
    expect(GEMINI_MODEL_LEGACY_FLASH).toBe("gemini-2.0-flash");
  });
});
