import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/admin-gemini", () => ({
  geminiGenerateJsonText: vi.fn(async (opts: { userPrompt: string }) => {
    const match = opts.userPrompt.match(/\{[\s\S]*\}/);
    const source = match ? (JSON.parse(match[0]) as Record<string, string>) : {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(source)) out[k] = `EN[${v}]`;
    return JSON.stringify(out);
  }),
  geminiGenerateExpertText: vi.fn(),
  geminiGenerateTextWithGoogleSearch: vi.fn(),
  geminiGenerateTextWithVocabulary: vi.fn(),
  getGeminiApiKeyFromEnv: vi.fn(() => "test-key"),
  resolveGeminiAdminModel: vi.fn(() => "gemini-model"),
}));

vi.mock("@/lib/admin-ai", () => ({
  aiGenerateJsonText: vi.fn(async () => "{}"),
  aiGenerateExpertText: vi.fn(),
  aiGenerateTextWithVocabulary: vi.fn(),
  aiGenerateTextWithWebSearch: vi.fn(),
  getAnthropicApiKeyFromEnv: vi.fn(() => null),
  resolveAiAdminModel: vi.fn(() => "claude-model"),
}));

import { geminiGenerateJsonText } from "@/lib/admin-gemini";
import { translateClientReportTexts } from "@/lib/client-report-translate";

describe("translateClientReportTexts", () => {
  it("returns an empty result without calling AI when all texts are empty", async () => {
    const result = await translateClientReportTexts({ a: "", b: "   " }, "en");
    expect(result.texts).toEqual({});
    expect(result.missingKeys).toEqual([]);
    expect(geminiGenerateJsonText).not.toHaveBeenCalled();
  });

  it("translates only non-empty keys and keeps the same key set", async () => {
    const result = await translateClientReportTexts(
      { risks: "Auto ir salona krāsojums.", empty: "" },
      "en",
    );
    expect(result.texts).toEqual({ risks: "EN[Auto ir salona krāsojums.]" });
    expect(result.missingKeys).toEqual([]);
    expect(geminiGenerateJsonText).toHaveBeenCalledTimes(1);
  });

  it("reports missing keys the model dropped instead of throwing", async () => {
    vi.mocked(geminiGenerateJsonText).mockResolvedValueOnce(JSON.stringify({ risks: "" }));
    const result = await translateClientReportTexts({ risks: "Teksts", summary: "Teksts2" }, "ru");
    expect(result.missingKeys.sort()).toEqual(["risks", "summary"]);
    expect(result.texts).toEqual({});
  });

  it("throws ai_invalid_json when the model returns unparsable output", async () => {
    vi.mocked(geminiGenerateJsonText).mockResolvedValueOnce("not json at all");
    await expect(translateClientReportTexts({ a: "Teksts" }, "en")).rejects.toThrow("ai_invalid_json");
  });

  it("passes an English system instruction naming the target language and banning the em dash", async () => {
    await translateClientReportTexts({ a: "Teksts" }, "en");
    const call = vi.mocked(geminiGenerateJsonText).mock.calls.at(-1)?.[0] as { systemInstruction: string };
    expect(call.systemInstruction).toContain("English");
    expect(call.systemInstruction).toContain("em dash");
  });

  it("passes a Russian system instruction naming the target language", async () => {
    await translateClientReportTexts({ a: "Teksts" }, "ru");
    const call = vi.mocked(geminiGenerateJsonText).mock.calls.at(-1)?.[0] as { systemInstruction: string };
    expect(call.systemInstruction).toContain("Russian");
  });

  it("passes a German system instruction naming the target language", async () => {
    await translateClientReportTexts({ a: "Teksts" }, "de");
    const call = vi.mocked(geminiGenerateJsonText).mock.calls.at(-1)?.[0] as { systemInstruction: string };
    expect(call.systemInstruction).toContain("German");
  });
});
