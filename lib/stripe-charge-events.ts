/**
 * Stripe `charge.refunded` un `charge.dispute.*` apstrāde (pēc apmaksas).
 * Atkarības padotas no ārpuses (webhook maršruts), lai uzvedību var testēt bez Stripe/Blob.
 */

import type { AdminPushMessage } from "@/lib/admin-push-shared";
import { pushVinTail } from "@/lib/admin-push-shared";
import { applyB2bWalletStripeCorrection, type B2bWallet } from "@/lib/b2b-wallet";
import { isSafeB2bPartnerId } from "@/lib/b2b-partner-account";
import { isB2bWalletTopupFulfillment } from "@/lib/b2b-partner-orders";
import {
  applyChargeRefund,
  applyDispute,
  stripeClawbackCents,
  stripeDisputeOutcome,
  type StripePaymentAdjustment,
} from "@/lib/stripe-payment-adjustments";

export const STRIPE_CHARGE_REFUND_EVENT = "charge.refunded";

/** Notikumi, kas jāpievieno Stripe panelī (Developers -> Webhooks -> endpoint -> Events). */
export const STRIPE_DISPUTE_EVENTS = [
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
] as const;

export function isStripeChargeAdjustmentEvent(type: string): boolean {
  return type === STRIPE_CHARGE_REFUND_EVENT || (STRIPE_DISPUTE_EVENTS as readonly string[]).includes(type);
}

/** Minimālā Checkout sesijas informācija, kas vajadzīga korekcijai. */
export type ChargeSessionInfo = {
  id: string;
  fulfillment: string | null;
  partnerId: string | null;
  vin: string | null;
  amountTotalCents: number | null;
};

export type StripeChargeEventDeps = {
  findSessionByPaymentIntent: (paymentIntentId: string) => Promise<ChargeSessionInfo | null>;
  /** Strīdam bez `payment_intent`: maksājuma id un summa no Charge. */
  retrieveCharge: (chargeId: string) => Promise<{ paymentIntentId: string; amountCents: number } | null>;
  updateAdjustment: <R>(
    sessionId: string,
    mutate: (current: StripePaymentAdjustment | undefined) => { value: R; next?: StripePaymentAdjustment },
  ) => Promise<R>;
  updateWallet: <R>(
    partnerId: string,
    mutate: (wallet: B2bWallet) => { value: R; next?: B2bWallet },
  ) => Promise<R>;
  push: (msg: AdminPushMessage) => Promise<unknown>;
  now: () => Date;
};

type StripeEventLike = {
  id: string;
  type: string;
  created: number;
  data: { object: unknown };
};

export type StripeChargeEventResult =
  | { handled: false; reason: "unsupported_event" | "no_payment_intent" | "session_not_found" }
  | {
      handled: true;
      sessionId: string;
      changed: boolean;
      walletCorrectedCents: number;
      pushed: boolean;
    };

function idOf(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string") {
    return ((raw as { id: string }).id ?? "").trim();
  }
  return "";
}

function num(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function adminPushDisputeMessage(p: {
  sessionId: string;
  vin: string | null;
  amountCents: number;
  reason: string;
  lost: boolean;
}): AdminPushMessage {
  const vin = pushVinTail(p.vin);
  const parts = [vin ? `VIN ${vin}` : "", eur(p.amountCents), p.reason ? `iemesls: ${p.reason}` : ""].filter(Boolean);
  return {
    title: p.lost ? "Stripe strīds zaudēts" : "Stripe strīds (chargeback)",
    body: parts.join(" · "),
    url: `/admin/orders/${encodeURIComponent(p.sessionId)}`,
    tag: `dispute-${p.sessionId}`,
    audience: "pro",
  };
}

async function correctWalletIfTopup(
  deps: StripeChargeEventDeps,
  session: ChargeSessionInfo,
  adj: StripePaymentAdjustment,
): Promise<number> {
  if (!isB2bWalletTopupFulfillment(session.fulfillment)) return 0;
  const partnerId = session.partnerId?.trim() ?? "";
  if (!isSafeB2bPartnerId(partnerId)) return 0;
  const target = stripeClawbackCents(adj);
  if (target <= 0) return 0;
  const note = adj.dispute && stripeDisputeOutcome(adj.dispute.status) === "lost"
    ? "Stripe strīds zaudēts - papildinājums atņemts"
    : "Stripe atmaksa - papildinājums atņemts";
  const now = deps.now();
  return deps.updateWallet(partnerId, (wallet) => {
    const r = applyB2bWalletStripeCorrection(wallet, { sessionId: session.id, targetCents: target, note, now });
    return r.applied ? { value: r.deltaCents, next: r.wallet } : { value: 0 };
  });
}

export async function handleStripeChargeEvent(
  event: StripeEventLike,
  deps: StripeChargeEventDeps,
): Promise<StripeChargeEventResult> {
  if (!isStripeChargeAdjustmentEvent(event.type)) return { handled: false, reason: "unsupported_event" };
  const obj = (event.data.object ?? {}) as Record<string, unknown>;
  const isRefund = event.type === STRIPE_CHARGE_REFUND_EVENT;

  const chargeId = isRefund ? idOf(obj.id) : idOf(obj.charge);
  let paymentIntentId = idOf(obj.payment_intent);
  let chargeAmountCents = isRefund ? num(obj.amount) : 0;
  if (!isRefund && chargeId && (!paymentIntentId || chargeAmountCents <= 0)) {
    const charge = await deps.retrieveCharge(chargeId);
    if (charge) {
      paymentIntentId = paymentIntentId || charge.paymentIntentId;
      chargeAmountCents = charge.amountCents;
    }
  }
  if (!paymentIntentId) return { handled: false, reason: "no_payment_intent" };

  const session = await deps.findSessionByPaymentIntent(paymentIntentId);
  if (!session) return { handled: false, reason: "session_not_found" };
  if (chargeAmountCents <= 0 && session.amountTotalCents) chargeAmountCents = session.amountTotalCents;

  const now = deps.now();
  // Rēķins tiek izrakstīts katram apmaksātam pasūtījumam; kredītrēķinu neveidojam (to dara Nils).
  const hasInvoice = true;

  if (isRefund) {
    const r = await deps.updateAdjustment(session.id, (current) => {
      const res = applyChargeRefund(current, {
        sessionId: session.id,
        chargeId,
        paymentIntentId,
        amountCents: chargeAmountCents,
        amountRefundedCents: num(obj.amount_refunded),
        eventCreated: event.created,
        hasInvoice,
        now,
      });
      return res.changed ? { value: res, next: res.next } : { value: res };
    });
    const walletCorrectedCents = await correctWalletIfTopup(deps, session, r.next);
    return { handled: true, sessionId: session.id, changed: r.changed, walletCorrectedCents, pushed: false };
  }

  const r = await deps.updateAdjustment(session.id, (current) => {
    const res = applyDispute(current, {
      sessionId: session.id,
      chargeId,
      paymentIntentId,
      chargeAmountCents,
      disputeId: idOf(obj.id),
      status: typeof obj.status === "string" ? obj.status : "needs_response",
      reason: typeof obj.reason === "string" ? obj.reason : "",
      disputeAmountCents: num(obj.amount),
      disputeCreated: num(obj.created) || event.created,
      eventCreated: event.created,
      hasInvoice,
      now,
    });
    return res.changed ? { value: res, next: res.next } : { value: res };
  });

  const walletCorrectedCents = await correctWalletIfTopup(deps, session, r.next);

  let pushed = false;
  if (r.becameOpen || r.becameLost) {
    try {
      await deps.push(
        adminPushDisputeMessage({
          sessionId: session.id,
          vin: session.vin,
          amountCents: num(obj.amount),
          reason: typeof obj.reason === "string" ? obj.reason : "",
          lost: r.becameLost,
        }),
      );
      pushed = true;
    } catch (err) {
      console.error("[stripe webhook] dispute push failed:", err);
    }
  }
  return { handled: true, sessionId: session.id, changed: r.changed, walletCorrectedCents, pushed };
}
