/**
 * Aktīvo PRO pasūtījumu skaits sānjoslas žetonam (noklusētais >10 € filtrs kā sarakstā).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { countAdminActiveOrders } from "@/lib/admin-active-orders-count";
import { getAuditDeadlineCompleteMap } from "@/lib/admin-audit-complete-store";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { listAdminOrders } from "@/lib/admin-orders";
import { isB2bPackAdminOrder } from "@/lib/b2b-partner-orders";
import { upsellListOverlay } from "@/lib/order-upsell";
import { readUpsellDisplayOffers } from "@/lib/order-upsell-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { rows } = await listAdminOrders();
    const orders = filterAdminOrdersForDashboard(rows, false);
    const ids = orders.map((o) => o.id);
    const [done, upsell] = await Promise.all([getAuditDeadlineCompleteMap(ids), readUpsellDisplayOffers(ids)]);
    const { activeCount, overdueCount, urgentCount } = countAdminActiveOrders(
      orders.map((o) => ({
        created: o.created,
        // Kā sarakstā: piepirkuma termiņš skaitās no piepirkuma apmaksas.
        deadlineFromUnix: upsellListOverlay(upsell.get(o.id) ?? [])?.paidAtUnix,
        auditComplete: Boolean(done.get(o.id)),
        isB2bPack: isB2bPackAdminOrder(o),
      })),
      Date.now(),
    );
    return NextResponse.json({ ok: true, activeCount, overdueCount, urgentCount });
  } catch (e) {
    console.error("[admin/orders/active-count]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
