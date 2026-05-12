import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listAdminOrders } from "@/lib/admin-orders";

export const dynamic = "force-dynamic";

/**
 * Apmaksāto (nav demo) Checkout session ID saraksts — salīdzināšanai ar localStorage „atvērtajiem”.
 */
export async function GET() {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { rows } = await listAdminOrders(100);
  const ids = rows.filter((r) => r.paymentStatus === "paid" && !r.isDemo).map((r) => r.id);
  return NextResponse.json({ ids }, { headers: { "Cache-Control": "private, no-store" } });
}
