import { NextResponse } from "next/server";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { partnerOwnsArchiveItem } from "@/lib/b2b-partner-archive-rows";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { getOrBuildInvoicePdfForSession, readInvoicePdfCached } from "@/lib/invoice-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await ctx.params;
  const id = sessionId.trim();
  if (!id || !isSafeOrderDraftSessionId(id)) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(id);
  if (!order || order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const draft = await readOrderDraft(id);
  const owns = partnerOwnsArchiveItem({
    partnerId: partner.id,
    partnerEmail: partner.email,
    orderPartnerId: order.partnerId,
    orderEmail: order.customerEmail,
    orderDetailsEmail: order.customerDetailsEmail,
    draftEmail: draft?.orderEdits?.customerEmail,
    notes: draft?.orderEdits?.notes,
  });
  if (!owns) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const cached = await readInvoicePdfCached(id);
  const built = cached ? { bytes: cached, invoiceNumber: draft?.invoiceNumber?.trim() || "invoice" } : await getOrBuildInvoicePdfForSession(id);
  if (!built) {
    return NextResponse.json({ error: "invoice_not_ready" }, { status: 404 });
  }

  const invoiceNumber = built.invoiceNumber || draft?.invoiceNumber?.trim() || "invoice";
  const bytes = built.bytes;
  const safeName = `invoice-${invoiceNumber.replace(/[^\w.-]+/g, "_")}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${safeName}"`,
    },
  });
}
