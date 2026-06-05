import { NextResponse } from "next/server";
import { getOrBuildInvoicePdfForSession } from "@/lib/invoice-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function pdfHeaders(invoiceNumber: string, bytes: Uint8Array) {
  const safeName = `invoice-${invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`;
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": `attachment; filename="${safeName}"`,
  };
}

/**
 * Publiska rēķina lejupielāde pēc apmaksas: `?session_id=cs_…` (Stripe Checkout sesijas ID).
 * Sesija tiek pārbaudīta caur Stripe API `getCheckoutSessionDetail`; kešots PDF no Blob.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  let result;
  try {
    result = await getOrBuildInvoicePdfForSession(sessionId);
  } catch (error) {
    console.error("[api/invoice/download] failed:", error);
    return NextResponse.json({ error: "pdf_generation_failed" }, { status: 500 });
  }

  if (!result) {
    console.error("[api/invoice/download] Order not found or not paid:", sessionId);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(result.bytes), {
    status: 200,
    headers: pdfHeaders(result.invoiceNumber, result.bytes),
  });
}
