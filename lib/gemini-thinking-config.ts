/**
 * Gemini domāšanas konfigurācija. Atsevišķi no `admin-gemini.ts` (server-only),
 * lai to varētu pārbaudīt ar testiem.
 */

function isGemini3Model(model: string): boolean {
  return /gemini-3/i.test(model);
}

function isGemini25Model(model: string): boolean {
  return /gemini-2\.5/i.test(model);
}

export function geminiWantsThinking(model: string): boolean {
  return isGemini3Model(model) || isGemini25Model(model);
}

export type GeminiThinkingExtra =
  | { thinkingConfig: { thinkingLevel: "minimal" | "low" } }
  | { thinkingConfig: { thinkingBudget: number } }
  | Record<string, never>;

/**
 * Gemini 3 pieņem `thinkingLevel`, Gemini 2.5 — `thinkingBudget`. Abi kopā = 400
 * („You can only set only one of thinking budget and thinking level”), pēc kā
 * atkāpšanās uz konfigurāciju bez `thinkingConfig` atdod modelim NEIEROBEŽOTU
 * domāšanu: tā apēd `maxOutputTokens`, atbilde beidzas ar MAX_TOKENS bez
 * redzamā teksta, un operators saņem tukšu lauku par pilnu cenu. Tāpēc te
 * vienmēr tiek sūtīts tieši viens lauks, un „bez domāšanas” ir skaidri
 * nosaukts minimums, nevis noklusējums.
 */
export function geminiThinkingExtra(model: string, enabled: boolean): GeminiThinkingExtra {
  if (isGemini3Model(model)) {
    return { thinkingConfig: { thinkingLevel: enabled ? "low" : "minimal" } };
  }
  if (isGemini25Model(model)) {
    return { thinkingConfig: { thinkingBudget: enabled ? 512 : 0 } };
  }
  return {};
}
