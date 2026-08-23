/**
 * Viena ✨ pieprasījuma laika budžets.
 *
 * Maršruta `maxDuration` ir ciets griests: ja atkārtotie mēģinājumi to pārsniedz,
 * Vercel nogalina funkciju un operators nesaņem neko — arī ne jau apmaksāto tekstu.
 * Budžets tur visus mēģinājumus zem griesta un ļauj atgriezt daļējo rezultātu.
 */
export type AiRequestBudget = { readonly endsAt: number };

/** Rezerve atbildes noformēšanai un tīkla ceļam atpakaļ. */
const RESPONSE_RESERVE_MS = 8_000;

/** Cik daudz laika vēl jāpaliek, lai kārtējais apmaksātais mēģinājums būtu jēgpilns. */
export const AI_RETRY_MIN_BUDGET_MS = 22_000;

/**
 * Vercel Fluid Compute griesti ir 300s — to nevar noņemt.
 * Zemāks `maxDuration` (90/120) bija galvenais iemesls daļējiem komentāriem.
 */
export const AI_ROUTE_MAX_DURATION_SEC = 300;

/** Maršrutu `maxDuration` (skat. `app/api/admin/ai/**`). */
export const AI_ROUTE_BUDGET_MS = {
  text: AI_ROUTE_MAX_DURATION_SEC * 1000,
  webSearch: AI_ROUTE_MAX_DURATION_SEC * 1000,
} as const;

export function createAiRequestBudget(routeMaxDurationMs: number): AiRequestBudget {
  return { endsAt: Date.now() + Math.max(1_000, routeMaxDurationMs - RESPONSE_RESERVE_MS) };
}

export function aiBudgetRemainingMs(budget?: AiRequestBudget | null): number {
  if (!budget) return Number.POSITIVE_INFINITY;
  return budget.endsAt - Date.now();
}

/** Viena mēģinājuma timeout — nekad garāks par budžeta atlikumu. */
export function aiAttemptTimeoutMs(
  budget: AiRequestBudget | null | undefined,
  capMs: number,
): number {
  const remaining = aiBudgetRemainingMs(budget);
  if (!Number.isFinite(remaining)) return capMs;
  return Math.max(1_000, Math.min(capMs, remaining));
}

/** Vai vēl drīkst sākt kārtējo mēģinājumu (failover, retry bez thinking, self-correction). */
export function aiBudgetAllowsRetry(
  budget: AiRequestBudget | null | undefined,
  minMs: number = AI_RETRY_MIN_BUDGET_MS,
): boolean {
  return aiBudgetRemainingMs(budget) >= minMs;
}
