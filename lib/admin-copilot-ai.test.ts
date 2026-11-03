import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin-ai", () => ({
  CLAUDE_MODEL_EXTRACT: "claude-sonnet-test",
  aiGenerateJsonWithSchema: vi.fn(),
}));

vi.mock("@/lib/admin-copilot-apply", () => ({
  buildCopilotBlocksSummary: vi.fn(() => ""),
}));

const finalizeGeneratedComment = vi.fn(async (text: string) => (text.trim() ? `LV:${text}` : text));

vi.mock("@/lib/admin-ai-polish", () => ({
  finalizeGeneratedComment: (text: string) => finalizeGeneratedComment(text),
}));

import { finalizeCopilotAiResponse } from "@/lib/admin-copilot-ai";

describe("finalizeCopilotAiResponse", () => {
  it("reviews operator Latvian prose and leaves structured actions untouched", async () => {
    const parsed = {
      reply: "Ielasīti 3 nobraukuma ieraksti.",
      clarificationNeeded: "Kurš avots?",
      actions: [
        {
          type: "upsert_mileage" as const,
          source: "autodna" as const,
          date: "01.02.2024",
          odometer: "120000",
          country: "Vācija",
          confidence: "high" as const,
        },
      ],
    };
    const out = await finalizeCopilotAiResponse(parsed);
    expect(out.reply).toBe("LV:Ielasīti 3 nobraukuma ieraksti.");
    expect(out.clarificationNeeded).toBe("LV:Kurš avots?");
    expect(out.actions).toEqual(parsed.actions);
    expect(finalizeGeneratedComment).toHaveBeenCalledTimes(2);
  });
});
