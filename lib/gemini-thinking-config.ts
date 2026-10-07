/**
 * Gemini generateContent thinking. Field names match the JS SDK / v1beta REST
 * camelCase: `generationConfig.thinkingConfig.{thinkingLevel|thinkingBudget}`.
 *
 * generateContent docs (https://ai.google.dev/gemini-api/docs/generate-content/thinking):
 * - Gemini 3: `thinkingLevel` (`minimal` | `low` | `medium` | `high`).
 *   `thinkingBudget` is deprecated there and will 400 on upcoming models.
 * - Gemini 2.5: does **not** support `thinkingLevel` (400 INVALID_ARGUMENT).
 *   Use `thinkingBudget` (Flash: 0 disables thinking; Pro cannot fully disable).
 * - Gemini 2.0 Flash: no thinking config.
 *
 * Never send both fields. Never send temperature / topP / topK (Gemini 3.6+
 * ignores them; upcoming models error). Do not silently retarget 2.5 calls
 * onto a Gemini 3 model id.
 */

export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";

/** 2.5 `thinkingBudget` when thinking is on: a small cap, not high. */
export const GEMINI_25_THINKING_BUDGET_ENABLED = 512;
/** 2.5 Flash: 0 disables thinking. 2.5 Pro cannot fully disable; 0 is the retry pass. */
export const GEMINI_25_THINKING_BUDGET_DISABLED = 0;

function isGemini3Model(model: string): boolean {
  return /gemini-3/i.test(model);
}

function isGemini25Model(model: string): boolean {
  return /gemini-2\.5/i.test(model);
}

/**
 * True when a same-model retry with thinking off is a different payload.
 * Gemini 3 is always `minimal`. 2.5 retries with budget 0 (Flash thinking off).
 */
export function geminiWantsThinking(model: string): boolean {
  return isGemini25Model(model);
}

export type GeminiThinkingExtra =
  | { thinkingConfig: { thinkingLevel: GeminiThinkingLevel } }
  | { thinkingConfig: { thinkingBudget: number } }
  | Record<string, never>;

/**
 * Always send exactly one thinking field on thinking models. Omitting the
 * config lets 2.5 run unbounded thinking, which eats `maxOutputTokens`.
 */
export function geminiThinkingExtra(model: string, enabled: boolean): GeminiThinkingExtra {
  if (isGemini3Model(model)) {
    return { thinkingConfig: { thinkingLevel: "minimal" } };
  }
  if (isGemini25Model(model)) {
    return {
      thinkingConfig: {
        thinkingBudget: enabled ? GEMINI_25_THINKING_BUDGET_ENABLED : GEMINI_25_THINKING_BUDGET_DISABLED,
      },
    };
  }
  return {};
}

export type GeminiGenerationConfigPayload = {
  maxOutputTokens: number;
  responseMimeType?: string;
  responseSchema?: unknown;
  thinkingConfig?: { thinkingLevel: GeminiThinkingLevel } | { thinkingBudget: number };
};

/**
 * Wire `generationConfig` for generateContent / streamGenerateContent.
 * Sampling fields (temperature, topP, topK) are intentionally absent.
 */
export function geminiGenerationConfigPayload(
  model: string,
  enabled: boolean,
  extra: { maxOutputTokens: number; responseMimeType?: string; responseSchema?: unknown },
): GeminiGenerationConfigPayload {
  return {
    maxOutputTokens: extra.maxOutputTokens,
    ...(extra.responseMimeType ? { responseMimeType: extra.responseMimeType } : {}),
    ...(extra.responseSchema ? { responseSchema: extra.responseSchema } : {}),
    ...geminiThinkingExtra(model, enabled),
  };
}
