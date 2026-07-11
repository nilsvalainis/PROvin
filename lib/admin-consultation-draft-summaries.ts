import "server-only";

import { readConsultationDraft } from "@/lib/admin-consultation-draft-store";

export type ConsultationDraftDashboardSummary = {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

const EMPTY_SUMMARY: ConsultationDraftDashboardSummary = {
  customerEmail: null,
  customerName: null,
  customerPhone: null,
};

function draftToSummary(draft: Awaited<ReturnType<typeof readConsultationDraft>>): ConsultationDraftDashboardSummary {
  if (!draft) return EMPTY_SUMMARY;
  const email = draft.orderEdits?.customerEmail?.trim();
  const name = draft.orderEdits?.customerName?.trim();
  const phone = draft.orderEdits?.customerPhone?.trim();
  return {
    customerEmail: email || null,
    customerName: name || null,
    customerPhone: phone || null,
  };
}

export async function readConsultationDraftSummaries(
  sessionIds: string[],
): Promise<Map<string, ConsultationDraftDashboardSummary>> {
  const unique = [...new Set(sessionIds.filter(Boolean))];
  const pairs = await Promise.all(
    unique.map(async (id) => [id, draftToSummary(await readConsultationDraft(id))] as const),
  );
  return new Map(pairs);
}
