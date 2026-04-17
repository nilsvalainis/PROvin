import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSmtpConfigured, sendReportReadyEmail } from "@/lib/email/send-transactional";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { isValidOrderEmail } from "@/lib/order-field-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Kad eksperts ir apstiprinājis atskaiti — nosūta klientam paziņojumu (Google Workspace SMTP).
 * POST JSON: { "sessionId": "cs_..." }
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sessionId =
    typeof body === "object" &&
    body !== null &&
    "sessionId" in body &&
    typeof (body as { sessionId: unknown }).sessionId === "string"
      ? (body as { sessionId: string }).sessionId.trim()
      : "";
  const bodyCustomerEmail =
    typeof body === "object" &&
    body !== null &&
    "customerEmail" in body &&
    typeof (body as { customerEmail: unknown }).customerEmail === "string"
      ? (body as { customerEmail: string }).customerEmail.trim()
      : "";

  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const draft = await readOrderDraft(sessionId);
  const draftCustomerEmail = draft?.orderEdits?.customerEmail?.trim() ?? "";
  const fromOrder = (order.customerEmail ?? order.customerDetailsEmail ?? "").trim();
  const to = [bodyCustomerEmail, draftCustomerEmail, fromOrder].find((v) => v && isValidOrderEmail(v)) ?? "";
  if (!to?.trim()) {
    return NextResponse.json({ error: "no_customer_email" }, { status: 400 });
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      {
        error: "smtp_not_configured",
        message:
          "SMTP_USER un SMTP_PASS nav iestatīti servera vidē (Vercel → Environment Variables vai lokālais .env.local). Skatīt .env.example — Google Workspace app password.",
      },
      { status: 503 },
    );
  }

  try {
    await sendReportReadyEmail({
      to: to.trim(),
      vin: order.vin?.trim() || "—",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nezināma kļūda";
    console.error("[api/admin/notify-report-ready]", e);
    return NextResponse.json({ error: "send_failed", message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
