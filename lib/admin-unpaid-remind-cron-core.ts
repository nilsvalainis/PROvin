import type { UnpaidOrderRow } from "@/lib/admin-unpaid-orders-core";
import { pruneCronNotifyEntries, type CronNotifyEntries } from "@/lib/cron-notify-entries";

/** Viens paziņojums Nilam par katru neapmaksāto pasūtījumu; atkārtoti tas pats netiek ziņots 14 dienas. */
export const UNPAID_ADMIN_NUDGE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Rindas, par kurām Nilam vēl nav ziņots un kurām atgādinājums klientam vēl nav sūtīts. */
export function selectUnpaidForAdminNudge(
  rows: readonly UnpaidOrderRow[],
  notified: CronNotifyEntries,
): UnpaidOrderRow[] {
  return rows.filter((r) => r.remindable && !r.hidden && !r.remindedAt && !notified[r.sessionId]);
}

export function markUnpaidNudged(
  notified: CronNotifyEntries,
  rows: readonly UnpaidOrderRow[],
  nowMs: number,
): CronNotifyEntries {
  const next = pruneCronNotifyEntries(notified, nowMs, UNPAID_ADMIN_NUDGE_TTL_MS);
  const at = new Date(nowMs).toISOString();
  for (const r of rows) next[r.sessionId] = at;
  return next;
}
