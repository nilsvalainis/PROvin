import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const CORRECTION_MARKER = "TAVĀ IEPRIEKŠĒJĀ ATBILDĒ IR KĻŪDA";

vi.mock("@/lib/admin-ai", () => ({
  aiGenerateExpertText: vi.fn(async (opts: { userPrompt: string }) =>
    opts.userPrompt.includes(CORRECTION_MARKER)
      ? "Šis agregāts ir tehniski uzticams pēc pieejamajiem datiem."
      : "Šis auto pieder tai pašai saimei un ir kopts.",
  ),
  aiGenerateJsonText: vi.fn(async () => "{}"),
  aiGenerateTextWithVocabulary: vi.fn(async () => "Tīrs teksts bez aizliegtiem vārdiem un bez € summām."),
  aiGenerateTextWithWebSearch: vi.fn(async () => "Tīrs teksts bez aizliegtiem vārdiem un bez € summām."),
  getAnthropicApiKeyFromEnv: vi.fn(() => "test-key"),
  resolveAiAdminModel: vi.fn(() => "claude-model"),
}));

vi.mock("@/lib/admin-gemini", () => ({
  geminiGenerateExpertText: vi.fn(),
  geminiGenerateJsonText: vi.fn(),
  geminiGenerateTextWithGoogleSearch: vi.fn(),
  geminiGenerateTextWithVocabulary: vi.fn(),
  getGeminiApiKeyFromEnv: vi.fn(() => null),
  resolveGeminiAdminModel: vi.fn(() => "gemini-model"),
}));

import { aiGenerateExpertText, aiGenerateTextWithVocabulary } from "@/lib/admin-ai";
import { adminGenerateExpertText, adminGenerateTextWithVocabulary } from "@/lib/admin-ai-dispatch";

describe("admin-ai-dispatch self-correction retry", () => {
  it("retries once and returns the corrected text when banned vocabulary appears", async () => {
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
    });
    expect(text).toBe("Šis agregāts ir tehniski uzticams pēc pieejamajiem datiem.");
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(2);
    expect((aiGenerateExpertText as ReturnType<typeof vi.fn>).mock.calls[1][0].userPrompt).toContain(
      "saime",
    );
  });

  it("does not retry when the text is already clean", async () => {
    vi.clearAllMocks();
    const text = await adminGenerateTextWithVocabulary({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
    });
    expect(text).toBe("Tīrs teksts bez aizliegtiem vārdiem un bez € summām.");
    expect(aiGenerateTextWithVocabulary).toHaveBeenCalledTimes(1);
  });

  it("does not pay for a second generation just to strip leftover Markdown asterisks", async () => {
    vi.clearAllMocks();
    vi.mocked(aiGenerateExpertText).mockResolvedValueOnce(
      "**Eļļas sūkņa ass**\n2.0 TDI dzinējiem šis mezgls ir tipisks tuvākā laika ieguldījums.",
    );
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "technical_risks",
    });
    expect(text).toContain("2.0 TDI");
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
  });
});
