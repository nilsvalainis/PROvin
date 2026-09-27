import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { ensureUpsellUrlInText, isOrderUpsellKind, upsellPublicPath } from "@/lib/order-upsell";
import { readSessionUpsellDoc } from "@/lib/order-upsell-store";
import { getPublicSiteOrigin } from "@/lib/site-url";

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
  const kindRaw = String(body.kind ?? "").trim();
  const subject = String(body.subject ?? "").trim().slice(0, SUBJECT_MAX);
  const text = String(body.text ?? "").trim().slice(0, TEXT_MAX);
  const to = String(body.to ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId) || !isOrderUpsellKind(kindRaw) || !subject || !text) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!isValidOrderEmail(to)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order || !canNotifyClientOrder(order, to)) {
    return NextResponse.json({ error: "order_not_eligible" }, { status: 400 });
  }
  const doc = await readSessionUpsellDoc(sessionId);
  const offer = doc?.offers[kindRaw];
  if (!offer || offer.status !== "open") {
    return NextResponse.json({ error: "offer_not_open" }, { status: 400 });
  }
  const url = `${getPublicSiteOrigin()}${upsellPublicPath(offer.token)}`;
  const sent = await trySendDealerDataOperatorEmail({
    to,
    subject,
    text: ensureUpsellUrlInText(text, url),
  });
  if (!sent) return NextResponse.json({ error: "email_failed" }, { status: 502 });
  return NextResponse.json({ ok: true, to });
}
