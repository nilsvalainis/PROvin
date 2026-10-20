import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOrBuildInvoicePdfForSession } from "@/lib/invoice-storage";
import {
  THANKS_SESSION_COOKIE_NAME,
  authorizeInvoiceDownload,
  readThanksSessionIdFromToken,
} from "@/lib/thanks-session";

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
 * Rēķina lejupielāde pēc apmaksas. Auth = parakstītā httpOnly sīkdatne no /paldies.
 * `?session_id=` viena pati neder.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cookieStore = await cookies();
  const cookieSessionId = await readThanksSessionIdFromToken(
    cookieStore.get(THANKS_SESSION_COOKIE_NAME)?.value,
  );
  const auth = authorizeInvoiceDownload({
    cookieSessionId,
    querySessionId: searchParams.get("session_id"),
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const sessionId = auth.sessionId;

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
