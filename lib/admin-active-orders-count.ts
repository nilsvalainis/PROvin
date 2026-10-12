import { AUDIT_PREPARATION_DEADLINE_MS } from "@/lib/admin-audit-deadline";

/**
 * Sānjoslas „Pasūtījumi” žetons: aktīvo (neizpildīto) skaits un vai kāds kavē 48 h termiņu.
 * Tas pats aktīvā definīcija kā sarakstā (partitionAdminOrdersActiveFirst): nav „Izpildīts” un nav B2B paka.
 */
export function countAdminActiveOrders(
  rows: { created: number; deadlineFromUnix?: number | null; auditComplete?: boolean; isB2bPack?: boolean }[],
  nowMs: number,
): { activeCount: number; overdueCount: number } {
  let activeCount = 0;
  let overdueCount = 0;
  for (const r of rows) {
    if (r.auditComplete || r.isB2bPack) continue;
    activeCount++;
    if ((r.deadlineFromUnix ?? r.created) * 1000 + AUDIT_PREPARATION_DEADLINE_MS < nowMs) overdueCount++;
  }
  return { activeCount, overdueCount };
}
