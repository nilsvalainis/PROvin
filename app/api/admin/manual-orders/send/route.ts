import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { getManualOrder, isManualOrderId, isPartnerCreditManualOrder } from "@/lib/admin-manual-orders";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import { ensureManualOrderPayUrlInText, isManualOrderStripePaid } from "@/lib/manual-order-payment";
import { isValidOrderEmail } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBJECT_MAX = 180;
const TEXT_MAX = 12_000;

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = String(body.sessionId ?? "").trim();
  const subject = String(body.subject ?? "").trim().slice(0, SUBJECT_MAX);
  const text = String(body.text ?? "").trim().slice(0, TEXT_MAX);
  const to = String(body.to ?? "").trim();
  const url = String(body.url ?? "").trim();
  if (!isManualOrderId(sessionId) || !isSafeOrderDraftSessionId(sessionId) || !subject || !text) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isValidOrderEmail(to)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const record = await getManualOrder(sessionId);
  if (!record || isPartnerCreditManualOrder(record)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (isManualOrderStripePaid(record)) {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || !canNotifyClientOrder(order, to)) {
    return NextResponse.json({ error: "order_not_eligible" }, { status: 400 });
  }
  const payUrl = url || record.stripeCheckoutUrl || "";
  if (!payUrl) {
    return NextResponse.json({ error: "missing_checkout" }, { status: 400 });
  }
  const sent = await trySendDealerDataOperatorEmail({
    to,
    subject,
    text: ensureManualOrderPayUrlInText(text, payUrl),
  });
  if (!sent) return NextResponse.json({ error: "email_failed" }, { status: 502 });
  return NextResponse.json({ ok: true, to });
}
