/**
 * Manuāla dīlera pasūtījuma atmaksa, kad OEM datu par VIN nav.
 *
 * B2C Stripe `cs_*`: nauda uz karti.
 * B2B manuālais VIN (manual_order_*): 1 kredīts atpakaļ partnera kontā.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { isManualOrderId } from "@/lib/admin-manual-orders";
import { restoreB2bCredit } from "@/lib/b2b-partner-credits";
import { readB2bCreditWallet, withB2bCreditLock, writeB2bCreditWallet } from "@/lib/b2b-partner-credit-store";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
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

function partnerIdFromNotes(notes: string | undefined): string | null {
  const m = (notes ?? "").match(/partner_id=(ptr_[a-f0-9]{16})/);
  return m?.[1] && isSafeB2bPartnerId(m[1]) ? m[1] : null;
}

function lotIdFromNotes(notes: string | undefined): string | null {
  const m = (notes ?? "").match(/lot=([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

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

  const job = await readDealerDataJob(sessionId);

  if (isManualOrderId(sessionId)) {
    if (job?.refund) {
      return NextResponse.json({ error: "already_refunded", job }, { status: 409 });
    }
    if (o.override !== true && job?.status !== "no_data") {
      return NextResponse.json({ error: "not_no_data", job }, { status: 409 });
    }
    const draft = await readOrderDraft(sessionId);
    const notes = draft?.orderEdits?.notes ?? "";
    const partnerId = partnerIdFromNotes(notes);
    if (!partnerId) {
      return NextResponse.json({ error: "partner_missing" }, { status: 409 });
    }
    await withB2bCreditLock(partnerId, async () => {
      const wallet = await readB2bCreditWallet(partnerId);
      await writeB2bCreditWallet(partnerId, restoreB2bCredit(wallet, "dealer", lotIdFromNotes(notes)));
    });
    const now = new Date().toISOString();
    const record: DealerRefundRecord = {
      at: now,
      amountCents: 0,
      stripeRefundId: `credit_${sessionId}`,
      by: "admin",
      reason: String(o.reason ?? "dealer_data_no_data_credit").slice(0, REFUND_REASON_MAX),
      kind: "credit",
    };
    const persisted = await writeDealerDataJob({
      sessionId,
      vin: job?.vin ?? draft?.orderEdits?.vin ?? "",
      status: job?.status ?? "no_data",
      attempts: job?.attempts ?? 0,
      createdAt: job?.createdAt ?? now,
      updatedAt: now,
      ...(job?.startedAt ? { startedAt: job.startedAt } : {}),
      ...(job?.finishedAt ? { finishedAt: job.finishedAt } : {}),
      serviceEventCount: job?.serviceEventCount ?? 0,
      refund: record,
    });
    return NextResponse.json({
      ok: true,
      refund: record,
      kind: "credit",
      statePersisted: persisted,
      emailSent: false,
      job: await readDealerDataJob(sessionId),
    });
  }

  if (!sessionId.startsWith("cs_")) {
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
    kind: "stripe",
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
    kind: "stripe",
    statePersisted: persisted,
    emailSent,
    job: await readDealerDataJob(sessionId),
  });
}
