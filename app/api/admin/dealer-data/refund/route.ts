/**
 * Manuāla dīlera pasūtījuma atmaksa, kad OEM datu par VIN nav.
 *
 * Naudas kustība notiek tikai caur šo ceļu, un tikai reizi katram pasūtījumam:
 * atmaksas ieraksts glabājas dīlera darba stāvoklī un to nevar pārrakstīt.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { readDealerDataJob, writeDealerDataJob } from "@/lib/dealer-data-job-store";
import {
  DEALER_REFUND_MAX_CENTS,
  decideDealerRefund,
  type DealerRefundRecord,
} from "@/lib/dealer-data-job-types";
import { trySendDealerDataRefundEmail } from "@/lib/email/send-transactional";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFUND_REASON_MAX = 300;

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
  if (!isSafeOrderDraftSessionId(sessionId) || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId).catch(() => null);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

  const job = await readDealerDataJob(sessionId);
  const decision = decideDealerRefund({
    job,
    amountTotalCents: session.amount_total,
    paid: session.payment_status === "paid",
    override: o.override === true,
  });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason, maxCents: DEALER_REFUND_MAX_CENTS, job },
      { status: 409 },
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? "");
  if (!paymentIntentId) {
    return NextResponse.json({ error: "payment_intent_missing" }, { status: 409 });
  }

  let refund: Awaited<ReturnType<typeof stripe.refunds.create>>;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: decision.amountCents,
        reason: "requested_by_customer",
        metadata: { provin_reason: "dealer_data_no_data", provin_session: sessionId },
      },
      // Dubults klikšķis vai atkārtots mēģinājums nedrīkst atmaksāt divreiz.
      { idempotencyKey: `provin-dealer-refund-${sessionId}` },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 300) : "unknown";
    console.error("[admin/dealer-data/refund] stripe refund failed", { sessionId, detail });
    return NextResponse.json({ error: "refund_failed", detail }, { status: 502 });
  }

  const record: DealerRefundRecord = {
    at: new Date().toISOString(),
    amountCents: decision.amountCents,
    stripeRefundId: refund.id,
    by: "admin",
    reason: String(o.reason ?? "dealer_data_no_data").slice(0, REFUND_REASON_MAX),
  };

  const now = new Date().toISOString();
  const persisted = await writeDealerDataJob({
    sessionId,
    vin: job?.vin ?? "",
    status: job?.status ?? "no_data",
    attempts: job?.attempts ?? 0,
    createdAt: job?.createdAt ?? now,
    updatedAt: now,
    ...(job?.startedAt ? { startedAt: job.startedAt } : {}),
    ...(job?.finishedAt ? { finishedAt: job.finishedAt } : {}),
    serviceEventCount: job?.serviceEventCount ?? 0,
    refund: record,
  });
  if (!persisted) {
    // Nauda ir atgriezta; bez ieraksta poga paliktu atkārtoti spiežama.
    console.error("[admin/dealer-data/refund] refund succeeded but state write failed", {
      sessionId,
      stripeRefundId: refund.id,
    });
  }

  let emailSent = false;
  const to = session.customer_details?.email ?? session.customer_email ?? "";
  if (o.notifyEmail === true && to) {
    emailSent = await trySendDealerDataRefundEmail({
      to,
      vin: job?.vin ?? null,
      amountEur: `${(decision.amountCents / 100).toFixed(2)} €`,
      cancelled: o.cancelled === true,
    });
  }

  return NextResponse.json({
    ok: true,
    refund: record,
    statePersisted: persisted,
    emailSent,
    job: await readDealerDataJob(sessionId),
  });
}
