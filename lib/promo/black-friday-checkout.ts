/**
 * Black Friday Stripe Checkout: serveris pats nosaka laiku un cenu (klienta dati netiek ņemti vērā).
 * Akcijas laikā rindu vienmēr veido ar `price_data` (bez Stripe Catalog cenas / kupona),
 * tāpēc Stripe live kontā nekas nav jāveido.
 */

import {
  BLACK_FRIDAY_PROMO_ID,
  getBlackFridayPlanPrice,
  isBlackFridaySwitchOn,
} from "@/lib/promo/black-friday";

export type CheckoutLineItem =
  | { price: string; quantity: number }
  | {
      price_data: {
        currency: string;
        product_data: { name: string; description?: string };
        unit_amount: number;
      };
      quantity: number;
    };

export type BlackFridayCheckoutResult = {
  lineItem: CheckoutLineItem;
  /** Papildu Stripe metadata (tukšs, ja akcija nav aktīva). */
  metadata: Record<string, string>;
  /** Summa centos (Meta InitiateCheckout fallback). */
  amountCents: number;
};

/** Servera slēdzis no env (izsauc tikai serverī). */
export function blackFridayEnabledFromEnv(env: Record<string, string | undefined> = process.env): boolean {
  return isBlackFridaySwitchOn(env.PROMO_BF_ENABLED);
}

export function applyBlackFridayToCheckout(args: {
  planId: string;
  baseLineItem: CheckoutLineItem;
  baseAmountCents: number;
  productName: string;
  productDesc?: string;
  nowMs: number;
  enabled: boolean;
}): BlackFridayCheckoutResult {
  const promo = getBlackFridayPlanPrice(args.planId, { nowMs: args.nowMs, enabled: args.enabled });
  if (!promo) {
    return { lineItem: args.baseLineItem, metadata: {}, amountCents: args.baseAmountCents };
  }
  return {
    lineItem: {
      price_data: {
        currency: "eur",
        product_data: {
          name: args.productName,
          ...(args.productDesc ? { description: args.productDesc } : {}),
        },
        unit_amount: promo.promoCents,
      },
      quantity: 1,
    },
    metadata: {
      promo: BLACK_FRIDAY_PROMO_ID,
      promo_regular_cents: String(promo.regularCents),
    },
    amountCents: promo.promoCents,
  };
}
