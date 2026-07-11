import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { filterAdminOrdersForDashboard } from "@/lib/admin-order-amount-filter";
import { listAdminOrders } from "@/lib/admin-orders";
import { readStripePaidIndex } from "@/lib/admin-stripe-paid-index";

export const dynamic = "force-dynamic";

/**
 * Apmaksāto (nav demo) Checkout session ID saraksts — salīdzināšanai ar localStorage „atvērtajiem”.
 */
export async function GET() {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const index = await readStripePaidIndex();
  if (index && index.rows.length > 0) {
    const ids = filterAdminOrdersForDashboard(index.rows, false)
      .filter((r) => r.paymentStatus === "paid" && !r.isDemo)
      .map((r) => r.id);
    return NextResponse.json({ ids }, { headers: { "Cache-Control": "private, max-age=30" } });
  }

  const { rows } = await listAdminOrders();
  const ids = filterAdminOrdersForDashboard(rows, false)
    .filter((r) => r.paymentStatus === "paid" && !r.isDemo)
    .map((r) => r.id);
  return NextResponse.json({ ids }, { headers: { "Cache-Control": "private, no-store" } });
}
