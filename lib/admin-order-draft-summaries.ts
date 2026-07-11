import "server-only";

import { readOrderDraftCached } from "@/lib/admin-order-draft-cache";
import { readOrderDraftUncached, type OrderDraftState } from "@/lib/admin-order-draft-store";

export type OrderDraftDashboardSummary = {
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  invoicePdfUrl: string | null;
};

const EMPTY_SUMMARY: OrderDraftDashboardSummary = {
  customerEmail: null,
  customerName: null,
  customerPhone: null,
  invoicePdfUrl: null,
};

function draftToSummary(draft: OrderDraftState | null): OrderDraftDashboardSummary {
  if (!draft) return EMPTY_SUMMARY;
  const email = draft.orderEdits?.customerEmail?.trim();
  const name = draft.orderEdits?.customerName?.trim();
  const phone = draft.orderEdits?.customerPhone?.trim();
  return {
    customerEmail: email || null,
    customerName: name || null,
    customerPhone: phone || null,
    invoicePdfUrl: draft.invoicePdfUrl ?? null,
  };
}

/** Batch dashboard lauki — izmanto kešotu readOrderDraft. */
export async function readOrderDraftSummaries(
  sessionIds: string[],
): Promise<Map<string, OrderDraftDashboardSummary>> {
  const unique = [...new Set(sessionIds.filter(Boolean))];
  const pairs = await Promise.all(
    unique.map(async (id) => {
      const draft = await readOrderDraftCached(id, () => readOrderDraftUncached(id));
      return [id, draftToSummary(draft)] as const;
    }),
  );
  return new Map(pairs);
}

export { invalidateOrderDraftCache } from "@/lib/admin-order-draft-cache";
