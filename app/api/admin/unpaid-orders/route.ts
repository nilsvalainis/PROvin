import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listPendingUnpaidOrdersPayload, listUnpaidAdminOrders, stripeCheckoutSessionDashboardUrl } from "@/lib/admin-unpaid-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Neapmaksātie, vēl neatgādinātie pasūtījumi (VIN, produkts, summa, laiks;
 * e-pasts var būt tukšs, ja klients pametis Stripe pirms ievades).
 * `?full=1` - admin UI ar atgādinātajiem un palīglaukiem.
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const full = url.searchParams.get("full") === "1" || url.searchParams.get("full") === "true";
  try {
    if (!full) {
      const { orders, stripeError } = await listPendingUnpaidOrdersPayload();
      return NextResponse.json({ orders, stripeError });
    }
    const { rows, stripeError } = await listUnpaidAdminOrders();
    return NextResponse.json({
      stripeError,
      orders: rows.map((r) => ({
        ...r,
        stripeDashboardUrl: stripeCheckoutSessionDashboardUrl(r.sessionId),
      })),
    });
  } catch (e) {
    console.error("[admin/unpaid-orders]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
