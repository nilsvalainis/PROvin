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
import {
  AI_ROUTE_BUDGET_MS,
  aiBudgetAllowsRetry,
  createAiRequestBudget,
  type AiRequestBudget,
} from "@/lib/ai-request-budget";
import type { AiTextStream } from "@/lib/ai-text-stream";

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
  budget?: AiRequestBudget;
  stream?: AiTextStream;
};

/**
 * Self-correction: kritiskie pārkāpumi (aizliegts vārds, izdomāta EUR summa) izraisa
 * VIENU korekcijas pieprasījumu tam pašam modelim. Stilistiskas/garuma piezīmes (too_long,
 * hyperbolic_language u.c.) NE — tās nav vērtas otras apmaksātas ģenerācijas.
 *
 * `markdown_asterisk` te apzināti NAV: `normalizeAiExpertParagraphText` izmet *
 * pirms teksts nonāk laukā, tāpēc otrā ģenerācija maksātu naudu un laiku par
 * simbolu, ko operators nekad neredz.
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
  "tech_risks_identity_intro",
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
  routeBudgetMs: number,
  generateOnce: (opts: GenerateOpts) => Promise<string>,
): Promise<string> {
  const withBudget: GenerateOpts = {
    ...opts,
    budget: opts.budget ?? createAiRequestBudget(routeBudgetMs),
  };
  const raw = await generateOnce(withBudget);
  const field = opts.qualityField ?? "generic";
  const issues = evaluateExpertCommentQuality(raw, { field }).filter(
    (i) => i.code.startsWith("vocabulary_") || SELF_CORRECTION_RETRY_CODES.has(i.code),
  );
  if (issues.length === 0) return raw;
  if (!aiBudgetAllowsRetry(withBudget.budget)) {
    console.warn("[admin-ai-dispatch] self_correction_skipped_no_budget", {
      field,
      codes: issues.map((i) => i.code),
    });
    return raw;
  }
  console.warn("[admin-ai-dispatch] self_correction_retry", {
    field,
    codes: issues.map((i) => i.code),
  });
  try {
    return await generateOnce({
      ...withBudget,
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
      budget: opts.budget,
      stream: opts.stream,
    });
  }
  return aiGenerateExpertText({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxLen: opts.maxLen,
    maxTokens: opts.maxTokens,
    budget: opts.budget,
    stream: opts.stream,
  });
}

/** Vieglie uzdevumi — Gemini; smagie — Claude. Izvēle nāk no admin pogas. */
export async function adminGenerateExpertText(opts: GenerateOpts): Promise<string> {
  return withSelfCorrection(opts, AI_ROUTE_BUDGET_MS.text, generateExpertTextOnce);
}

async function generateTextWithVocabularyOnce(opts: GenerateOpts): Promise<string> {
  if (isGeminiAdminTier(opts.modelTier)) {
    return geminiGenerateTextWithVocabulary({
      model: resolveGeminiAdminModel(opts.modelTier === "gemini-flash" ? "flash" : "pro"),
      systemInstruction: opts.systemInstruction,
      userPrompt: opts.userPrompt,
      temperature: opts.temperature,
      budget: opts.budget,
      stream: opts.stream,
    });
  }
  return aiGenerateTextWithVocabulary({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    budget: opts.budget,
    stream: opts.stream,
  });
}

export async function adminGenerateTextWithVocabulary(opts: GenerateOpts): Promise<string> {
  return withSelfCorrection(opts, AI_ROUTE_BUDGET_MS.text, generateTextWithVocabularyOnce);
}

async function generateTextWithWebSearchOnce(opts: GenerateOpts): Promise<string> {
  if (isGeminiAdminTier(opts.modelTier)) {
    return geminiGenerateTextWithGoogleSearch({
      model: resolveGeminiAdminModel(opts.modelTier === "gemini-flash" ? "flash" : "pro"),
      systemInstruction: opts.systemInstruction,
      userPrompt: opts.userPrompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxTokens,
      budget: opts.budget,
      stream: opts.stream,
    });
  }
  return aiGenerateTextWithWebSearch({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    maxSearches: opts.maxSearches,
    budget: opts.budget,
    stream: opts.stream,
  });
}

export async function adminGenerateTextWithWebSearch(opts: GenerateOpts): Promise<string> {
  return withSelfCorrection(opts, AI_ROUTE_BUDGET_MS.webSearch, generateTextWithWebSearchOnce);
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
