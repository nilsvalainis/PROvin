import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { buildInvoiceHtml } from "@/lib/generate-invoice-html";
import { getOrCreateInvoiceNumber } from "@/lib/invoice-number";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await ctx.params;
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (order.paymentStatus !== "paid" || order.amountTotal == null) {
    return NextResponse.json(
      {
        error: "invoice_only_paid",
        message: "Rēķinu var atvērt tikai apmaksātiem pasūtījumiem ar noteiktu summu.",
      },
      { status: 409 },
    );
  }

  const invoiceNumber = await getOrCreateInvoiceNumber(order.id, order.created);

  const html = buildInvoiceHtml({
    id: order.id,
    created: order.created,
    amountTotal: order.amountTotal,
    currency: order.currency,
    customerEmail: order.customerEmail,
    customerDetailsEmail: order.customerDetailsEmail,
    vin: order.vin,
    invoiceNumber,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
