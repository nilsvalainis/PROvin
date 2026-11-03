import "server-only";

import { CLAUDE_MODEL_OPUS, CLAUDE_MODEL_SONNET, aiGenerateText } from "@/lib/admin-ai";
import { AI_LV_FINAL_REVIEW_SYSTEM, AI_LV_POLISH_SYSTEM } from "@/lib/admin-ai-prompts";
import { aiErrorMessage } from "@/lib/ai-model-failover";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import { aiBudgetAllowsRetry, type AiRequestBudget } from "@/lib/ai-request-budget";
import { applyProvinReportCopyVocabulary } from "@/lib/source-summary-comment-format";

const LOG_PREFIX = "[admin-ai-polish]";

export type FinalizeGeneratedCommentOptions = {
  /** JSON / strukturēta izeja: pēdējo pārskatu nelaiž. */
  skip?: boolean;
  budget?: AiRequestBudget;
};

/**
 * Tukšs teksts vai tīrs JSON (shēmas izvilkums) - prozas slīpēšana sabojātu struktūru.
 * Apcirpts JSON (sākas ar { vai [) arī tiek izlaists.
 */
export function shouldSkipGeneratedCommentPolish(raw: string): boolean {
  const text = raw.trim();
  if (!text) return true;
  return /^\s*[\[{]/.test(text);
}

async function runLatvianPolishPass(
  raw: string,
  systemInstruction: string,
  model: string,
  budget?: AiRequestBudget,
): Promise<string> {
  const text = raw.trim();
  if (!text) throw new Error("empty_text");
  const polished = await aiGenerateText({
    model,
    systemInstruction,
    userPrompt: text,
    temperature: 0.2,
    budget,
    skipLatvianPolish: true,
  });
  return applyProvinReportCopyVocabulary(polished);
}

/** Latviešu gramatikas labošana (admin ✨) - Claude Sonnet (lētākais LV gramatikai). */
export async function polishLatvianTextWithAi(raw: string): Promise<string> {
  return runLatvianPolishPass(raw, AI_LV_POLISH_SYSTEM, CLAUDE_MODEL_SONNET);
}

/**
 * Pēdējais automātiskais Claude Opus (`claude-opus-5-5`) pārskats pēc komentāra ģenerēšanas.
 * Kļūmes gadījumā atgriež oriģinālo (jau apmaksāto) tekstu.
 */
export async function finalizeGeneratedComment(
  raw: string,
  opts?: FinalizeGeneratedCommentOptions,
): Promise<string> {
  if (opts?.skip || shouldSkipGeneratedCommentPolish(raw)) return raw;
  if (opts?.budget && !aiBudgetAllowsRetry(opts.budget)) {
    console.warn(`${LOG_PREFIX} final_review_skipped_no_budget`, {
      promptVersion: PROVIN_AI_PROMPT_VERSION,
    });
    return raw;
  }
  try {
    const polished = await runLatvianPolishPass(
      raw,
      AI_LV_FINAL_REVIEW_SYSTEM,
      CLAUDE_MODEL_OPUS,
      opts?.budget,
    );
    return polished.trim() || raw;
  } catch (e) {
    console.warn(`${LOG_PREFIX} final_review_failed`, {
      promptVersion: PROVIN_AI_PROMPT_VERSION,
      message: aiErrorMessage(e).slice(0, 240),
    });
    return raw;
  }
}
