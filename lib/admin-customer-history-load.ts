import "server-only";

import { buildCustomerHistory, emptyCustomerHistory, type CustomerHistory } from "@/lib/admin-customer-history";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import { listListingPeeks } from "@/lib/listing-peek-store";

export async function loadCustomerHistoryForOrder(input: {
  sessionId: string;
  emails: Array<string | null | undefined>;
  phones: Array<string | null | undefined>;
  amountTotal?: number | null;
}): Promise<CustomerHistory> {
  const sessionId = input.sessionId.trim();
  if (!sessionId) return emptyCustomerHistory();

  const [peeks, paid] = await Promise.all([
    listListingPeeks(500).catch((err) => {
      console.warn("[customer-history] listing peeks failed", err);
      return [];
    }),
    listPaidCheckoutSessions().catch((err) => {
      console.warn("[customer-history] paid sessions failed", err);
      return [];
    }),
  ]);

  const drafts = await readOrderDraftSummaries(paid.map((r) => r.id)).catch((err) => {
    console.warn("[customer-history] draft summaries failed", err);
    return new Map();
  });

  return buildCustomerHistory({
    currentSessionId: sessionId,
    currentEmails: input.emails,
    currentPhones: input.phones,
    currentAmountTotal: input.amountTotal,
    peeks,
    paid: paid.map((row) => {
      const draft = drafts.get(row.id);
      return {
        id: row.id,
        created: row.created,
        amountTotal: row.amountTotal,
        currency: row.currency,
        checkoutLine: row.checkoutLine ?? null,
        vin: row.vin,
        isDemo: row.isDemo,
        emails: [row.customerEmail, draft?.customerEmail],
        phones: [draft?.customerPhone],
      };
    }),
  });
}
