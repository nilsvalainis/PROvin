import "server-only";

import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listPaidCheckoutSessions } from "@/lib/admin-orders";
import {
  buildListingPeekConversionStats,
  emptyListingPeekConversionStats,
  type ListingPeekConversionStats,
} from "@/lib/listing-peek-conversion";
import { isListingPeekRateLimitExempt, listListingPeeks } from "@/lib/listing-peek-store";

export async function loadListingPeekConversionStats(): Promise<ListingPeekConversionStats> {
  try {
    const [peeks, paid] = await Promise.all([
      listListingPeeks(500),
      listPaidCheckoutSessions().catch((err) => {
        console.warn("[listing-peek-conversion] paid sessions failed", err);
        return [];
      }),
    ]);
    const drafts = await readOrderDraftSummaries(paid.map((r) => r.id)).catch((err) => {
      console.warn("[listing-peek-conversion] draft summaries failed", err);
      return new Map();
    });
    return buildListingPeekConversionStats(
      peeks,
      paid.map((row) => {
        const draft = drafts.get(row.id);
        return {
          id: row.id,
          created: row.created,
          amountTotal: row.amountTotal,
          checkoutLine: row.checkoutLine ?? null,
          isDemo: row.isDemo,
          emails: [row.customerEmail, draft?.customerEmail],
          phones: [draft?.customerPhone],
        };
      }),
      { skipPeek: (p) => isListingPeekRateLimitExempt(p.email, p.phone) },
    );
  } catch (err) {
    console.warn("[listing-peek-conversion] load failed", err);
    return emptyListingPeekConversionStats();
  }
}
