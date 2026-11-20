import "server-only";

import { CLAUDE_MODEL_OPUS, aiGenerateText } from "@/lib/admin-ai";
import { buildCanonicalFactsSheet, type CanonicalFactsInput } from "@/lib/canonical-facts-sheet";
import { aiErrorMessage } from "@/lib/ai-model-failover";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import type { AiRequestBudget } from "@/lib/ai-request-budget";
import {
  FLASH_MAX_FINAL_REVIEW_SYSTEM,
  FLASH_MAX_REVIEW_MAX_TOKENS,
  buildFlashMaxReviewUserPrompt,
  parseFlashMaxReviewResponse,
  type FlashMaxReviewField,
  type FlashMaxReviewFinding,
} from "@/lib/flash-max-final-review";

const LOG_PREFIX = "[flash-max-final-review]";

export type FlashMaxFinalReviewResult =
  | { ok: true; findings: FlashMaxReviewFinding[] }
  | { ok: false; error: string };

/**
 * Viens Claude Opus izsaukums pāri visiem FLASH MAX laukiem. Nekādu atkārtojumu: ja atbilde nederīga
 * vai izsaukums neizdodas, atgriež kļūdu (FLASH MAX teksti paliek, kā bija).
 */
export async function runFlashMaxFinalReview(
  input: {
    fields: FlashMaxReviewField[];
    facts: CanonicalFactsInput;
    budget?: AiRequestBudget;
    /** Papildu avota dati faktu lapas beigās (piem. oficiālā dīlera tabula automātiskajai ielasei). */
    extraFactsText?: string;
  },
  generate: typeof aiGenerateText = aiGenerateText,
): Promise<FlashMaxFinalReviewResult> {
  if (input.fields.length === 0) return { ok: true, findings: [] };
  try {
    const extra = input.extraFactsText?.trim() ?? "";
    const factsSheet = [buildCanonicalFactsSheet(input.facts), extra].filter((t) => t.trim()).join("\n\n");
    const raw = await generate({
      model: CLAUDE_MODEL_OPUS,
      systemInstruction: FLASH_MAX_FINAL_REVIEW_SYSTEM,
      userPrompt: buildFlashMaxReviewUserPrompt(input.fields, factsSheet),
      maxTokens: FLASH_MAX_REVIEW_MAX_TOKENS,
      budget: input.budget,
      skipLatvianPolish: true,
    });
    return { ok: true, findings: parseFlashMaxReviewResponse(raw, input.fields) };
  } catch (e) {
    const message = aiErrorMessage(e).slice(0, 240);
    console.warn(`${LOG_PREFIX} failed`, { promptVersion: PROVIN_AI_PROMPT_VERSION, message });
    return { ok: false, error: message.includes("invalid_json") ? "final_review_invalid_json" : "final_review_failed" };
  }
}
