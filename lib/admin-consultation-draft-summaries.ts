import "server-only";

import { readDashboardDraftSummaries } from "@/lib/admin-dashboard-draft-index";

export type ConsultationDraftDashboardSummary = {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

export async function readConsultationDraftSummaries(
  sessionIds: string[],
): Promise<Map<string, ConsultationDraftDashboardSummary>> {
  const rows = await readDashboardDraftSummaries(sessionIds);
  const out = new Map<string, ConsultationDraftDashboardSummary>();
  for (const [id, entry] of rows) {
    out.set(id, {
      customerEmail: entry.customerEmail,
      customerName: entry.customerName,
      customerPhone: entry.customerPhone,
    });
  }
  return out;
}
