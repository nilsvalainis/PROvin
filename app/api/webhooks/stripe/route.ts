import { headers } from "next/headers";
import { NextResponse, after } from "next/server";
import Stripe from "stripe";
import { sendPaymentConfirmationEmail } from "@/lib/email/send-transactional";
import { getInvoiceEmailAttachment } from "@/lib/email/invoice-email-attachment";
import { notifyAdminEmail, notifyAdminTelegram } from "@/lib/notify";
import { persistPaidOrderInvoice } from "@/lib/invoice-storage";
import { triggerInvoiceSequenceRepairInBackground } from "@/lib/invoice-counter";
import { releaseStripeEvent, tryBeginStripeEvent } from "@/lib/stripe-webhook-dedupe";
import { ensureConsultationDraftSeed } from "@/lib/admin-consultation-draft-store";
import { getCheckoutLineFromSession, getOrderFieldsFromSession } from "@/lib/stripe-session";
import { upsertPaidCheckoutSessionFromStripe } from "@/lib/admin-orders";
import { getStripe } from "@/lib/stripe";
import { seedSsLvAdifyOnPaidOrder } from "@/lib/admin-ss-lv-adify-seed";
import { enqueueDealerDataJob, runDealerDataJob } from "@/lib/dealer-data-job";
import { isDealerDataAutoFetchOrder } from "@/lib/dealer-data-job-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fulfillDedupeKey(sessionId: string): string {
  return `fulfill:${sessionId}`;
}

/**
 * Apstrāde pēc apmaksas: Telegram, admin e-pasts, rēķina PDF, klienta apstiprinājums ar rēķinu.
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
    void upsertPaidCheckoutSessionFromStripe(session).catch((err) => {
      console.warn("[stripe webhook] paid index upsert failed:", err);
    });

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
      heardAbout: order.heardAbout,
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

    try {
      await persistPaidOrderInvoice(session.id);
    } catch (err) {
      console.error("invoice persist:", err);
      throw err;
    }

    if (email) {
      try {
        const invoiceAttachment = await getInvoiceEmailAttachment(session.id);
        if (!invoiceAttachment) {
          throw new Error("invoice_attachment_missing");
        }
        await sendPaymentConfirmationEmail({
          to: email,
          sessionId: session.id,
          amountTotal: payload.amountTotal,
          currency: payload.currency,
          vin: payload.vin,
          invoiceAttachment,
        });
        console.info("[stripe webhook] payment confirmation email sent", { sessionId: session.id, to: email });
      } catch (e) {
        console.error("[stripe webhook] Customer payment confirmation email failed:", e);
        throw e;
      }
    } else {
      console.warn("[stripe webhook] paid session: no customer email - payment confirmation skipped");
    }

    console.info("PROVIN order:", payload);
    triggerInvoiceSequenceRepairInBackground();

    const checkoutLine = getCheckoutLineFromSession(session);
    const fulfillment = session.metadata?.fulfillment?.trim() ?? "";
    const partnerId = session.metadata?.partner_id?.trim() ?? "";
    const packQtyRaw = Number.parseInt(session.metadata?.pack_qty ?? "", 10);

    if (
      fulfillment === "b2b_pack" &&
      (checkoutLine === "dealer" || checkoutLine === "business") &&
      partnerId
    ) {
      const qty = Number.isFinite(packQtyRaw) && packQtyRaw > 0 ? Math.min(packQtyRaw, 50) : 1;
      after(async () => {
        try {
          const { grantB2bCredits, walletHasGrantedSession } = await import("@/lib/b2b-partner-credits");
          const { readB2bCreditWallet, withB2bCreditLock, writeB2bCreditWallet } = await import(
            "@/lib/b2b-partner-credit-store"
          );
          await withB2bCreditLock(partnerId, async () => {
            const wallet = await readB2bCreditWallet(partnerId);
            if (walletHasGrantedSession(wallet, session.id)) return;
            const next = grantB2bCredits(wallet, checkoutLine, qty, new Date(), session.id);
            await writeB2bCreditWallet(partnerId, next);
          });
          console.info("[stripe webhook] b2b pack credits granted", {
            sessionId: session.id,
            partnerId,
            checkoutLine,
            qty,
          });
        } catch (err) {
          console.error("[stripe webhook] b2b pack credits:", err);
        }
      });
    }

    /**
     * Dīlera produkts: OE servisa vēsture jāielasa automātiski. OneAuto pollings
     * ir par lēnu webhook atbildei, tāpēc darbu atzīmējam sinhroni un izpildām
     * pēc atbildes; cron slaucītājs pārņem, ja fona izpilde nepaspēj.
     * B2B paka (bez VIN) šeit NEIELASA - ielase sākas tikai pie VIN iesniegšanas.
     */
    if (
      fulfillment !== "b2b_pack" &&
      order.vin &&
      isDealerDataAutoFetchOrder({ checkoutLine, amountTotalCents: session.amount_total })
    ) {
      const vin = order.vin;
      const queued = await enqueueDealerDataJob({ sessionId: session.id, vin }).catch((err) => {
        console.error("[stripe webhook] dealer data enqueue:", err);
        return false;
      });
      if (queued) {
        after(async () => {
          try {
            const r = await runDealerDataJob({ sessionId: session.id, vin, trigger: "webhook" });
            console.info("[stripe webhook] dealer data job", { sessionId: session.id, ...r });
          } catch (err) {
            console.error("[stripe webhook] dealer data job:", err);
          }
        });
      }
    }

    if (checkoutLine === "provin_select") {
      void ensureConsultationDraftSeed(session.id).catch((err) => {
        console.error("[stripe webhook] consultation draft seed:", err);
      });
    } else {
      void seedSsLvAdifyOnPaidOrder(session.id, order.listingUrl).then((r) => {
        if (r.ok) {
          console.info("[stripe webhook] ss.lv Adify listing seeded", { sessionId: session.id });
        } else if (r.reason !== "skip" && r.reason !== "no_listing_url") {
          console.warn("[stripe webhook] ss.lv Adify listing seed:", r.reason);
        }
      }).catch((err) => {
        console.error("[stripe webhook] ss.lv Adify listing seed:", err);
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
