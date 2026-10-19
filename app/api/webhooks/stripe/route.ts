import { headers } from "next/headers";
import { NextResponse, after } from "next/server";
import Stripe from "stripe";
import { sendB2bWalletTopupInvoiceEmail, sendPaymentConfirmationEmail } from "@/lib/email/send-transactional";
import { getInvoiceEmailAttachment } from "@/lib/email/invoice-email-attachment";
import { renderB2bTopupInvoiceEmail } from "@/lib/b2b-topup-invoice";
import { getB2bPartnerById } from "@/lib/b2b-partner-store";
import { attachB2bWalletTopupInvoice, applyB2bWalletTopup, formatB2bWalletEuro } from "@/lib/b2b-wallet";
import { readB2bWallet, updateB2bWallet } from "@/lib/b2b-wallet-store";
import { notifyAdminEmail, notifyAdminTelegram } from "@/lib/notify";
import { persistPaidOrderInvoice } from "@/lib/invoice-storage";
import { triggerInvoiceSequenceRepairInBackground } from "@/lib/invoice-counter";
import { releaseStripeEvent, tryBeginStripeEvent } from "@/lib/stripe-webhook-dedupe";
import { ensureConsultationDraftSeed } from "@/lib/admin-consultation-draft-store";
import { getCheckoutLineFromSession, getOrderFieldsFromSession } from "@/lib/stripe-session";
import { upsertPaidCheckoutSessionFromStripe } from "@/lib/admin-orders";
import { getStripe } from "@/lib/stripe";
import { seedPaidOrderAutoSources } from "@/lib/admin-paid-order-source-seed";
import { runOrderFreeVinScan } from "@/lib/order-vin-scan-run";
import {
  ensureOrderDraftEditsFromCheckoutFields,
  resolveOrderVinFromPlate,
} from "@/lib/order-plate-vin-resolve";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { autoImportQuickEvalForPaidOrder } from "@/lib/quick-eval-service";
import { enqueueDealerDataJob, runDealerDataJob } from "@/lib/dealer-data-job";
import { isDealerDataAutoFetchOrder } from "@/lib/dealer-data-job-types";
import { fulfillOrderUpsellPayment } from "@/lib/order-upsell-fulfill";
import { clientLinkHashFromStripeMetadata } from "@/lib/client-link";
import { consumeClientLinkByHash } from "@/lib/client-link-store";
import { notifyMetaPurchaseFromStripeSession } from "@/lib/meta-capi";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { isB2bWalletTopupFulfillment } from "@/lib/b2b-partner-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// `after` uzdevumi (dīlera dati, sludinājums, CSDD, DK/EE/SE reģistri) turpina pēc atbildes.
export const maxDuration = 300;

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

  if (ps === "paid") {
    void notifyMetaPurchaseFromStripeSession(session);
  }

  if (!tryBeginStripeEvent(fulfillDedupeKey(session.id))) {
    console.info("[stripe webhook] fulfillment already recorded for session", { sessionId: session.id });
    return;
  }

  try {
    if ((session.metadata?.fulfillment ?? "").trim() === "order_upsell") {
      await fulfillOrderUpsellPayment(session);
      return;
    }

    try {
      await upsertPaidCheckoutSessionFromStripe(session);
    } catch (err) {
      console.warn("[stripe webhook] paid index upsert failed:", err);
    }

    const clientLinkHash = clientLinkHashFromStripeMetadata(session.metadata);
    if (clientLinkHash) {
      try {
        await consumeClientLinkByHash(clientLinkHash, session.id);
      } catch (err) {
        console.warn("[stripe webhook] client link consume failed:", err);
      }
    }

    const isWalletTopup = isB2bWalletTopupFulfillment(session.metadata?.fulfillment);
    if (isWalletTopup) {
      await creditB2bWalletTopupFromSession(session);
    }

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

    let persistedInvoice: { invoiceNumber: string } | null = null;
    try {
      persistedInvoice = await persistPaidOrderInvoice(session.id);
    } catch (err) {
      console.error("invoice persist:", err);
      throw err;
    }

    if (isWalletTopup && persistedInvoice) {
      const partnerId = session.metadata?.partner_id?.trim() ?? "";
      if (isSafeB2bPartnerId(partnerId)) {
        await updateB2bWallet(partnerId, (wallet) => ({
          value: true,
          next: attachB2bWalletTopupInvoice(wallet, {
            sessionId: session.id,
            invoiceNumber: persistedInvoice!.invoiceNumber,
          }),
        }));
      }
    }

    if (email) {
      try {
        const invoiceAttachment = await getInvoiceEmailAttachment(session.id);
        if (!invoiceAttachment) {
          throw new Error("invoice_attachment_missing");
        }
        if (isWalletTopup) {
          const partnerId = session.metadata?.partner_id?.trim() ?? "";
          const [partner, wallet] = await Promise.all([
            isSafeB2bPartnerId(partnerId) ? getB2bPartnerById(partnerId) : Promise.resolve(null),
            isSafeB2bPartnerId(partnerId) ? readB2bWallet(partnerId) : Promise.resolve(null),
          ]);
          const amountCents = session.amount_total ?? 0;
          const rendered = renderB2bTopupInvoiceEmail({
            summa: formatB2bWalletEuro(amountCents),
            atlikums: formatB2bWalletEuro(wallet?.balanceCents ?? amountCents),
            rekins: persistedInvoice?.invoiceNumber ?? "-",
            uznemums: partner?.companyName ?? "",
          });
          await sendB2bWalletTopupInvoiceEmail({
            to: email,
            subject: rendered.subject,
            text: rendered.text,
            invoiceAttachment,
          });
          console.info("[stripe webhook] B2B top-up invoice email sent", { sessionId: session.id, to: email });
        } else {
          await sendPaymentConfirmationEmail({
            to: email,
            sessionId: session.id,
            amountTotal: payload.amountTotal,
            currency: payload.currency,
            vin: payload.vin,
            invoiceAttachment,
          });
          console.info("[stripe webhook] payment confirmation email sent", { sessionId: session.id, to: email });
        }
      } catch (e) {
        console.error("[stripe webhook] Customer payment confirmation email failed:", e);
        throw e;
      }
    } else {
      console.warn("[stripe webhook] paid session: no customer email - payment confirmation skipped");
    }

    console.info("PROVIN order:", payload);
    triggerInvoiceSequenceRepairInBackground();
    if (isWalletTopup) return;

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
          const { updateB2bCreditWallet } = await import("@/lib/b2b-partner-credit-store");
          await updateB2bCreditWallet(partnerId, (wallet) => {
            if (walletHasGrantedSession(wallet, session.id)) return { value: false };
            return {
              wallet: grantB2bCredits(wallet, checkoutLine, qty, new Date(), session.id),
              value: true,
            };
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
     * Dīlera produkts: VIN Decoder + OE servisa vēsture jāielasa automātiski. OneAuto pollings
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
      // `after`, nevis `void`: ielase (relejs, CapSolver, mnt.ee) var ilgt pēc atbildes Stripe.
      // Visi avoti vienā piegājienā (paralēli zvani, viena saglabāšana), lai iekļautos 300 s.
      after(async () => {
        await ensureOrderDraftEditsFromCheckoutFields(session.id, {
          vinOrPlate: order.vin,
          listingUrl: order.listingUrl,
          customerEmail: email,
          customerPhone: phone,
          customerName: order.customerName,
          notes: order.notes,
        }).catch((err) => {
          console.error("[stripe webhook] order draft seed:", err);
        });

        let effectiveVin = order.vin?.trim() ? normalizeVin(order.vin) : "";
        if (effectiveVin && !isValidVin(effectiveVin)) {
          try {
            const resolved = await resolveOrderVinFromPlate(session.id, {
              stripeVin: order.vin,
              listingUrl: order.listingUrl,
              runDownstream: false,
            });
            if (resolved.effectiveVin) effectiveVin = resolved.effectiveVin;
            console.info("[stripe webhook] plate→vin", { sessionId: session.id, ...resolved });
          } catch (err) {
            console.error("[stripe webhook] plate→vin:", err);
          }
        }

        // Ātrais vērtējums ar to pašu VIN + e-pastu → dati pāriet automātiski (pirms bezmaksas ielases).
        try {
          const qe = await autoImportQuickEvalForPaidOrder(session.id, {
            vin: effectiveVin || order.vin,
            email,
          });
          if (qe) console.info("[stripe webhook] quick eval auto import", { sessionId: session.id, ...qe });
        } catch (err) {
          console.error("[stripe webhook] quick eval auto import:", err);
        }
        const vinForAuto = effectiveVin && isValidVin(effectiveVin) ? effectiveVin : order.vin;
        const [seedRes, scanRes] = await Promise.allSettled([
          seedPaidOrderAutoSources(session.id, {
            vin: vinForAuto,
            listingUrl: order.listingUrl,
          }),
          runOrderFreeVinScan(session.id, { vin: vinForAuto, listingUrl: order.listingUrl }),
        ]);
        if (seedRes.status === "fulfilled") {
          const r = seedRes.value;
          console.info("[stripe webhook] paid order auto sources", { sessionId: session.id, ...r });
          if (r.mnt_ee === "no_solver" || r.lkf_ee === "no_solver") {
            console.warn("[stripe webhook] Estonia registry seed skipped: nav CAPSOLVER_API_KEY");
          }
        } else {
          console.error("[stripe webhook] paid order auto sources:", seedRes.reason);
        }
        if (scanRes.status === "fulfilled") {
          console.info("[stripe webhook] free VIN SCAN", { sessionId: session.id, ...scanRes.value });
        } else {
          console.error("[stripe webhook] free VIN SCAN:", scanRes.reason);
        }
      });
    }
  } catch (e) {
    releaseStripeEvent(fulfillDedupeKey(thinSession.id));
    throw e;
  }
}

/** Maka papildinājums: summa uz partnera atlikumu. Idempotents pēc Stripe sesijas id. */
async function creditB2bWalletTopupFromSession(session: Stripe.Checkout.Session): Promise<void> {
  const partnerId = session.metadata?.partner_id?.trim() ?? "";
  const amountCents = session.amount_total ?? 0;
  if (!isSafeB2bPartnerId(partnerId) || amountCents <= 0) {
    console.error("[stripe webhook] wallet topup: invalid partner or amount", { sessionId: session.id });
    return;
  }
  const applied = await updateB2bWallet(partnerId, (wallet) => {
    const r = applyB2bWalletTopup(wallet, { amountCents, sessionId: session.id });
    return r.applied ? { value: true, next: r.wallet } : { value: false };
  });
  console.info("[stripe webhook] wallet topup", { sessionId: session.id, partnerId, amountCents, applied });
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
