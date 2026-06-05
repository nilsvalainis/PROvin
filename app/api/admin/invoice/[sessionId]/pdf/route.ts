import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { getOrBuildInvoicePdfForSession } from "@/lib/invoice-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ sessionId: string }> };

function pdfHeaders(invoiceNumber: string, bytes: Uint8Array) {
  const safeName = `invoice-${invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`;
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
    console.error("[api/admin/invoice/pdf] Order not found for session:", sessionId);
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

  let result;
  try {
    result = await getOrBuildInvoicePdfForSession(sessionId);
  } catch (error) {
    console.error("[api/admin/invoice/pdf] PDF generation failed:", error);
    return NextResponse.json({ error: "pdf_generation_failed" }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: pdfHeaders(result.invoiceNumber, result.bytes),
  });
}
