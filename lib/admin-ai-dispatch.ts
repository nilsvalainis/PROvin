import "server-only";

import {
  aiGenerateExpertText,
  aiGenerateJsonText,
  aiGenerateTextWithVocabulary,
  aiGenerateTextWithWebSearch,
  getAnthropicApiKeyFromEnv,
  resolveAiAdminModel,
} from "@/lib/admin-ai";
import {
  geminiGenerateExpertText,
  geminiGenerateJsonText,
  geminiGenerateTextWithGoogleSearch,
  geminiGenerateTextWithVocabulary,
  getGeminiApiKeyFromEnv,
  resolveGeminiAdminModel,
} from "@/lib/admin-gemini";
import { isGeminiAdminTier, type AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import {
  evaluateExpertCommentQuality,
  type CommentQualityIssue,
  type CommentQualityOptions,
} from "@/lib/ai-eval/comment-quality";

export { isGeminiAdminTier };

export function hasAnyAdminAiProviderKey(): boolean {
  return Boolean(getAnthropicApiKeyFromEnv() || getGeminiApiKeyFromEnv());
}

type GenerateOpts = {
  modelTier?: AiAdminModelTier | null;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxLen?: number;
  maxTokens?: number;
  maxSearches?: number;
  /** Lauka tips priekš self-correction pārbaudes (noklusējums: "generic"). */
  qualityField?: CommentQualityOptions["field"];
};

/**
 * Self-correction: kritiskie pārkāpumi (aizliegts vārds, izdomāta EUR summa) izraisa
 * VIENU korekcijas pieprasījumu tam pašam modelim. Stilistiskas/garuma piezīmes (too_long,
 * hyperbolic_language u.c.) NE — tās nav vērtas otras apmaksātas ģenerācijas.
 */
const SELF_CORRECTION_RETRY_CODES = new Set([
  "vocabulary_automobilis",
  "vocabulary_saime",
  "vocabulary_baltija",
  "vocabulary_injektori",
  "vocabulary_videjs_risks",
  "vocabulary_kontrolpunkts",
  "invented_repair_eur",
  "summary_price",
]);

function buildSelfCorrectionPrompt(
  originalPrompt: string,
  priorText: string,
  issues: CommentQualityIssue[],
): string {
  const violations = issues.map((i) => `- ${i.message}`).join("\n");
  return `${originalPrompt}

---

TAVĀ IEPRIEKŠĒJĀ ATBILDĒ IR KĻŪDA(-AS):
${violations}

Iepriekšējā atbilde (konteksts, NEATKĀRTO burtiski):
${priorText}

Uzrakstī PILNU teksta versiju no jauna, novēršot minētās kļūdas un saglabājot visu tehnisko precizitāti un pārējo saturu.`;
}

async function withSelfCorrection(
  opts: GenerateOpts,
  generateOnce: (opts: GenerateOpts) => Promise<string>,
): Promise<string> {
  const raw = await generateOnce(opts);
  const field = opts.qualityField ?? "generic";
  const issues = evaluateExpertCommentQuality(raw, { field }).filter((i) =>
    SELF_CORRECTION_RETRY_CODES.has(i.code),
  );
  if (issues.length === 0) return raw;
  console.warn("[admin-ai-dispatch] self_correction_retry", {
    field,
    codes: issues.map((i) => i.code),
  });
  try {
    return await generateOnce({
      ...opts,
      userPrompt: buildSelfCorrectionPrompt(opts.userPrompt, raw, issues),
    });
  } catch {
    return raw;
  }
}

async function generateExpertTextOnce(opts: GenerateOpts): Promise<string> {
  if (isGeminiAdminTier(opts.modelTier)) {
    return geminiGenerateExpertText({
      model: resolveGeminiAdminModel(opts.modelTier === "gemini-flash" ? "flash" : "pro"),
      systemInstruction: opts.systemInstruction,
      userPrompt: opts.userPrompt,
      temperature: opts.temperature,
      maxLen: opts.maxLen,
    });
  }
  return aiGenerateExpertText({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxLen: opts.maxLen,
    maxTokens: opts.maxTokens,
  });
}

/** Vieglie uzdevumi — Gemini; smagie — Claude. Izvēle nāk no admin pogas. */
export async function adminGenerateExpertText(opts: GenerateOpts): Promise<string> {
  return withSelfCorrection(opts, generateExpertTextOnce);
}

async function generateTextWithVocabularyOnce(opts: GenerateOpts): Promise<string> {
  if (isGeminiAdminTier(opts.modelTier)) {
    return geminiGenerateTextWithVocabulary({
      model: resolveGeminiAdminModel(opts.modelTier === "gemini-flash" ? "flash" : "pro"),
      systemInstruction: opts.systemInstruction,
      userPrompt: opts.userPrompt,
      temperature: opts.temperature,
    });
  }
  return aiGenerateTextWithVocabulary({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });
}

export async function adminGenerateTextWithVocabulary(opts: GenerateOpts): Promise<string> {
  return withSelfCorrection(opts, generateTextWithVocabularyOnce);
}

async function generateTextWithWebSearchOnce(opts: GenerateOpts): Promise<string> {
  if (isGeminiAdminTier(opts.modelTier)) {
    return geminiGenerateTextWithGoogleSearch({
      model: resolveGeminiAdminModel(opts.modelTier === "gemini-flash" ? "flash" : "pro"),
      systemInstruction: opts.systemInstruction,
      userPrompt: opts.userPrompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
    });
  }
  return aiGenerateTextWithWebSearch({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    maxSearches: opts.maxSearches,
  });
}

export async function adminGenerateTextWithWebSearch(opts: GenerateOpts): Promise<string> {
  return withSelfCorrection(opts, generateTextWithWebSearchOnce);
}

export async function adminGenerateJsonText(opts: GenerateOpts): Promise<string> {
  if (isGeminiAdminTier(opts.modelTier)) {
    return geminiGenerateJsonText({
      model: resolveGeminiAdminModel(opts.modelTier === "gemini-flash" ? "flash" : "pro"),
      systemInstruction: opts.systemInstruction,
      userPrompt: opts.userPrompt,
      temperature: opts.temperature,
    });
  }
  return aiGenerateJsonText({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });
}
