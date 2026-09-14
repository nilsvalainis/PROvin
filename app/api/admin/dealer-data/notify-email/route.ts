/**
 * Nosūta dīlera klienta e-pastu bez atmaksas.
 * Operators rediģē subject/text adminā; nauda netiek skarta.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { canNotifyClientOrder } from "@/lib/admin-notify-client-eligibility";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import { isValidOrderEmail } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUBJECT_MAX = 180;
const TEXT_MAX = 12_000;

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
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = String(o.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const subject = String(o.subject ?? "").trim().slice(0, SUBJECT_MAX);
  const text = String(o.text ?? "").trim().slice(0, TEXT_MAX);
  if (!subject || !text) {
    return NextResponse.json({ error: "missing_subject_or_text" }, { status: 400 });
  }

  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const draft = await readOrderDraft(sessionId);
  const draftEmail = draft?.orderEdits?.customerEmail?.trim() ?? "";
  const fromOrder = (order.customerEmail ?? order.customerDetailsEmail ?? "").trim();
  const bodyEmail = String(o.customerEmail ?? "").trim();
  const to =
    [bodyEmail, draftEmail, fromOrder].find((v) => v && isValidOrderEmail(v))?.trim() ?? "";

  if (!canNotifyClientOrder(order, to)) {
    return NextResponse.json(
      { error: "order_not_eligible", message: "Nepieciešams derīgs klienta e-pasts (un apmaksa, ja nav manuāls)." },
      { status: 400 },
    );
  }

  const emailSent = await trySendDealerDataOperatorEmail({ to, subject, text });
  if (!emailSent) {
    return NextResponse.json({ error: "email_failed", to }, { status: 502 });
  }
  return NextResponse.json({ ok: true, emailSent: true, to });
}
