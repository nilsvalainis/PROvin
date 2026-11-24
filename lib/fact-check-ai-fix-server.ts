import "server-only";

import { CLAUDE_MODEL_SONNET, aiGenerateText } from "@/lib/admin-ai";
import { aiErrorMessage } from "@/lib/ai-model-failover";
import type { AiRequestBudget } from "@/lib/ai-request-budget";
import { buildCanonicalFactsSheet, type CanonicalFactsInput } from "@/lib/canonical-facts-sheet";
import {
  FACT_CHECK_AI_FIX_MAX_TOKENS,
  FACT_CHECK_AI_FIX_SYSTEM,
  buildFactCheckAiFixUserPrompt,
  parseFactCheckAiFixResponse,
  type FactCheckAiFixFlag,
} from "@/lib/fact-check-ai-fix";
import type { FlashMaxReviewField, FlashMaxReviewFinding } from "@/lib/flash-max-final-review";

export type FactCheckAiFixResult = { ok: true; findings: FlashMaxReviewFinding[] } | { ok: false; error: string };

/** Viens Sonnet izsaukums vienam laukam. Bez atkārtojumiem; kļūda -> teksts paliek, kā bija. */
export async function runFactCheckAiFix(
  input: {
    field: FlashMaxReviewField;
    flags: FactCheckAiFixFlag[];
    facts: CanonicalFactsInput;
    budget?: AiRequestBudget;
  },
  generate: typeof aiGenerateText = aiGenerateText,
): Promise<FactCheckAiFixResult> {
  if (!input.field.text.trim() || input.flags.length === 0) return { ok: true, findings: [] };
  try {
    const raw = await generate({
      model: CLAUDE_MODEL_SONNET,
      systemInstruction: FACT_CHECK_AI_FIX_SYSTEM,
      userPrompt: buildFactCheckAiFixUserPrompt(input.field, input.flags, buildCanonicalFactsSheet(input.facts)),
      maxTokens: FACT_CHECK_AI_FIX_MAX_TOKENS,
      budget: input.budget,
      skipLatvianPolish: true,
    });
    return { ok: true, findings: parseFactCheckAiFixResponse(raw, input.field) };
  } catch (e) {
    const message = aiErrorMessage(e).slice(0, 240);
    console.warn("[fact-check-ai-fix] failed", { message });
    return { ok: false, error: message.includes("invalid_json") ? "fact_fix_invalid_json" : "fact_fix_failed" };
  }
}
