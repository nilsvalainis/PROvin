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
};

/** Vieglie uzdevumi — Gemini; smagie — Claude. Izvēle nāk no admin pogas. */
export async function adminGenerateExpertText(opts: GenerateOpts): Promise<string> {
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

export async function adminGenerateTextWithVocabulary(opts: GenerateOpts): Promise<string> {
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

export async function adminGenerateTextWithWebSearch(opts: GenerateOpts): Promise<string> {
  if (isGeminiAdminTier(opts.modelTier)) {
    return geminiGenerateTextWithGoogleSearch({
      model: resolveGeminiAdminModel(opts.modelTier === "gemini-flash" ? "flash" : "pro"),
      systemInstruction: opts.systemInstruction,
      userPrompt: opts.userPrompt,
      temperature: opts.temperature,
    });
  }
  return aiGenerateTextWithWebSearch({
    model: resolveAiAdminModel(opts.modelTier),
    systemInstruction: opts.systemInstruction,
    userPrompt: opts.userPrompt,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });
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
