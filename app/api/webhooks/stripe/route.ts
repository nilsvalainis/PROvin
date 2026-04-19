import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendPaymentConfirmationEmail } from "@/lib/email/send-transactional";
import { notifyAdminEmail, notifyAdminTelegram } from "@/lib/notify";
import { persistPaidOrderInvoice } from "@/lib/invoice-storage";
import { releaseStripeEvent, tryBeginStripeEvent } from "@/lib/stripe-webhook-dedupe";
import { ensureConsultationDraftSeed } from "@/lib/admin-consultation-draft-store";
import { getCheckoutLineFromSession, getOrderFieldsFromSession } from "@/lib/stripe-session";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fulfillDedupeKey(sessionId: string): string {
  return `fulfill:${sessionId}`;
}

/**
 * Apstrāde pēc apmaksas: Telegram, admin e-pasts, klienta apstiprinājums, rēķina saglabāšana.
 * Izsauc tikai tad, kad `payment_status` ir apmaksāts (vai `no_payment_required`).
 */
async function fulfillPaidCheckoutSession(
  stripe: Stripe,
  stripeEventId: string,
  thinSession: Stripe.Checkout.Session,
): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(thinSession.id);
  const ps = session.payment_status;
  if (ps !== "paid" && ps !== "no_payment_required") {
    console.info("[stripe webhook] skip fulfillment — session not paid yet", {
      sessionId: session.id,
      payment_status: ps,
    });
    releaseStripeEvent(stripeEventId);
    return;
  }

  if (!tryBeginStripeEvent(fulfillDedupeKey(session.id))) {
    console.info("[stripe webhook] fulfillment already recorded for session", { sessionId: session.id });
    return;
  }

  try {
    const order = getOrderFieldsFromSession(session);
    const email = session.customer_details?.email ?? session.customer_email ?? null;
    const phoneStripe = session.customer_details?.phone ?? null;
    const phone = order.formPhone ?? phoneStripe;

    const payload = {
      sessionId: session.id,
      customerEmail: email,
      customerPhone: phone,
      customerName: order.customerName,
      vin: order.vin,
      listingUrl: order.listingUrl,
      contactMethod: order.contactMethod,
      notes: order.notes,
      amountTotal:
        session.amount_total != null ? (session.amount_total / 100).toFixed(2) : null,
      currency: session.currency?.toUpperCase() ?? null,
    };

    try {
      await notifyAdminTelegram(payload);
    } catch (e) {
      console.error("Telegram notify:", e);
    }
    try {
      await notifyAdminEmail(payload);
      console.info("[stripe webhook] admin order notification sent", { sessionId: session.id });
    } catch (e) {
      console.error("Email notify:", e);
    }

    if (email) {
      try {
        await sendPaymentConfirmationEmail({
          to: email,
          sessionId: session.id,
          amountTotal: payload.amountTotal,
          currency: payload.currency,
          vin: payload.vin,
        });
        console.info("[stripe webhook] payment confirmation email sent", { sessionId: session.id, to: email });
      } catch (e) {
        console.error("[stripe webhook] Customer payment confirmation email failed:", e);
      }
    } else {
      console.warn("[stripe webhook] paid session: no customer email — payment confirmation skipped");
    }

    console.info("PROVIN order:", payload);

    void persistPaidOrderInvoice(session.id).catch((err) => {
      console.error("invoice persist:", err);
    });

    if (getCheckoutLineFromSession(session) === "provin_select") {
      void ensureConsultationDraftSeed(session.id).catch((err) => {
        console.error("[stripe webhook] consultation draft seed:", err);
      });
    }
  } catch (e) {
    releaseStripeEvent(fulfillDedupeKey(thinSession.id));
    throw e;
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Izmanto POST. Stripe webhook nosūta tikai POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET nav iestatīts" }, { status: 500 });
  }

  const raw = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Nav stripe-signature" }, { status: 400 });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY nav iestatīts" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Webhook paraksts: ${msg}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (!tryBeginStripeEvent(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    try {
      const thin = event.data.object as Stripe.Checkout.Session;
      await fulfillPaidCheckoutSession(stripe, event.id, thin);
    } catch (e) {
      releaseStripeEvent(event.id);
      console.error(`[stripe webhook] ${event.type}:`, e);
      return NextResponse.json({ error: "Apstrādes kļūda" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
