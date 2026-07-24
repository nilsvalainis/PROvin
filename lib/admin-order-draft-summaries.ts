import "server-only";

import { readDashboardDraftSummaries } from "@/lib/admin-dashboard-draft-index";

export type OrderDraftDashboardSummary = {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  invoicePdfUrl: string | null;
  makeModel: string | null;
  auditCompletedAt: string | null;
};

/** Viena JSON lasīšana — nevis N× Blob/FS melnrakstu lasījumi. */
export async function readOrderDraftSummaries(
  sessionIds: string[],
): Promise<Map<string, OrderDraftDashboardSummary>> {
  return readDashboardDraftSummaries(sessionIds);
}

export { invalidateOrderDraftCache } from "@/lib/admin-order-draft-cache";
