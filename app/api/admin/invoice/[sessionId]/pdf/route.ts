import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { patchOrderDraftInvoiceMetadata } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { buildInvoicePdfBytes } from "@/lib/invoice-pdf";
import { readInvoicePdfFromDisk, resolveInvoiceDir, writeInvoicePdfToDisk } from "@/lib/invoice-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ sessionId: string }> };

function pdfHeaders(sessionId: string, bytes: Uint8Array) {
  const safeName = `invoice-${sessionId.replace(/[^\w.-]+/g, "_")}.pdf`;
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${safeName}"`,
  };
}

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

  const cached = await readInvoicePdfFromDisk(sessionId);
  if (cached) {
    return new NextResponse(Buffer.from(cached), { status: 200, headers: pdfHeaders(sessionId, cached) });
  }

  const bytes = await buildInvoicePdfBytes({
    id: order.id,
    created: order.created,
    amountTotal: order.amountTotal,
    currency: order.currency,
    customerEmail: order.customerEmail,
    customerDetailsEmail: order.customerDetailsEmail,
    vin: order.vin,
  });

  if (resolveInvoiceDir()) {
    const wrote = await writeInvoicePdfToDisk(sessionId, bytes);
    if (wrote) {
      const relUrl = `/api/admin/invoice/${encodeURIComponent(sessionId)}/pdf`;
      await patchOrderDraftInvoiceMetadata(sessionId, {
        invoicePdfUrl: relUrl,
        invoicePdfGeneratedAt: new Date().toISOString(),
      });
    }
  }

  return new NextResponse(Buffer.from(bytes), { status: 200, headers: pdfHeaders(sessionId, bytes) });
}
