/**
 * Klienta saziņas atzīmes: dīlera datu «Sūtīt klientam» žurnāls un Google atsauksmes lūgums.
 * GET ?sessionId= - atzīmes. POST action: dealer_send | review_request | review_queue.
 * Atsauksmes e-pastu sūta tikai pēc admina pogas; WhatsApp tikai atzīmē (ziņu atver admins).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { getAuditCompletedAtMap } from "@/lib/admin-audit-complete-store";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import { readMessageTemplatesDoc } from "@/lib/messages/message-templates-store";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { GOOGLE_REVIEW_URL } from "@/lib/messages/shared-blocks";
import { reportReadyVinVar } from "@/lib/messages/template-vars";
import {
  isDealerSendChannel,
  isDealerSendSituation,
  withDealerSend,
  withReviewRequested,
} from "@/lib/order-client-marks";
import { readOrderClientMarks, updateOrderClientMarks } from "@/lib/order-client-marks-store";
import { isValidOrderEmail } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUEUE_MAX_IDS = 200;

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  return NextResponse.json({ marks: await readOrderClientMarks(sessionId) });
}

async function customerEmailFor(sessionId: string): Promise<{ to: string; vin: string } | null> {
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) return null;
  const draft = await readOrderDraft(sessionId);
  const to =
    [draft?.orderEdits?.customerEmail, order.customerEmail, order.customerDetailsEmail]
      .find((v) => typeof v === "string" && isValidOrderEmail(v.trim()))
      ?.trim() ?? "";
  const vin = [draft?.orderEdits?.vin, order.vin].find((v) => typeof v === "string" && v.trim())?.trim() ?? "";
  return { to, vin };
}

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
  const action = String(body.action ?? "");

  if (action === "review_queue") {
    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .filter((v): v is string => typeof v === "string" && isSafeOrderDraftSessionId(v))
      .slice(0, QUEUE_MAX_IDS);
    const completed = await getAuditCompletedAtMap(ids);
    const items = await Promise.all(
      ids.map(async (id) => {
        const completedAt = completed.get(id) ?? null;
        const marks = completedAt ? await readOrderClientMarks(id) : {};
        return { id, completedAt, reviewRequestedAt: marks.reviewRequestedAt ?? null };
      }),
    );
    return NextResponse.json({ items });
  }

  const sessionId = String(body.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const channel = body.channel;
  if (!isDealerSendChannel(channel)) {
    return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  }
  const nowIso = new Date().toISOString();

  if (action === "dealer_send") {
    if (!isDealerSendSituation(body.situation)) {
      return NextResponse.json({ error: "invalid_situation" }, { status: 400 });
    }
    const situation = body.situation;
    const offer = situation === "ready" && body.offer === true;
    const review = situation === "ready" && body.review === true && !offer;
    const marks = await updateOrderClientMarks(sessionId, (cur) =>
      withDealerSend(cur, { at: nowIso, channel, situation, offer, review }),
    );
    if (!marks) return NextResponse.json({ error: "store_failed" }, { status: 503 });
    return NextResponse.json({ ok: true, marks });
  }

  if (action === "review_request") {
    const current = await readOrderClientMarks(sessionId);
    if (current.reviewRequestedAt) {
      return NextResponse.json({ error: "already_requested", marks: current }, { status: 409 });
    }
    if (channel === "email") {
      const who = await customerEmailFor(sessionId);
      if (!who) return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (!who.to) return NextResponse.json({ error: "no_customer_email" }, { status: 400 });
      const doc = await readMessageTemplatesDoc();
      const rendered = renderTemplateById(
        "email.review_request",
        { vin: reportReadyVinVar(who.vin), atsauksmes_saite: GOOGLE_REVIEW_URL },
        doc,
      );
      if (!rendered?.subject || !rendered.text) {
        return NextResponse.json({ error: "template_failed" }, { status: 500 });
      }
      const sent = await trySendDealerDataOperatorEmail({ to: who.to, subject: rendered.subject, text: rendered.text });
      if (!sent) return NextResponse.json({ error: "email_failed" }, { status: 502 });
    }
    const marks = await updateOrderClientMarks(sessionId, (cur) => withReviewRequested(cur, channel, nowIso));
    if (!marks) return NextResponse.json({ error: "store_failed" }, { status: 503 });
    return NextResponse.json({ ok: true, marks });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
