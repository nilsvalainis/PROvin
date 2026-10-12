import "server-only";

import {
  buildOrderUpsellCheckoutSessionParams,
  type OrderUpsellKind,
} from "@/lib/order-upsell";
import {
  attachUpsellStripeCheckout,
  type StoredUpsellOffer,
} from "@/lib/order-upsell-store";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe";
import { stripeCheckoutLocale } from "@/lib/stripe-session";

export async function createOrderUpsellCheckoutSession(opts: {
  kind: OrderUpsellKind;
  chargeCents: number;
  parentSessionId: string;
  token: string;
  targetLine: StoredUpsellOffer["targetLine"];
  vin?: string | null;
  phone?: string | null;
  email: string;
}): Promise<{ url: string; stripeSessionId: string }> {
  const stripe = getStripe();
  const params = buildOrderUpsellCheckoutSessionParams({
    ...opts,
    origin: getPublicSiteOrigin(),
  });
  const session = await stripe.checkout.sessions.create({
    ...params,
    locale: stripeCheckoutLocale("lv"),
  });
  if (!session.url) {
    throw new Error("session_failed");
  }
  return { url: session.url, stripeSessionId: session.id };
}

/**
 * MINI → AUDITS e-pastam: Stripe Checkout saite (vai jau atvērta sesija).
 * Metadata satur pasūtījuma ID un VIN; webhook palielina pasūtījumu uz AUDITS.
 */
export async function ensureOrderUpsellStripePaymentUrl(args: {
  parentSessionId: string;
  email: string;
  vin?: string | null;
  phone?: string | null;
  offer: StoredUpsellOffer;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const email = args.email.trim();
  if (!email) return { ok: false, error: "missing_email" };
  try {
    if (args.offer.stripeCheckoutSessionId && args.offer.stripeCheckoutUrl) {
      const stripe = getStripe();
      const existing = await stripe.checkout.sessions.retrieve(args.offer.stripeCheckoutSessionId);
      if (existing.status === "open" && existing.url) {
        return { ok: true, url: existing.url };
      }
    }
    const created = await createOrderUpsellCheckoutSession({
      kind: args.offer.kind,
      chargeCents: args.offer.chargeCents,
      parentSessionId: args.parentSessionId,
      token: args.offer.token,
      targetLine: args.offer.targetLine,
      vin: args.vin,
      phone: args.phone,
      email,
    });
    const attached = await attachUpsellStripeCheckout({
      sessionId: args.parentSessionId,
      kind: args.offer.kind,
      stripeCheckoutSessionId: created.stripeSessionId,
      stripeCheckoutUrl: created.url,
    });
    if (!attached.ok) return { ok: false, error: attached.error };
    return { ok: true, url: created.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("STRIPE_SECRET_KEY")) return { ok: false, error: "stripe_config" };
    console.error("[order-upsell] stripe checkout", e);
    return { ok: false, error: "stripe_session_failed" };
  }
}
