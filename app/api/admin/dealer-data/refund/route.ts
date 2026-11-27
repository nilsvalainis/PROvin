/**
 * Manuāla dīlera pasūtījuma atmaksa, kad OEM datu par VIN nav.
 *
 * B2C Stripe `cs_*` (Nils 26.11): tikai no atmaksas loga - Nils redz un labo klienta tekstu.
 *   Kārtība: teksts + saņēmējs pārbaudīti -> slēdzene (CAS) -> Stripe atmaksa -> TIKAI tad e-pasts
 *   ar Nila apstiprināto tekstu. Ja Stripe neizdodas - e-pastu nesūta. Dubulta atmaksa nav iespējama.
 * B2B manuālais VIN (manual_order_*): 1 kredīts atpakaļ partnera kontā.
 * B2B maka pirkums (wallet_txn=): summa atpakaļ partnera atlikumā + IRISS e-pasts.
 */
import { NextResponse } from "next/server";

import {
  dealerRefundEmailFacts,
  parseDealerStripeRefundMessage,
  resolveDealerRefundClientEmail,
} from "@/lib/admin-dealer-data-refund";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { isManualOrderId } from "@/lib/admin-manual-orders";
import { rememberB2bDebitKey, restoreB2bCredit, walletHasDebitKey } from "@/lib/b2b-partner-credits";
import { updateB2bCreditWallet } from "@/lib/b2b-partner-credit-store";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { parseB2bWalletOrderMarks } from "@/lib/b2b-wallet";
import { notifyB2bWalletRefundEmail, refundB2bWalletOrder } from "@/lib/b2b-wallet-refund";
import {
  claimDealerRefundLock,
  readDealerDataJob,
  releaseDealerRefundLock,
  upsertDealerDataJob,
  writeDealerDataJob,
} from "@/lib/dealer-data-job-store";
import {
  DEALER_REFUND_MAX_CENTS,
  decideDealerRefund,
  decideDealerRefundLock,
  isDealerDataAutoFetchOrder,
  type DealerRefundRecord,
} from "@/lib/dealer-data-job-types";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import { dealerSendRecordFromInput } from "@/lib/order-client-marks";
import { recordDealerSendOnServer } from "@/lib/order-client-marks-store";
import { dealerSendRecipientErrorBody, resolveDealerSendRecipient } from "@/lib/dealer-send-recipient";
import { checkoutSessionSiteLang } from "@/lib/checkout-session-site-lang";
import { clientLangSignalsFromSession, decideClientLangForOrder } from "@/lib/client-lang-detect";
import { getStripe } from "@/lib/stripe";
import { getCheckoutLineFromSession } from "@/lib/stripe-session";

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

/**
 * Atmaksas loga sākuma dati (tikai lasa, naudu neaiztiek): summa, klienta valoda (vietnes lapa),
 * e-pasts, VIN un vai atmaksa vispār atļauta.
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId) || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  const [session, job, draft] = await Promise.all([
    stripe.checkout.sessions.retrieve(sessionId).catch(() => null),
    readDealerDataJob(sessionId),
    readOrderDraft(sessionId),
  ]);
  if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  const decision = decideDealerRefund({
    job,
    amountTotalCents: session.amount_total,
    paid: session.payment_status === "paid",
    override: job?.status !== "no_data",
    dealerProduct: isDealerDataAutoFetchOrder({
      checkoutLine: getCheckoutLineFromSession(session),
      amountTotalCents: session.amount_total,
    }),
  });
  const lock = decideDealerRefundLock(job);
  return NextResponse.json({
    ok: true,
    allowed: decision.allowed && lock.ok,
    ...(decision.allowed ? {} : { reason: decision.reason }),
    ...(lock.ok ? {} : { reason: lock.reason }),
    amountCents: decision.allowed ? decision.amountCents : (session.amount_total ?? null),
    // Klienta valoda: admina izvēle / vietnes lapa, kurā pasūtīja (#1274) / EN-DE + Latvijas signāli -> LV.
    lang: decideClientLangForOrder(
      {
        notes: null,
        locale: checkoutSessionSiteLang(session),
        vin: session.metadata?.vin ?? null,
        customerEmail: session.customer_email ?? null,
        customerDetailsEmail: session.customer_details?.email ?? null,
        phone: session.metadata?.phone ?? null,
        customerDetailsPhone: session.customer_details?.phone ?? null,
        customerName: session.metadata?.customer_name ?? session.customer_details?.name ?? null,
        clientLangSignals: clientLangSignalsFromSession(session),
      },
      draft,
    ).lang,
    customerEmail: resolveDealerRefundClientEmail([
      draft?.orderEdits?.customerEmail,
      session.customer_details?.email,
      session.customer_email,
    ]),
    vin: (job?.vin || draft?.orderEdits?.vin || "").trim(),
    override: job?.status !== "no_data",
  });
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
    if (parseB2bWalletOrderMarks(notes)) {
      const walletRefund = await refundB2bWalletOrder(sessionId, {
        requireNoData: o.override !== true,
        by: "admin",
        reason: String(o.reason ?? "dealer_data_no_data_wallet").slice(0, REFUND_REASON_MAX),
      });
      if (!walletRefund.refunded && walletRefund.reason !== "already_refunded") {
        return NextResponse.json({ error: walletRefund.reason, job }, { status: 409 });
      }
      const emailSent = await notifyB2bWalletRefundEmail(sessionId);
      const refreshed = await readDealerDataJob(sessionId);
      if (!walletRefund.refunded && !refreshed?.refund) {
        return NextResponse.json({ error: walletRefund.reason, job }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        refund: refreshed?.refund ?? null,
        kind: "wallet",
        statePersisted: Boolean(refreshed?.refund),
        emailSent,
        job: refreshed,
      });
    }
    const partnerId = partnerIdFromNotes(notes);
    if (!partnerId) {
      return NextResponse.json({ error: "partner_missing" }, { status: 409 });
    }
    const refundKey = `refund:${sessionId}`;
    await updateB2bCreditWallet(partnerId, (wallet) => {
      if (walletHasDebitKey(wallet, refundKey)) return { value: false };
      return {
        wallet: rememberB2bDebitKey(restoreB2bCredit(wallet, "dealer", lotIdFromNotes(notes)), refundKey),
        value: true,
      };
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
      // Saglabā kļūdu, trigeri un maksas rezultātus (oneautoResults), lai atkārtota
      // ielase neiekasētu vēlreiz un adminā redzams iemesls.
      ...(job ?? {}),
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

  // Nils 26.11: bez loga teksta atmaksas nav. Kanāls + teksts (+ e-pastam temats) obligāti.
  const parsed = parseDealerStripeRefundMessage(o);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const message = parsed.message;

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
    dealerProduct: isDealerDataAutoFetchOrder({
      checkoutLine: getCheckoutLineFromSession(session),
      amountTotalCents: session.amount_total,
    }),
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

  // E-pasta saņēmējs jāzina PIRMS naudas kustības (citādi nauda atgriezta, bet ziņa nekur neaiziet).
  const draft = await readOrderDraft(sessionId);
  let to = "";
  if (message.channel === "email") {
    const recipient = await resolveDealerSendRecipient({
      logTag: "api/admin/dealer-data/refund",
      sessionId,
      requested: String(o.customerEmail ?? ""),
      confirmOverride: o.confirmRecipientOverride === true,
      draftEmail: draft?.orderEdits?.customerEmail?.trim() ?? "",
      orderEmail: resolveDealerRefundClientEmail([session.customer_details?.email, session.customer_email]),
      order: { notes: draft?.orderEdits?.notes ?? "" },
    });
    if (!recipient.ok) {
      return NextResponse.json(dealerSendRecipientErrorBody(recipient), { status: recipient.status });
    }
    to = recipient.to;
  }

  // Dubulta atmaksa nav iespējama: CAS slēdzene + Stripe idempotences atslēga.
  const lock = await claimDealerRefundLock(sessionId, { vin: job?.vin ?? draft?.orderEdits?.vin ?? "" });
  if (!lock.ok) {
    return NextResponse.json({ error: lock.reason, job }, { status: lock.reason === "store_error" ? 503 : 409 });
  }

  let refund: Awaited<ReturnType<typeof stripe.refunds.create>>;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: decision.amountCents,
        reason: "requested_by_customer",
        metadata: { provin_reason: "dealer_data_no_data", provin_session: sessionId, provin_approved: "admin_dialog" },
      },
      { idempotencyKey: `provin-dealer-refund-${sessionId}` },
    );
  } catch (e) {
    await releaseDealerRefundLock(sessionId);
    const detail = e instanceof Error ? e.message.slice(0, 300) : "unknown";
    console.error("[admin/dealer-data/refund] stripe refund failed", { sessionId, detail });
    // Atmaksa neizdevās - e-pastu NESŪTA.
    return NextResponse.json({ error: "refund_failed", detail, emailSent: false }, { status: 502 });
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
  const base = (await readDealerDataJob(sessionId)) ?? lock.job;
  const { refundPendingAt: _lock, ...baseRest } = base;
  void _lock;
  const persisted = await writeDealerDataJob({
    // Saglabā kļūdu, trigeri un maksas rezultātus (oneautoResults), lai atkārtota
    // ielase neiekasētu vēlreiz un adminā redzams iemesls. Slēdzene noņemta, atmaksa ierakstīta.
    ...baseRest,
    sessionId,
    updatedAt: now,
    refund: record,
  });
  if (!persisted) {
    console.error("[admin/dealer-data/refund] refund succeeded but state write failed", {
      sessionId,
      stripeRefundId: refund.id,
    });
  }

  const vin = (job?.vin || draft?.orderEdits?.vin || "").trim() || null;
  let emailSent = false;
  let emailError: "send_failed" | undefined;
  if (message.channel === "email") {
    // Aiziet tieši Nila apstiprinātais (rediģētais) teksts - bez «nosūtīts automātiski».
    emailSent = await trySendDealerDataOperatorEmail({
      to,
      subject: message.subject,
      text: message.text,
      lang: message.lang,
      humanSent: true,
      context: {
        situation: o.cancelled === true ? "cancelled" : "no_data",
        productKind: "dealer",
        vin,
        facts: dealerRefundEmailFacts(message.lang, decision.amountCents),
      },
    });
    if (emailSent) {
      await upsertDealerDataJob(sessionId, {
        vin: vin ?? "",
        refund: { ...record, emailSentAt: new Date().toISOString() },
      });
    } else {
      emailError = "send_failed";
    }
  }
  // Klienta saziņas žurnāls: e-pasts (ja aizgāja) vai WhatsApp (logs atver wa.me ar to pašu tekstu).
  const marks =
    emailSent || message.channel === "whatsapp"
      ? await recordDealerSendOnServer(
          sessionId,
          dealerSendRecordFromInput({ situation: o.cancelled === true ? "cancelled" : "no_data" }, message.channel, now, "no_data"),
        )
      : null;

  return NextResponse.json({
    ok: true,
    refund: record,
    kind: "stripe",
    channel: message.channel,
    statePersisted: persisted,
    emailSent,
    ...(to ? { to } : {}),
    ...(emailError ? { emailError } : {}),
    ...(marks ? { marks } : {}),
    job: await readDealerDataJob(sessionId),
  });
}

