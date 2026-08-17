import { describe, expect, it } from "vitest";
import { AiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import {
  CLAUDE_MODEL_SONNET,
  CLAUDE_MODEL_HAIKU,
  CLAUDE_MODEL_OPUS,
  aiFailoverModels,
  isAiTransientError,
  shouldAiModelFailover,
} from "@/lib/ai-model-failover";

describe("aiFailoverModels", () => {
  it("chains opus then sonnet then haiku", () => {
    expect(aiFailoverModels(CLAUDE_MODEL_OPUS)).toEqual([
      CLAUDE_MODEL_OPUS,
      CLAUDE_MODEL_SONNET,
      CLAUDE_MODEL_HAIKU,
    ]);
  });

  it("puts custom primary first without duplicates", () => {
    expect(aiFailoverModels(CLAUDE_MODEL_SONNET)).toEqual([
      CLAUDE_MODEL_SONNET,
      CLAUDE_MODEL_HAIKU,
    ]);
  });

  it("does not upgrade Haiku to a more expensive model", () => {
    expect(aiFailoverModels(CLAUDE_MODEL_HAIKU)).toEqual([CLAUDE_MODEL_HAIKU]);
  });
});

describe("isAiTransientError", () => {
  it("detects 503 overload", () => {
    expect(isAiTransientError(new Error("[503 Service Unavailable] overloaded"))).toBe(true);
  });

  it("detects Anthropic 529 overloaded_error", () => {
    expect(isAiTransientError(new Error("529 overloaded_error"))).toBe(true);
  });

  it("prefers SDK error status over message text", () => {
    const rateLimited = Object.assign(new Error("request failed"), { status: 429 });
    expect(isAiTransientError(rateLimited)).toBe(true);

    const badKey = Object.assign(new Error("authentication_error"), { status: 401 });
    expect(isAiTransientError(badKey)).toBe(false);
  });

  it("empty content and timeouts must not multiply billed model calls", () => {
    expect(isAiTransientError(new Error("ai_empty_content"))).toBe(false);
    expect(isAiTransientError(new Error("ai_empty_content_max_tokens"))).toBe(false);
    expect(shouldAiModelFailover(new Error("ai_empty_content"))).toBe(false);
    expect(shouldAiModelFailover(new Error("Request timed out"))).toBe(false);
    expect(shouldAiModelFailover(Object.assign(new Error("timeout"), { status: 408 }))).toBe(false);
    expect(shouldAiModelFailover(new Error("529 overloaded_error"))).toBe(true);
    expect(shouldAiModelFailover(new Error("ai_incomplete_comment"))).toBe(false);
    expect(shouldAiModelFailover(new AiIncompleteCommentError("daļa", "timeout"))).toBe(false);
  });

  it("rejects invalid API key", () => {
    expect(isAiTransientError(new Error("invalid x-api-key"))).toBe(false);
  });
});
