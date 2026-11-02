import "server-only";

import type Stripe from "stripe";
import { invalidateStripeSessionCache } from "@/lib/admin-stripe-cache";
import { getManualOrder, isManualOrderId, updateManualOrder } from "@/lib/admin-manual-orders";
import { trySendDealerDataOperatorEmail } from "@/lib/email/send-transactional";
import {
  applyManualOrderStripePayment,
  buildManualOrderPaidEmail,
  manualOrderIdFromStripeMetadata,
} from "@/lib/manual-order-payment";
import { notifyAdminTelegram } from "@/lib/notify";

/**
 * Stripe apmaksa piesaista esošo `manual_order_*`.
 * Darba zona, komentāri un PDF paliek. Jauna pasūtījuma rinda netiek veidota.
 */
export async function fulfillManualOrderPayment(session: Stripe.Checkout.Session): Promise<void> {
  const manualOrderId = manualOrderIdFromStripeMetadata(session.metadata);
  if (!manualOrderId || !isManualOrderId(manualOrderId)) {
    throw new Error("manual_order_metadata_missing");
  }

  const rec = await getManualOrder(manualOrderId);
  if (!rec) throw new Error("manual_order_missing");

  const outcome = applyManualOrderStripePayment(
    rec,
    {
      stripeSessionId: session.id,
      amountCents: typeof session.amount_total === "number" ? session.amount_total : rec.amountTotal,
    },
    new Date().toISOString(),
  );

  if (outcome.action === "extra") {
    console.error("[manual-order-pay] extra payment on a settled order", {
      manualOrderId,
      stripeSessionId: session.id,
      paidStripeSessionId: rec.paidStripeSessionId,
    });
    return;
  }

  if (outcome.action === "apply") {
    const written = await updateManualOrder(manualOrderId, {
      amountTotal: outcome.next.amountTotal,
      paidAt: outcome.next.paidAt ?? null,
      paidStripeSessionId: outcome.next.paidStripeSessionId ?? null,
    });
    if (!written.ok) throw new Error(written.error);
    invalidateStripeSessionCache(manualOrderId);
  }

  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const amountCents =
    typeof session.amount_total === "number" && session.amount_total > 0
      ? session.amount_total
      : rec.amountTotal ?? 0;
  const paidCopy = buildManualOrderPaidEmail({
    serviceName: rec.serviceName ?? session.metadata?.service_name,
    amountCents,
  });

  if (outcome.action === "apply" && email) {
    try {
      await trySendDealerDataOperatorEmail({ to: email, subject: paidCopy.subject, text: paidCopy.text });
    } catch (err) {
      console.error("[manual-order-pay] paid email failed", err);
    }
  }

  if (outcome.action === "apply") {
    try {
      await notifyAdminTelegram({
        sessionId: manualOrderId,
        customerEmail: email,
        customerPhone: session.metadata?.phone?.trim() || null,
        customerName: null,
        vin: session.metadata?.vin?.trim() || null,
        listingUrl: null,
        contactMethod: null,
        notes: "Manuālā pasūtījuma apmaksa saņemta. Pasūtījuma id paliek tas pats.",
        heardAbout: null,
        amountTotal: (amountCents / 100).toFixed(2),
        currency: "EUR",
      });
    } catch (err) {
      console.error("[manual-order-pay] telegram failed", err);
    }
  }
}
