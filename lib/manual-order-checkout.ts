import "server-only";

import {
  attachManualOrderCheckoutFields,
  buildManualOrderCheckoutSessionParams,
  canReuseManualOrderCheckout,
} from "@/lib/manual-order-payment";
import { updateManualOrder, type ManualOrderRecord } from "@/lib/admin-manual-orders";
import { invalidateStripeSessionCache } from "@/lib/admin-stripe-cache";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { mergeStripeCheckoutMetadata } from "@/lib/stripe-checkout-metadata";
import { getStripe } from "@/lib/stripe";
import { stripeCheckoutLocale } from "@/lib/stripe-session";

export async function createManualOrderPaymentCheckoutSession(opts: {
  record: ManualOrderRecord;
  amountCents: number;
  serviceName: string;
  email?: string | null;
  vin?: string | null;
  phone?: string | null;
  trackingMetadata?: Record<string, string>;
}): Promise<{ url: string; stripeSessionId: string; amountTotal: number | null }> {
  const stripe = getStripe();
  const params = buildManualOrderCheckoutSessionParams({
    manualOrderId: opts.record.id,
    amountCents: opts.amountCents,
    serviceName: opts.serviceName,
    email: opts.email,
    vin: opts.vin,
    phone: opts.phone,
    origin: getPublicSiteOrigin(),
  });
  const session = await stripe.checkout.sessions.create({
    ...params,
    locale: stripeCheckoutLocale("lv"),
    metadata: mergeStripeCheckoutMetadata(opts.trackingMetadata, params.metadata),
  });
  if (!session.url) {
    throw new Error("session_failed");
  }
  return {
    url: session.url,
    stripeSessionId: session.id,
    amountTotal: typeof session.amount_total === "number" ? session.amount_total : null,
  };
}

export async function ensureManualOrderStripePaymentUrl(args: {
  record: ManualOrderRecord;
  amountCents: number;
  serviceName: string;
  email?: string | null;
  vin?: string | null;
  phone?: string | null;
}): Promise<
  | { ok: true; url: string; stripeSessionId: string; record: ManualOrderRecord }
  | { ok: false; error: string }
> {
  try {
    if (canReuseManualOrderCheckout(args.record, args.amountCents, args.serviceName)) {
      const stripe = getStripe();
      const existing = await stripe.checkout.sessions.retrieve(args.record.stripeCheckoutSessionId!);
      if (existing.status === "open" && existing.url) {
        return {
          ok: true,
          url: existing.url,
          stripeSessionId: existing.id,
          record: args.record,
        };
      }
    }
    const created = await createManualOrderPaymentCheckoutSession(args);
    const next = attachManualOrderCheckoutFields(args.record, {
      amountCents: args.amountCents,
      serviceName: args.serviceName,
      stripeCheckoutSessionId: created.stripeSessionId,
      stripeCheckoutUrl: created.url,
    });
    const written = await updateManualOrder(args.record.id, {
      amountTotal: next.amountTotal,
      serviceName: next.serviceName ?? null,
      stripeCheckoutSessionId: next.stripeCheckoutSessionId ?? null,
      stripeCheckoutUrl: next.stripeCheckoutUrl ?? null,
    });
    if (!written.ok) return { ok: false, error: written.error };
    invalidateStripeSessionCache(args.record.id);
    return {
      ok: true,
      url: created.url,
      stripeSessionId: created.stripeSessionId,
      record: written.record,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("STRIPE_SECRET_KEY")) return { ok: false, error: "stripe_config" };
    console.error("[manual-order-pay] stripe checkout", e);
    return { ok: false, error: "stripe_session_failed" };
  }
}
