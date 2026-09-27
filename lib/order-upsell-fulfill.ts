import "server-only";

import type Stripe from "stripe";
import { setAuditDeadlineComplete } from "@/lib/admin-audit-complete-store";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { enqueueDealerDataJob } from "@/lib/dealer-data-job";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import { notifyAdminTelegram } from "@/lib/notify";
import { buildUpsellPaidEmail, isOrderUpsellKind } from "@/lib/order-upsell";
import { readUpsellByToken, settleUpsellOffer } from "@/lib/order-upsell-store";

/**
 * Stripe piepirkuma sesija papildina esošo pasūtījumu.
 * Darba zona, komentāri un PDF paliek. Jauna pasūtījuma rinda netiek veidota.
 */
export async function fulfillOrderUpsellPayment(session: Stripe.Checkout.Session): Promise<void> {
  const parentSessionId = session.metadata?.upgrade_of?.trim() ?? "";
  const kindRaw = session.metadata?.upgrade_kind?.trim() ?? "";
  const token = session.metadata?.upgrade_token?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(parentSessionId) || !isOrderUpsellKind(kindRaw)) {
    throw new Error("upsell_metadata_missing");
  }

  const found = await readUpsellByToken(token);
  if (found.state !== "ok" || found.parentSessionId !== parentSessionId || found.offer.kind !== kindRaw) {
    throw new Error("upsell_offer_missing");
  }

  const already = found.offer.status === "paid" || found.offer.status === "manual";
  if (already && found.offer.stripeSessionId && found.offer.stripeSessionId !== session.id) {
    console.error("[order-upsell] extra payment on a settled order", {
      parentSessionId,
      kind: kindRaw,
      stripeSessionId: session.id,
    });
    return;
  }

  if (!already) {
    const settled = await settleUpsellOffer({
      sessionId: parentSessionId,
      kind: kindRaw,
      status: "paid",
      stripeSessionId: session.id,
    });
    if (!settled.ok) throw new Error(settled.error);
  }

  const cleared = await setAuditDeadlineComplete(parentSessionId, false);
  if (!cleared.ok) throw new Error(cleared.error);

  const vin = session.metadata?.vin?.trim() || null;
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const paidCopy = buildUpsellPaidEmail({ vin, chargeCents: found.offer.chargeCents });

  if (email) {
    try {
      await trySendDealerDataOperatorEmail({ to: email, subject: paidCopy.subject, text: paidCopy.text });
    } catch (err) {
      console.error("[order-upsell] paid email failed", err);
    }
  }

  try {
    await notifyAdminTelegram({
      sessionId: parentSessionId,
      customerEmail: email,
      customerPhone: session.metadata?.phone?.trim() || null,
      customerName: null,
      vin,
      listingUrl: null,
      contactMethod: null,
      notes: "Piepirkums apmaksāts. Pasūtījums atkal neizpildīts, jaunas 48 h. Iepriekš ievadītie dati paliek.",
      heardAbout: null,
      amountTotal: (found.offer.chargeCents / 100).toFixed(2),
      currency: "EUR",
    });
  } catch (err) {
    console.error("[order-upsell] telegram failed", err);
  }

  if (kindRaw === "mini_to_dealer" && vin && !already) {
    try {
      await enqueueDealerDataJob({ sessionId: parentSessionId, vin });
    } catch (err) {
      console.error("[order-upsell] dealer enqueue failed", err);
    }
  }
}
