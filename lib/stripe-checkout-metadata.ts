/**
 * Stripe Checkout metadata for public products (MINI, AUDITS, Dīlera dati).
 * Internal catalog still uses plan ids `plus` (39,99 € MINI) and `premium` (AUDITS).
 * Old sessions may have `product_tier: plus` - readers must keep that alias.
 */

export type StripeProductTier = "mini" | "audits" | "dealer" | "koreaUsa";

/** Public product id written to Stripe `metadata.product_tier`. */
export function stripeProductTierFromPlanId(planId: string): StripeProductTier | string {
  const raw = planId.trim();
  if (raw === "plus" || raw === "mini" || raw === "listing_filter") return "mini";
  if (raw === "premium" || raw === "audit" || raw === "audits") return "audits";
  if (raw === "dealer") return "dealer";
  if (raw === "koreaUsa") return "koreaUsa";
  return raw;
}

/**
 * `metadata.checkout_line` values that `getCheckoutLineFromSession` already understands.
 * `plus` is not written for new checkouts; old PaymentIntents may still have it.
 */
export function stripeCheckoutLineFromPlanId(planId: string): string {
  const raw = planId.trim();
  if (raw === "plus" || raw === "mini" || raw === "listing_filter") return "mini";
  if (raw === "premium" || raw === "audits") return "premium";
  if (raw === "audit") return "audit";
  if (raw === "dealer") return "dealer";
  return raw;
}

export function stripeCheckoutProductMetadata(planId: string): {
  checkout_line: string;
  product_tier: string;
} {
  return {
    checkout_line: stripeCheckoutLineFromPlanId(planId),
    product_tier: stripeProductTierFromPlanId(planId),
  };
}
