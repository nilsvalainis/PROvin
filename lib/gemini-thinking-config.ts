/**
 * Gemini generateContent thinking. Field names match the JS SDK / v1beta REST
 * camelCase: `generationConfig.thinkingConfig.thinkingLevel`.
 *
 * Do not send `thinkingBudget` (upcoming models return 400 INVALID_ARGUMENT;
 * it is no longer remapped to thinking_level) and do not send temperature /
 * topP / topK (ignored since Gemini 3.6 Flash; upcoming models error).
 *
 * Supported levels for models this repo actually calls
 * (https://ai.google.dev/gemini-api/docs/thinking):
 * - gemini-3-flash-preview: minimal, low, medium, high
 * - gemini-2.5-pro / gemini-2.5-flash: low, medium, high (no `minimal`)
 * - gemini-2.0-flash: no thinking config
 */

export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";

/** Former 2.5 `thinkingBudget` when thinking was on: a small cap, not high. */
export const GEMINI_25_THINKING_BUDGET_ENABLED = 512;
/** Former 2.5 `thinkingBudget` when thinking was off. */
export const GEMINI_25_THINKING_BUDGET_DISABLED = 0;

function isGemini3Model(model: string): boolean {
  return /gemini-3/i.test(model);
}

function isGemini25Model(model: string): boolean {
  return /gemini-2\.5/i.test(model);
}

function lowestThinkingLevel(model: string): GeminiThinkingLevel {
  return isGemini3Model(model) ? "minimal" : "low";
}

/**
 * Map a former numeric thinking_budget onto a thinking_level this model accepts.
 *
 * Gemini 3 Flash previously exhausted `maxOutputTokens` at `low` and returned an
 * empty paid field, so that family stays at `minimal` regardless of budget.
 * Gemini 2.5 has no `minimal`; budget 0 (thinking off) and 512 (small cap)
 * both become `low`. Larger historical budgets become medium/high.
 */
export function geminiThinkingLevelForBudget(model: string, budget: number): GeminiThinkingLevel {
  if (isGemini3Model(model)) return "minimal";
  if (budget <= 0) return lowestThinkingLevel(model);
  if (budget <= 1024) return "low";
  if (budget <= 8192) return "medium";
  return "high";
}

/**
 * True only when the enabled/disabled configs actually differ, so a same-model
 * retry is worth a second paid request. Gemini 3 is always `minimal`; 2.5 is
 * always `low` now that budget 0 cannot disable thinking.
 */
export function geminiWantsThinking(model: string): boolean {
  return JSON.stringify(geminiThinkingExtra(model, true)) !== JSON.stringify(geminiThinkingExtra(model, false));
}

export type GeminiThinkingExtra =
  | { thinkingConfig: { thinkingLevel: GeminiThinkingLevel } }
  | Record<string, never>;

/**
 * Always send exactly one thinking field, never omit the config on thinking
 * models: an empty config lets the model run unbounded thinking, which eats
 * `maxOutputTokens` and returns MAX_TOKENS with no visible text.
 */
export function geminiThinkingExtra(model: string, enabled: boolean): GeminiThinkingExtra {
  if (isGemini3Model(model)) {
    return { thinkingConfig: { thinkingLevel: "minimal" } };
  }
  if (isGemini25Model(model)) {
    const budget = enabled ? GEMINI_25_THINKING_BUDGET_ENABLED : GEMINI_25_THINKING_BUDGET_DISABLED;
    return { thinkingConfig: { thinkingLevel: geminiThinkingLevelForBudget(model, budget) } };
  }
  return {};
}
