import { NextResponse } from "next/server";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { buildInvoicePdfBytes } from "@/lib/invoice-pdf";
import { getOrCreateInvoiceNumber } from "@/lib/invoice-number";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pdfHeaders(invoiceNumber: string, bytes: Uint8Array) {
  const safeName = `invoice-${invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`;
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${safeName}"`,
  };
}

/**
 * Publiska rēķina lejupielāde pēc apmaksas: `?session_id=cs_…` (Stripe Checkout sesijas ID).
 * Stripe sesija tiek pārbaudīta caur API; demo ID — tikai lokālais pasūtījuma ieraksts.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid" || order.amountTotal == null) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!sessionId.startsWith("demo_")) {
    try {
      const stripe = getStripe();
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      if (s.payment_status !== "paid") {
        return NextResponse.json({ error: "not_paid" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "invalid_session" }, { status: 404 });
    }
  }

  const invoiceNumber = await getOrCreateInvoiceNumber(sessionId, order.created);
  const bytes = await buildInvoicePdfBytes({
    id: order.id,
    created: order.created,
    amountTotal: order.amountTotal,
    currency: order.currency,
    customerEmail: order.customerEmail,
    customerDetailsEmail: order.customerDetailsEmail,
    vin: order.vin,
    invoiceNumber,
  });

  return new NextResponse(Buffer.from(bytes), { status: 200, headers: pdfHeaders(invoiceNumber, bytes) });
}
