import "server-only";

import { readDashboardDraftSummaries } from "@/lib/admin-dashboard-draft-index";
import type { OrderVinScanDashboardHint } from "@/lib/order-vin-scan";

export type OrderDraftDashboardSummary = {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  invoicePdfUrl: string | null;
  invoiceNumber: string | null;
  clientReportReadyAt: string | null;
  makeModel: string | null;
  auditCompletedAt: string | null;
  vin: string | null;
  notes: string | null;
  vinScan: OrderVinScanDashboardHint | null;
};

/** Viena JSON lasīšana — nevis N× Blob/FS melnrakstu lasījumi. */
export async function readOrderDraftSummaries(
  sessionIds: string[],
): Promise<Map<string, OrderDraftDashboardSummary>> {
  return readDashboardDraftSummaries(sessionIds);
}

export { invalidateOrderDraftCache } from "@/lib/admin-order-draft-cache";
