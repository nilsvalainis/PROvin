import { NextResponse } from "next/server";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { emailsMatchForPartnerArchive } from "@/lib/partner-client-report";
import { readClientReportPdf } from "@/lib/partner-client-report-storage";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const email = partner.email;

  const { sessionId } = await ctx.params;
  const id = sessionId.trim();
  if (!id) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(id);
  if (!order || order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const draft = await readOrderDraft(id);
  const owns =
    emailsMatchForPartnerArchive(order.customerEmail, email) ||
    emailsMatchForPartnerArchive(order.customerDetailsEmail, email) ||
    emailsMatchForPartnerArchive(draft?.orderEdits?.customerEmail, email);
  if (!owns) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!draft?.clientReportReadyAt) {
    return NextResponse.json({ error: "report_not_ready" }, { status: 404 });
  }

  const bytes = await readClientReportPdf(id);
  if (!bytes) {
    return NextResponse.json({ error: "report_not_ready" }, { status: 404 });
  }

  const rawName = draft.clientReportFilename?.trim() || "PROVIN_atskaite.pdf";
  const safeName = rawName.replace(/[^\w.-]+/g, "_") || "PROVIN_atskaite.pdf";
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
