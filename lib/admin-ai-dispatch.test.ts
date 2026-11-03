import { beforeEach, describe, expect, it, vi } from "vitest";

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

const finalizeGeneratedComment = vi.fn(async (text: string, _opts?: unknown) => text);

vi.mock("@/lib/admin-ai-polish", () => ({
  finalizeGeneratedComment: (text: string, opts?: unknown) => finalizeGeneratedComment(text, opts),
  shouldSkipGeneratedCommentPolish: () => false,
}));

import { aiGenerateExpertText, aiGenerateTextWithVocabulary } from "@/lib/admin-ai";
import { geminiGenerateExpertText, getGeminiApiKeyFromEnv } from "@/lib/admin-gemini";
import { AiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import {
  adminGenerateExpertText,
  adminGenerateJsonText,
  adminGenerateRawTextWithWebSearch,
  adminGenerateTextWithVocabulary,
} from "@/lib/admin-ai-dispatch";
import { golfBlocks } from "@/lib/ai-eval/golf-gte-fixture";
import { buildCanonicalFactsSheet } from "@/lib/canonical-facts-sheet";

const GOLF_PROMPT = `Lauks: summary\n${buildCanonicalFactsSheet({ sourceBlocks: golfBlocks() })}`;

describe("admin-ai-dispatch self-correction retry", () => {
  it("does not pay for a second generation when only banned vocabulary appears (P13)", async () => {
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
    });
    expect(text).toBe("Šis auto pieder tai pašai saimei un ir kopts.");
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
  });

  it("retries once and returns the corrected text when an internal marker leaks", async () => {
    vi.clearAllMocks();
    vi.mocked(aiGenerateExpertText)
      .mockResolvedValueOnce("Riska kartē ķēde ir iekšā.")
      .mockResolvedValueOnce("Datos ķēde ir iekšā.");
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
    });
    expect(text).toBe("Datos ķēde ir iekšā.");
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(2);
    expect((aiGenerateExpertText as ReturnType<typeof vi.fn>).mock.calls[1][0].userPrompt).toContain(
      "Riska kartē",
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
      "**Eļļas sūkņa ass**\n2.0 TDI dzinējiem šis mezgls bieži prasa uzmanību pēc nobraukuma.",
    );
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "technical_risks",
    });
    expect(text).toContain("2.0 TDI");
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
  });

  it("shortens too-long copy with Gemini Flash instead of a second Claude call", async () => {
    vi.clearAllMocks();
    vi.mocked(getGeminiApiKeyFromEnv).mockReturnValue("gemini-key");
    const long = "Nobraukuma līkne datos ir lineāra un pretrunas nav fiksētas. ".repeat(40);
    vi.mocked(aiGenerateExpertText).mockResolvedValueOnce(long);
    vi.mocked(geminiGenerateExpertText).mockResolvedValueOnce(
      "Nobraukuma līkne datos ir lineāra un pretrunas nav fiksētas.",
    );
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
    });
    expect(text).toBe("Nobraukuma līkne datos ir lineāra un pretrunas nav fiksētas.");
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
    expect(geminiGenerateExpertText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(geminiGenerateExpertText).mock.calls[0]?.[0].userPrompt).toContain("PĀRĀK GARŠ");
  });

  it("does not Flash-shorten when the operator pasted a long comment", async () => {
    vi.clearAllMocks();
    vi.mocked(getGeminiApiKeyFromEnv).mockReturnValue("gemini-key");
    const long = "Nobraukuma līkne datos ir lineāra un pretrunas nav fiksētas. ".repeat(40);
    vi.mocked(aiGenerateExpertText).mockResolvedValueOnce(long);
    const prompt = [
      "=== OPERATORA IELĪMĒTAIS TEKSTS (pilns saturs jāsaglabā) ===",
      "z".repeat(500),
      "=== BEIGAS OPERATORA IELĪMĒTAJAM TEKSTAM ===",
      "",
      "sākotnējais prompts",
    ].join("\n");
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: prompt,
      qualityField: "generic",
    });
    expect(text).toBe(long);
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
    expect(geminiGenerateExpertText).not.toHaveBeenCalled();
  });

  it("does not pay Claude again for length when Gemini is unavailable", async () => {
    vi.clearAllMocks();
    vi.mocked(getGeminiApiKeyFromEnv).mockReturnValue(null);
    const long = "Nobraukuma līkne datos ir lineāra un pretrunas nav fiksētas. ".repeat(40);
    vi.mocked(aiGenerateExpertText).mockResolvedValueOnce(long);
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
    });
    expect(text).toBe(long);
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
    expect(geminiGenerateExpertText).not.toHaveBeenCalled();
  });

  it("j26: „nav bojājumu” ar bojājumiem lapā - viens labojums TIKAI ar Gemini, ne Claude", async () => {
    vi.clearAllMocks();
    vi.mocked(getGeminiApiKeyFromEnv).mockReturnValue("gemini-key");
    vi.mocked(aiGenerateExpertText).mockResolvedValueOnce("Avotos nav fiksētu bojājumu vai atlīdzību.");
    vi.mocked(geminiGenerateExpertText).mockResolvedValueOnce(
      "Izsolē 02.04.2024 fiksēti bojājumi (priekšpuse, sāns), summa nav norādīta.",
    );
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: GOLF_PROMPT,
      qualityField: "summary",
      modelTier: "pro",
    });
    expect(text).toMatch(/Izsolē 02\.04\.2024/);
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
    expect(geminiGenerateExpertText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(geminiGenerateExpertText).mock.calls[0]?.[0].userPrompt).toContain(CORRECTION_MARKER);
  });

  it("j26: bez Gemini atslēgas Claude atkārtojuma nav (paliek karodziņš)", async () => {
    vi.clearAllMocks();
    vi.mocked(getGeminiApiKeyFromEnv).mockReturnValue(null);
    vi.mocked(aiGenerateExpertText).mockResolvedValueOnce("Avotos nav fiksētu bojājumu vai atlīdzību.");
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: GOLF_PROMPT,
      qualityField: "summary",
      modelTier: "pro",
    });
    expect(text).toBe("Avotos nav fiksētu bojājumu vai atlīdzību.");
    expect(aiGenerateExpertText).toHaveBeenCalledTimes(1);
    expect(geminiGenerateExpertText).not.toHaveBeenCalled();
  });
});

describe("admin-ai-dispatch final Claude review", () => {
  beforeEach(() => {
    finalizeGeneratedComment.mockReset();
    finalizeGeneratedComment.mockImplementation(async (text: string) => text);
  });

  it("runs the final review after generation, including the PRO path", async () => {
    vi.clearAllMocks();
    finalizeGeneratedComment.mockImplementation(async (text: string) => `Pārskatīts: ${text}`);
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
      modelTier: "pro",
    });
    expect(finalizeGeneratedComment).toHaveBeenCalledTimes(1);
    expect(text).toBe("Pārskatīts: Šis auto pieder tai pašai saimei un ir kopts.");
    expect(aiGenerateExpertText).toHaveBeenCalledWith(
      expect.objectContaining({ skipLatvianPolish: true }),
    );
  });

  it("keeps the generated text when the final review fails", async () => {
    vi.clearAllMocks();
    finalizeGeneratedComment.mockImplementation(async (text: string) => text);
    const text = await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
    });
    expect(text).toBe("Šis auto pieder tai pašai saimei un ir kopts.");
    expect(finalizeGeneratedComment).toHaveBeenCalledTimes(1);
  });

  it("does not review JSON / raw schema extracts", async () => {
    vi.clearAllMocks();
    await adminGenerateJsonText({
      systemInstruction: "sys",
      userPrompt: '{"schema":true}',
    });
    await adminGenerateRawTextWithWebSearch({
      systemInstruction: "sys",
      userPrompt: '{"karte":true}',
      skipLatvianPolish: true,
    });
    expect(finalizeGeneratedComment).not.toHaveBeenCalled();
  });

  it("skips the inner Haiku polish so the final review is the only Sonnet pass", async () => {
    vi.clearAllMocks();
    finalizeGeneratedComment.mockImplementation(async (text: string) => text);
    await adminGenerateExpertText({
      systemInstruction: "sys",
      userPrompt: "sākotnējais prompts",
      qualityField: "generic",
      modelTier: "lite",
    });
    expect(aiGenerateExpertText).toHaveBeenCalledWith(
      expect.objectContaining({ skipLatvianPolish: true }),
    );
    expect(finalizeGeneratedComment).toHaveBeenCalledTimes(1);
  });

  it("reviews incomplete comment text and still reports incomplete", async () => {
    vi.clearAllMocks();
    vi.mocked(aiGenerateExpertText).mockRejectedValueOnce(
      new AiIncompleteCommentError("Daļējs teksts par ķēdi.", "timeout"),
    );
    finalizeGeneratedComment.mockImplementation(async (text: string) => `Pārskatīts: ${text}`);
    await expect(
      adminGenerateExpertText({
        systemInstruction: "sys",
        userPrompt: "sākotnējais prompts",
        qualityField: "generic",
      }),
    ).rejects.toMatchObject({
      name: "AiIncompleteCommentError",
      partialText: "Pārskatīts: Daļējs teksts par ķēdi.",
    });
  });
});
