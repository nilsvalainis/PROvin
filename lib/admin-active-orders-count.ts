import { formatAuditDeadlineRemaining, isAdminOrderInactive } from "@/lib/admin-audit-deadline";

/**
 * Sānjoslas „Pasūtījumi” žetons: aktīvo (neizpildīto) skaits un vai kāds kavē 48 h termiņu.
 * Tas pats aktīvā definīcija kā sarakstā (partitionAdminOrdersActiveFirst): nav „Izpildīts”, nav B2B paka
 * un nav pilnībā atmaksāts / zaudēts strīds (isAdminOrderInactive).
 */
export function countAdminActiveOrders(
  rows: { created: number; deadlineFromUnix?: number | null; auditComplete?: boolean; isB2bPack?: boolean; fullyReversed?: boolean }[],
  nowMs: number,
): { activeCount: number; overdueCount: number; urgentCount: number } {
  let activeCount = 0;
  let overdueCount = 0;
  let urgentCount = 0;
  for (const r of rows) {
    if (isAdminOrderInactive(r)) continue;
    activeCount++;
    // Tieši tā pati funkcija un sākuma laiks kā tabulas termiņa šūnā (piepirkumam — apmaksas brīdis).
    const status = formatAuditDeadlineRemaining(r.deadlineFromUnix ?? r.created, nowMs).status;
    if (status === "overdue") overdueCount++;
    else if (status === "urgent") urgentCount++;
  }
  return { activeCount, overdueCount, urgentCount };
}
