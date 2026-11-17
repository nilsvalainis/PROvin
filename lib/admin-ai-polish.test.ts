import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const aiGenerateText = vi.fn();

vi.mock("@/lib/admin-ai", () => ({
  CLAUDE_MODEL_OPUS: "claude-opus-test",
  CLAUDE_MODEL_SONNET: "claude-sonnet-test",
  aiGenerateText: (...args: unknown[]) => aiGenerateText(...args),
}));

import {
  finalizeGeneratedComment,
  polishLatvianTextWithAi,
  shouldSkipGeneratedCommentPolish,
} from "@/lib/admin-ai-polish";
import { AI_LV_FINAL_REVIEW_SYSTEM, AI_LV_POLISH_SYSTEM } from "@/lib/admin-ai-prompts";

describe("shouldSkipGeneratedCommentPolish", () => {
  it("skips empty text and JSON / schema extracts", () => {
    expect(shouldSkipGeneratedCommentPolish("")).toBe(true);
    expect(shouldSkipGeneratedCommentPolish("   ")).toBe(true);
    expect(shouldSkipGeneratedCommentPolish('{"reply":"ok"}')).toBe(true);
    expect(shouldSkipGeneratedCommentPolish("[\n1\n]")).toBe(true);
    expect(shouldSkipGeneratedCommentPolish("{truncated")).toBe(true);
    expect(shouldSkipGeneratedCommentPolish("Nobraukums datos ir lineārs.")).toBe(false);
  });
});

describe("finalizeGeneratedComment", () => {
  beforeEach(() => {
    aiGenerateText.mockReset();
  });

  it("runs an Opus final review and returns the polished text", async () => {
    aiGenerateText.mockResolvedValueOnce("Labots komentārs par ķēdi.");
    await expect(finalizeGeneratedComment("Slikts komentars par kedi.")).resolves.toBe(
      "Labots komentārs par ķēdi.",
    );
    expect(aiGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-test",
        systemInstruction: AI_LV_FINAL_REVIEW_SYSTEM,
        skipLatvianPolish: true,
      }),
    );
  });

  it("keeps the manual grammar button on Sonnet", async () => {
    aiGenerateText.mockResolvedValueOnce("Gramatika labota.");
    await expect(polishLatvianTextWithAi("Gramatika labota")).resolves.toBe("Gramatika labota.");
    expect(aiGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-test",
        systemInstruction: AI_LV_POLISH_SYSTEM,
      }),
    );
  });

  it("returns the original text when the review call fails", async () => {
    aiGenerateText.mockRejectedValueOnce(new Error("missing_ai_key"));
    await expect(finalizeGeneratedComment("Oriģināls teksts paliek.")).resolves.toBe(
      "Oriģināls teksts paliek.",
    );
  });

  it("does not send JSON payloads to the review model", async () => {
    const json = '{"odometer":"120000","incidents":[]}';
    await expect(finalizeGeneratedComment(json)).resolves.toBe(json);
    expect(aiGenerateText).not.toHaveBeenCalled();
  });

  it("honors skip and exhausted budget without calling the model", async () => {
    await expect(finalizeGeneratedComment("Teksts paliek.", { skip: true })).resolves.toBe(
      "Teksts paliek.",
    );
    await expect(
      finalizeGeneratedComment("Teksts paliek.", { budget: { endsAt: Date.now() - 1 } }),
    ).resolves.toBe("Teksts paliek.");
    expect(aiGenerateText).not.toHaveBeenCalled();
  });
});
