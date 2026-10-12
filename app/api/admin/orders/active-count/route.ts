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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { rows } = await listAdminOrders();
    const orders = filterAdminOrdersForDashboard(rows, false);
    const done = await getAuditDeadlineCompleteMap(orders.map((o) => o.id));
    const { activeCount, overdueCount } = countAdminActiveOrders(
      orders.map((o) => ({
        created: o.created,
        auditComplete: Boolean(done.get(o.id)),
        isB2bPack: isB2bPackAdminOrder(o),
      })),
      Date.now(),
    );
    return NextResponse.json({ ok: true, activeCount, overdueCount });
  } catch (e) {
    console.error("[admin/orders/active-count]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
