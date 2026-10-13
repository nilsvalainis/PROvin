import { formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";

/**
 * Sānjoslas „Pasūtījumi” žetons: aktīvo (neizpildīto) skaits un vai kāds kavē 48 h termiņu.
 * Tas pats aktīvā definīcija kā sarakstā (partitionAdminOrdersActiveFirst): nav „Izpildīts” un nav B2B paka.
 */
export function countAdminActiveOrders(
  rows: { created: number; deadlineFromUnix?: number | null; auditComplete?: boolean; isB2bPack?: boolean }[],
  nowMs: number,
): { activeCount: number; overdueCount: number; urgentCount: number } {
  let activeCount = 0;
  let overdueCount = 0;
  let urgentCount = 0;
  for (const r of rows) {
    if (r.auditComplete || r.isB2bPack) continue;
    activeCount++;
    // Tieši tā pati funkcija un sākuma laiks kā tabulas termiņa šūnā (piepirkumam — apmaksas brīdis).
    const status = formatAuditDeadlineRemaining(r.deadlineFromUnix ?? r.created, nowMs).status;
    if (status === "overdue") overdueCount++;
    else if (status === "urgent") urgentCount++;
  }
  return { activeCount, overdueCount, urgentCount };
}
