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
  AiIncompleteCommentError,
  isAiIncompleteCommentError,
  throwIfBlankGeneratedComment,
  throwIncompleteOrEmptyComment,
} from "@/lib/admin-ai-incomplete";
import {
  applyProvinReportCopyVocabulary,
  normalizeProvinExpertAiComment,
} from "@/lib/source-summary-comment-format";
import { liveAdminCommentFromPartialJson } from "@/lib/admin-ai-json-live-text";
import { emitAiCommentDelta, flushAiCommentDelta } from "@/lib/admin-ai-text-sink";

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
/** Starp lētāku failover modeli — viena pauze, bez atkārtotas primārās raundas. */
const FAILOVER_STEP_MS = 800;

export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Komentāru maršrutu `maxDuration` ir 90s — nogrist ar rezervi atbildes noformēšanai. */
const TEXT_REQUEST_TIMEOUT_MS = 88_000;
/** Web search aģenti — maršruti ar `maxDuration = 120`. */
const SEARCH_REQUEST_TIMEOUT_MS = 105_000;
/** Thinking + redzamais teksts dala šo limitu; bez tā 2.5/3 thinking apēd izeju. */
const GEMINI_MAX_OUTPUT_TOKENS = 8192;

function isGemini3Model(model: string): boolean {
  return /gemini-3/i.test(model);
}

function isGemini25Model(model: string): boolean {
  return /gemini-2\.5/i.test(model);
}

function geminiThinkingExtra(
  model: string,
  enabled: boolean,
): { thinkingConfig: { thinkingLevel?: "low"; thinkingBudget: number } } | Record<string, never> {
  if (!enabled) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }
  if (isGemini3Model(model)) {
    return { thinkingConfig: { thinkingLevel: "low", thinkingBudget: 512 } };
  }
  if (isGemini25Model(model)) {
    return { thinkingConfig: { thinkingBudget: 512 } };
  }
  return {};
}

function isAbortError(e: unknown): boolean {
  const msg = geminiErrorMessage(e);
  return (e instanceof Error && e.name === "AbortError") || /aborted|abort/i.test(msg);
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
    if (/gemini_empty_content/i.test(msg)) {
      return "Gemini atgrieza tukšu atbildi — mēģini vēlreiz";
    }
    if (/ai_incomplete_comment/i.test(msg)) {
      return "Gemini komentārs nav pabeigts — tokeni ir apmaksāti. Mēģini vēlreiz, lai pabeigtu.";
    }
    if (/timeout|ETIMEDOUT|timed\s*out|DEADLINE_EXCEEDED|aborted/i.test(msg)) {
      return "Gemini pieprasījums pārsniedza laika limitu — mēģini vēlreiz";
    }
    return msg || "unknown";
  }
  return "unknown";
}

/**
 * Mēģina `run(model)` pa failover ķēdi vienu reizi (Pro → Flash → 2.5 Flash).
 * Vecais 3 raundu cikls pēc timeout vēlreiz palaida to pašu dārgo modeli.
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

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    if (i > 0) await sleep(FAILOVER_STEP_MS);
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
      if (isAiIncompleteCommentError(e)) throw e;
      if (
        !isGeminiTransientError(e) ||
        /timeout|ETIMEDOUT|timed\s*out|DEADLINE_EXCEEDED|aborted|ai_incomplete_comment/i.test(
          geminiErrorMessage(e),
        )
      ) {
        throw new Error(formatGeminiSdkError(e));
      }
      lastTransient = e;
      console.warn(`${LOG_PREFIX} transient_error`, {
        label: opts.logLabel ?? "gemini",
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        model,
        message: geminiErrorMessage(e).slice(0, 240),
      });
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
  try {
    return await geminiStreamGenerateJson(key, opts, false);
  } catch (e) {
    if (isAiIncompleteCommentError(e)) throw e;
    if (isGeminiThinkingUnsupported(e)) {
      return await geminiStreamGenerateJson(key, opts, true);
    }
    throw e;
  }
}

async function geminiStreamGenerateJson(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    parts: GeminiUserPart[];
    temperature?: number;
    responseSchema?: GeminiJsonSchema;
  },
  withThinking: boolean,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
  });
  let partial = "";
  try {
    const streaming = await model.generateContentStream(
      {
        contents: [{ role: "user", parts: opts.parts }],
        generationConfig: {
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
          ...geminiThinkingExtra(opts.model, withThinking),
        } as never,
      },
      { timeout: TEXT_REQUEST_TIMEOUT_MS },
    );
    for await (const chunk of streaming.stream) {
      partial += geminiVisibleTextFromSdkChunk(chunk as never);
      const live = liveAdminCommentFromPartialJson(partial);
      if (live) emitAiCommentDelta(live);
    }
    const response = await streaming.response;
    recordGeminiUsage(opts.model, response.usageMetadata);
    const text =
      geminiVisibleTextFromSdkChunk(response as never).trim() || partial.trim();
    const finishReason = (response as { candidates?: { finishReason?: string }[] }).candidates?.[0]
      ?.finishReason;
    if (geminiFinishIsTruncated(finishReason)) {
      throwIncompleteOrEmptyComment(text, "max_tokens");
    }
    if (!text) throw new Error("gemini_empty_content");
    const live = liveAdminCommentFromPartialJson(text);
    if (live) emitAiCommentDelta(live, true);
    flushAiCommentDelta();
    return text;
  } catch (e) {
    flushAiCommentDelta();
    if (isAiIncompleteCommentError(e)) throw e;
    const salvaged = partial.trim();
    if (salvaged) {
      const live = liveAdminCommentFromPartialJson(salvaged);
      if (live) emitAiCommentDelta(live, true);
      console.warn(`${LOG_PREFIX} partial_text_salvaged`, {
        label: "json",
        model: opts.model,
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        chars: salvaged.length,
        message: geminiErrorMessage(e).slice(0, 240),
      });
      throw new AiIncompleteCommentError(salvaged, "timeout");
    }
    if (isAbortError(e)) throw new Error("timeout");
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
 * JSON ģenerēšana ar modeļu failover (Flash → 2.5 Flash → 2.0 Flash), vienu reizi.
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

type GeminiContentPart = { text?: string; thought?: boolean };

function geminiFinishIsTruncated(finishReason: string | undefined): boolean {
  return /MAX_TOKENS|LENGTH/i.test(finishReason ?? "");
}

function geminiVisibleTextFromParts(parts: GeminiContentPart[] | undefined): string {
  if (!parts?.length) return "";
  return parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text!)
    .join("");
}

function geminiVisibleTextFromSdkChunk(chunk: {
  candidates?: { content?: { parts?: GeminiContentPart[] } }[];
  text?: () => string;
}): string {
  const fromParts = geminiVisibleTextFromParts(chunk.candidates?.[0]?.content?.parts);
  if (fromParts) return fromParts;
  try {
    return chunk.text?.() ?? "";
  } catch {
    return "";
  }
}

/**
 * Straumē tekstu. Timeout/pārtraukumā jau ģenerētais (un apmaksātais) teksts
 * tiek atgriezts, nevis izmests.
 */
async function geminiStreamGenerateText(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
  },
  withThinking: boolean,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
  });
  let partial = "";
  try {
    const streaming = await model.generateContentStream(
      {
        contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.35,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          ...geminiThinkingExtra(opts.model, withThinking),
        } as never,
      },
      { timeout: TEXT_REQUEST_TIMEOUT_MS },
    );
    for await (const chunk of streaming.stream) {
      partial += geminiVisibleTextFromSdkChunk(chunk as never);
      if (partial) emitAiCommentDelta(partial);
    }
    const response = await streaming.response;
    recordGeminiUsage(opts.model, response.usageMetadata);
    const text = geminiVisibleTextFromSdkChunk(response as never).trim() || partial.trim();
    const finishReason = (response as { candidates?: { finishReason?: string }[] }).candidates?.[0]
      ?.finishReason;
    if (geminiFinishIsTruncated(finishReason)) {
      throwIncompleteOrEmptyComment(text, "max_tokens");
    }
    if (!text) throw new Error("gemini_empty_content");
    emitAiCommentDelta(text, true);
    flushAiCommentDelta();
    return text;
  } catch (e) {
    flushAiCommentDelta();
    if (isAiIncompleteCommentError(e)) throw e;
    const salvaged = partial.trim();
    if (salvaged) {
      emitAiCommentDelta(salvaged, true);
      console.warn(`${LOG_PREFIX} partial_text_salvaged`, {
        label: "text",
        model: opts.model,
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        chars: salvaged.length,
        message: geminiErrorMessage(e).slice(0, 240),
      });
      throw new AiIncompleteCommentError(salvaged, "timeout");
    }
    if (isAbortError(e)) throw new Error("timeout");
    throw e;
  }
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
  try {
    return await geminiStreamGenerateText(key, opts, false);
  } catch (e) {
    if (isAiIncompleteCommentError(e)) throw e;
    if (isGeminiThinkingUnsupported(e)) {
      return await geminiStreamGenerateText(key, opts, true);
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
  try {
    const raw = await geminiGenerateText(opts);
    return throwIfBlankGeneratedComment(normalizeProvinExpertAiComment(raw));
  } catch (e) {
    if (isAiIncompleteCommentError(e)) {
      throw new AiIncompleteCommentError(
        throwIfBlankGeneratedComment(normalizeProvinExpertAiComment(e.partialText)),
        e.reason,
      );
    }
    throw e;
  }
}

/** Vārdu krājums bez rindkopu pārformatēšanas — e-pasts, checklist u.c. */
export async function geminiGenerateTextWithVocabulary(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  try {
    const raw = await geminiGenerateText(opts);
    return throwIfBlankGeneratedComment(applyProvinReportCopyVocabulary(raw));
  } catch (e) {
    if (isAiIncompleteCommentError(e)) {
      throw new AiIncompleteCommentError(
        throwIfBlankGeneratedComment(applyProvinReportCopyVocabulary(e.partialText)),
        e.reason,
      );
    }
    throw e;
  }
}

type GenerateContentApiResponse = {
  candidates?: { content?: { parts?: GeminiContentPart[] }; finishReason?: string }[];
  error?: { message?: string };
  usageMetadata?: GeminiUsageMeta;
};

function consumeGeminiSseBuffer(
  buf: string,
  onEvent: (json: GenerateContentApiResponse) => void,
): string {
  const normalized = buf.replace(/\r\n/g, "\n");
  const chunks = normalized.split("\n\n");
  const rest = chunks.pop() ?? "";
  for (const event of chunks) {
    for (const line of event.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        if (trimmed.startsWith("{")) {
          try {
            onEvent(JSON.parse(trimmed) as GenerateContentApiResponse);
          } catch {
            // ignore malformed chunks
          }
        }
        continue;
      }
      const json = trimmed.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      try {
        onEvent(JSON.parse(json) as GenerateContentApiResponse);
      } catch {
        // ignore malformed chunks
      }
    }
  }
  return rest;
}

async function geminiRestStreamSearchText(opts: {
  url: string;
  body: unknown;
  timeoutMs: number;
  model: string;
}): Promise<{ text: string; lastErr: string; httpStatus?: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  let partial = "";
  let usage: GeminiUsageMeta | undefined;
  let finishReason = "";
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const raw = (await res.json().catch(() => ({}))) as GenerateContentApiResponse;
      const lastErr = raw.error?.message?.trim() || `http_${res.status}`;
      return { text: "", lastErr, httpStatus: res.status };
    }
    if (!res.body) return { text: "", lastErr: "gemini_empty_content" };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      buf = consumeGeminiSseBuffer(buf, (parsed) => {
        if (parsed.usageMetadata) usage = parsed.usageMetadata;
        const fr = parsed.candidates?.[0]?.finishReason;
        if (fr) finishReason = fr;
        partial += geminiVisibleTextFromParts(parsed.candidates?.[0]?.content?.parts);
        if (partial) emitAiCommentDelta(partial);
      });
    }
    consumeGeminiSseBuffer(`${buf}\n\n`, (parsed) => {
      if (parsed.usageMetadata) usage = parsed.usageMetadata;
      const fr = parsed.candidates?.[0]?.finishReason;
      if (fr) finishReason = fr;
      partial += geminiVisibleTextFromParts(parsed.candidates?.[0]?.content?.parts);
      if (partial) emitAiCommentDelta(partial);
    });
    const text = partial.trim();
    if (text) emitAiCommentDelta(text, true);
    flushAiCommentDelta();
    if (text && usage) recordGeminiUsage(opts.model, usage);
    if (geminiFinishIsTruncated(finishReason)) {
      throwIncompleteOrEmptyComment(text, "max_tokens");
    }
    return { text, lastErr: text ? "" : "gemini_empty_content" };
  } catch (e) {
    if (isAiIncompleteCommentError(e)) throw e;
    const salvaged = partial.trim();
    if (salvaged) {
      emitAiCommentDelta(salvaged, true);
      flushAiCommentDelta();
      if (usage) recordGeminiUsage(opts.model, usage);
      console.warn(`${LOG_PREFIX} partial_text_salvaged`, {
        label: "grounding",
        model: opts.model,
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        chars: salvaged.length,
        message: geminiErrorMessage(e).slice(0, 240),
      });
      throw new AiIncompleteCommentError(salvaged, "timeout");
    }
    if (isAbortError(e)) throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function geminiGenerateTextWithGoogleSearchOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
  },
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  const toolVariants: Record<string, unknown>[][] = [[{ google_search: {} }], [{ googleSearch: {} }]];
  const thinkingPasses = [false];

  let lastErr = "gemini_grounding_failed";
  for (const withThinking of thinkingPasses) {
    for (const tools of toolVariants) {
      const result = await geminiRestStreamSearchText({
        url,
        timeoutMs: SEARCH_REQUEST_TIMEOUT_MS,
        model: opts.model,
        body: {
          systemInstruction: { parts: [{ text: opts.systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
          tools,
          generationConfig: {
            temperature: opts.temperature ?? 0.35,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            ...geminiThinkingExtra(opts.model, withThinking),
          },
        },
      });
      if (result.text) return result.text;
      lastErr = result.lastErr || lastErr;
      if (result.httpStatus && isTransientHttpStatus(result.httpStatus)) {
        throw new Error(`[${result.httpStatus} Service Unavailable] ${lastErr}`);
      }
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
