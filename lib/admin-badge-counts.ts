import "server-only";

import { countAdminActiveOrders } from "@/lib/admin-active-orders-count";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { listAdminOrders } from "@/lib/admin-orders";
import { getOrderFlags } from "@/lib/admin-orders-flags";
import { countUnseenB2bPartners } from "@/lib/b2b-partner-account";
import { listB2bPartners } from "@/lib/b2b-partner-store";
import { countOpenListingPeeks } from "@/lib/listing-peek-queue";
import { readListingPeekDocForAdminRead } from "@/lib/listing-peek-store";
import { isB2bPackAdminOrder } from "@/lib/b2b-partner-orders";
import { upsellListOverlay } from "@/lib/order-upsell";

export type AdminBadgeCounts = {
  openCount: number;
  unseenCount: number;
  activeCount: number;
  overdueCount: number;
  urgentCount: number;
};

/**
 * Visi sānjoslas žetoni vienā servera izsaukumā (3 Blob lasījumi paralēli, nevis 3× atsevišķi API maršruti).
 */
export async function loadAdminBadgeCounts(): Promise<AdminBadgeCounts> {
  const [peekDoc, partners, orderLoad] = await Promise.all([
    readListingPeekDocForAdminRead(),
    listB2bPartners(),
    listAdminOrders(),
  ]);

  const openCount = countOpenListingPeeks(peekDoc.entries);
  const unseenCount = countUnseenB2bPartners(partners);

  const orders = filterAdminOrdersForDashboard(orderLoad.rows, false);
  const ids = orders.map((o) => o.id);
  const { complete: done, upsell } = await getOrderFlags(ids);
  const { activeCount, overdueCount, urgentCount } = countAdminActiveOrders(
    orders.map((o) => ({
      created: o.created,
      deadlineFromUnix: upsellListOverlay(upsell.get(o.id) ?? [])?.paidAtUnix,
      auditComplete: Boolean(done.get(o.id)),
      isB2bPack: isB2bPackAdminOrder(o),
    })),
    Date.now(),
  );

  return { openCount, unseenCount, activeCount, overdueCount, urgentCount };
}
