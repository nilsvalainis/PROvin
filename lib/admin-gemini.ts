import "server-only";

import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";
import {
  GEMINI_MODEL_FLASH,
  GEMINI_MODEL_LEGACY_FLASH,
  GEMINI_MODEL_PRO,
  geminiErrorMessage,
  geminiFailoverModels,
  isGeminiTransientError,
  isTransientHttpStatus,
} from "@/lib/gemini-model-failover";
import type { GeminiAdminModelTier } from "@/lib/gemini-admin-model-tier";
import { recordAiUsage } from "@/lib/ai-usage-meter";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import {
  applyProvinReportCopyVocabulary,
  normalizeProvinExpertAiComment,
} from "@/lib/source-summary-comment-format";

export {
  GEMINI_MODEL_FLASH,
  GEMINI_MODEL_LEGACY_FLASH,
  GEMINI_MODEL_PRO,
  geminiFailoverModels,
  isGeminiTransientError,
} from "@/lib/gemini-model-failover";
export type { GeminiAdminModelTier } from "@/lib/gemini-admin-model-tier";
export { parseGeminiModelTier } from "@/lib/gemini-admin-model-tier";

/** Admin izvēlētais modelis — Pro vai Flash (bezmaksas/ātrāks tier). */
export function resolveGeminiAdminModel(tier?: GeminiAdminModelTier | null): string {
  return tier === "flash" ? GEMINI_MODEL_FLASH : GEMINI_MODEL_PRO;
}

/** @deprecated Lietot GEMINI_MODEL_FLASH. */
export const GEMINI_MODEL_FLASH_FALLBACK = GEMINI_MODEL_FLASH;

const LOG_PREFIX = "[admin-gemini]";
/** Pilna modeļu kārta katrā retry raundā; starp raundiem — exponential backoff. */
const FAILOVER_BACKOFF_MS = [0, 1_000, 2_500] as const;

export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGemini3Model(model: string): boolean {
  return /gemini-3/i.test(model);
}

function geminiThinkingExtra(model: string): { thinkingConfig: { thinkingLevel: "low" } } | Record<string, never> {
  return isGemini3Model(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {};
}

function isGeminiThinkingUnsupported(e: unknown): boolean {
  const msg = geminiErrorMessage(e);
  return /400|INVALID_ARGUMENT|thinkingConfig|thinking_level|thinkingLevel/i.test(msg);
}

type GeminiUsageMeta = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
};

function recordGeminiUsage(model: string, meta: GeminiUsageMeta | undefined | null): void {
  if (!meta) return;
  const prompt = meta.promptTokenCount ?? 0;
  const cached = meta.cachedContentTokenCount ?? 0;
  recordAiUsage({
    provider: "google",
    model,
    inputTokens: Math.max(0, prompt - cached),
    outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
    cacheReadInputTokens: cached,
  });
}

/** Izvelk lasāmu kļūdu no Google Generative AI SDK / fetch atbildes. */
export function formatGeminiSdkError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message.trim();
    if (/404.*models\/gemini|is not found for API version/i.test(msg)) {
      return `Gemini modelis nav pieejams (${msg.match(/models\/[^\s:]+/)?.[0] ?? "model"}) — izmanto gemini-3-flash-preview / gemini-2.5-flash`;
    }
    if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) {
      return "Gemini API kvota pārsniegta — uzgaidi vai pārbaudi Google AI Studio billing";
    }
    if (/503|high\s+demand|SERVICE_UNAVAILABLE/i.test(msg)) {
      return "Gemini īslaicīgi pārslogots — mēģini vēlreiz pēc brīža";
    }
    if (/API key not valid|API_KEY_INVALID|invalid.*api.?key/i.test(msg)) {
      return "Nederīga GEMINI_API_KEY";
    }
    return msg || "unknown";
  }
  return "unknown";
}

/**
 * Mēģina `run(model)` pa failover modeļiem; pagaidu kļūdās pārslēdzas bez lietotāja kļūdas.
 * Līdz 3 raundi × 3 modeļi (Pro → Flash → 2.0 Flash) ar backoff.
 */
export async function runGeminiWithModelFailover<T>(opts: {
  primaryModel: string;
  logLabel?: string;
  run: (model: string) => Promise<T>;
}): Promise<T> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  const models = geminiFailoverModels(opts.primaryModel);
  let lastTransient: unknown = null;
  const startedAt = Date.now();

  for (let round = 0; round < FAILOVER_BACKOFF_MS.length; round++) {
    const delayMs = FAILOVER_BACKOFF_MS[round];
    if (delayMs > 0) {
      console.warn(`${LOG_PREFIX} backoff_retry`, {
        label: opts.logLabel ?? "gemini",
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        round,
        delayMs,
        models,
      });
      await sleep(delayMs);
    }

    for (const model of models) {
      try {
        const result = await opts.run(model);
        console.info(`${LOG_PREFIX} ok`, {
          label: opts.logLabel ?? "gemini",
          promptVersion: PROVIN_AI_PROMPT_VERSION,
          primary: opts.primaryModel,
          used: model,
          failover: model !== opts.primaryModel,
          latencyMs: Date.now() - startedAt,
        });
        return result;
      } catch (e) {
        if (!isGeminiTransientError(e)) {
          throw new Error(formatGeminiSdkError(e));
        }
        lastTransient = e;
        console.warn(`${LOG_PREFIX} transient_error`, {
          label: opts.logLabel ?? "gemini",
          promptVersion: PROVIN_AI_PROMPT_VERSION,
          round,
          model,
          message: geminiErrorMessage(e).slice(0, 240),
        });
      }
    }
  }

  throw new Error(formatGeminiSdkError(lastTransient ?? new Error("gemini_unavailable")));
}

export type GeminiUserPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** JSON Schema priekš Gemini Structured Outputs (responseSchema). */
export type GeminiJsonSchema = Schema;

async function geminiGenerateJsonFromPartsOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    parts: GeminiUserPart[];
    temperature?: number;
    responseSchema?: GeminiJsonSchema;
  },
): Promise<string> {
  const run = async (withThinking: boolean) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: opts.model,
      systemInstruction: opts.systemInstruction,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: opts.parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        responseMimeType: "application/json",
        ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
        ...(withThinking ? geminiThinkingExtra(opts.model) : {}),
      } as never,
    });
    const text = result.response.text()?.trim();
    if (!text) throw new Error("gemini_empty_content");
    recordGeminiUsage(opts.model, result.response.usageMetadata);
    return text;
  };
  try {
    return await run(isGemini3Model(opts.model));
  } catch (e) {
    if (isGemini3Model(opts.model) && isGeminiThinkingUnsupported(e)) {
      return await run(false);
    }
    throw e;
  }
}

/** Strukturēta JSON atbilde (responseMimeType application/json). */
export async function geminiGenerateJsonText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  /** Papildus daļas (piem. inline PDF) pirms `userPrompt` teksta. */
  extraParts?: GeminiUserPart[];
}): Promise<string> {
  const parts: GeminiUserPart[] = [...(opts.extraParts ?? []), { text: opts.userPrompt }];
  return geminiGenerateJsonFromParts({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
    parts,
    temperature: opts.temperature,
  });
}

/**
 * JSON ģenerēšana ar modeļu failover (2.5 flash ↔ pro ↔ 2.0 flash) un backoff.
 */
export async function geminiGenerateJsonFromParts(opts: {
  model: string;
  systemInstruction: string;
  parts: GeminiUserPart[];
  temperature?: number;
  responseSchema?: GeminiJsonSchema;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  return runGeminiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "json",
    run: (model) => geminiGenerateJsonFromPartsOnce(key, { ...opts, model }),
  });
}

/** Structured Outputs — obligāts JSON atbilstoši responseSchema. */
export async function geminiGenerateJsonWithSchema(opts: {
  model: string;
  systemInstruction: string;
  parts: GeminiUserPart[];
  responseSchema: GeminiJsonSchema;
  temperature?: number;
}): Promise<string> {
  return geminiGenerateJsonFromParts({
    ...opts,
    temperature: opts.temperature ?? 0,
  });
}

async function geminiGenerateTextOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
  },
): Promise<string> {
  const run = async (withThinking: boolean) => {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: opts.model,
      systemInstruction: opts.systemInstruction,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.35,
        ...(withThinking ? geminiThinkingExtra(opts.model) : {}),
      } as never,
    });
    const text = result.response.text()?.trim();
    if (!text) throw new Error("gemini_empty_content");
    recordGeminiUsage(opts.model, result.response.usageMetadata);
    return text;
  };
  try {
    return await run(isGemini3Model(opts.model));
  } catch (e) {
    if (isGemini3Model(opts.model) && isGeminiThinkingUnsupported(e)) {
      return await run(false);
    }
    throw e;
  }
}

/** Brīva teksta ģenerēšana ar automātisku modeļu failover (503 u.c.). */
export async function geminiGenerateText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  return runGeminiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "text",
    run: (model) => geminiGenerateTextOnce(key, { ...opts, model }),
  });
}

/** Eksperta PDF komentāri — pēc ģenerēšanas normalizē vārdu krājumu un rindkopu formātu. */
export async function geminiGenerateExpertText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxLen?: number;
}): Promise<string> {
  const raw = await geminiGenerateText(opts);
  return normalizeProvinExpertAiComment(raw, opts.maxLen ?? 2400);
}

/** Vārdu krājums bez rindkopu pārformatēšanas — e-pasts, checklist u.c. */
export async function geminiGenerateTextWithVocabulary(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const raw = await geminiGenerateText(opts);
  return applyProvinReportCopyVocabulary(raw);
}

type GenerateContentApiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
  usageMetadata?: GeminiUsageMeta;
};

async function geminiGenerateTextWithGoogleSearchOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
  },
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(key)}`;
  const toolVariants: Record<string, unknown>[][] = [[{ google_search: {} }], [{ googleSearch: {} }]];
  const thinkingPasses = isGemini3Model(opts.model) ? [true, false] : [false];

  let lastErr = "gemini_grounding_failed";
  for (const withThinking of thinkingPasses) {
    for (const tools of toolVariants) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
          tools,
          generationConfig: {
            temperature: opts.temperature ?? 0.35,
            ...(withThinking ? geminiThinkingExtra(opts.model) : {}),
          },
        }),
      });
      const raw = (await res.json()) as GenerateContentApiResponse;
      if (!res.ok) {
        lastErr = raw.error?.message?.trim() || `http_${res.status}`;
        if (isTransientHttpStatus(res.status)) {
          throw new Error(`[${res.status} Service Unavailable] ${lastErr}`);
        }
        continue;
      }
      const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) {
        recordGeminiUsage(opts.model, raw.usageMetadata);
        return text;
      }
      lastErr = "gemini_empty_content";
    }
  }
  throw new Error(lastErr);
}

/** Google Search Grounding — REST v1beta ar modeļu failover. */
export async function geminiGenerateTextWithGoogleSearch(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  return runGeminiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "grounding",
    run: (model) => geminiGenerateTextWithGoogleSearchOnce(key, { ...opts, model }),
  });
}
