import "server-only";

import { getAuditDeadlineCompleteMap } from "@/lib/admin-audit-complete-store";
import {
  buildMorningSummary,
  type MorningSummary,
  type MorningSummaryOrderInput,
} from "@/lib/admin-morning-summary";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { readOrderDraftSummaries } from "@/lib/admin-order-draft-summaries";
import { listAdminOrders } from "@/lib/admin-orders";
import { isB2bPackAdminOrder } from "@/lib/b2b-partner-orders";
import { listListingPeeks } from "@/lib/listing-peek-store";
import { upsellListOverlay } from "@/lib/order-upsell";
import { readUpsellDisplayOffers } from "@/lib/order-upsell-store";
import { sourcesFailingInARow } from "@/lib/source-health";
import { readSourceHealth } from "@/lib/source-health-store";

export type MorningSummaryLoad = {
  summary: MorningSummary;
  stripeError: string | null;
};

/** Viegls rīta skats: tie paši SLA avoti kā sarakstam, bez OrderDetailWorkspace. */
export async function loadMorningSummary(nowMs = Date.now()): Promise<MorningSummaryLoad> {
  const [{ rows, stripeError }, peeks] = await Promise.all([
    listAdminOrders(),
    listListingPeeks(200).catch(() => []),
  ]);
  const orders = filterAdminOrdersForDashboard(rows, false);
  const ids = orders.map((o) => o.id);
  const [done, upsell, drafts] = await Promise.all([
    getAuditDeadlineCompleteMap(ids),
    readUpsellDisplayOffers(ids),
    readOrderDraftSummaries(ids),
  ]);

  const inputs: MorningSummaryOrderInput[] = orders.map((o) => {
    const draft = drafts.get(o.id);
    const overlay = upsellListOverlay(upsell.get(o.id) ?? []);
    return {
      id: o.id,
      created: o.created,
      deadlineFromUnix: overlay?.paidAtUnix ?? null,
      auditComplete: Boolean(done.get(o.id)),
      isB2bPack: isB2bPackAdminOrder(o),
      makeModel: draft?.makeModel ?? null,
      vin: draft?.vin || o.vin,
      customerName: draft?.customerName || o.companyName || null,
      customerEmail: draft?.customerEmail || o.customerEmail,
    };
  });

  const failingSources = await readSourceHealth()
    .then((doc) => sourcesFailingInARow(doc, 3))
    .catch(() => []);

  return {
    summary: { ...buildMorningSummary(inputs, peeks, nowMs), failingSources },
    stripeError: stripeError ?? null,
  };
}
