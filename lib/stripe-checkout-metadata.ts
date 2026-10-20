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

/**
 * Atslēgas, ko drīkst uzstādīt tikai serveris. Klienta ķermenis, sīkdatne vai
 * CAPI/UTM izkliede tās nedrīkst pārrakstīt (`fulfillment=b2b_pack` u.c.).
 */
export const STRIPE_SERVER_METADATA_KEYS = [
  "fulfillment",
  "partner_id",
  "pack_qty",
  "topup_cents",
  "checkout_line",
  "product_tier",
  "upgrade_of",
  "order_id",
  "upgrade_kind",
  "upgrade_token",
  "client_link_hash",
] as const;

export type StripeServerMetadataKey = (typeof STRIPE_SERVER_METADATA_KEYS)[number];

const SERVER_METADATA_KEY_SET = new Set<string>(STRIPE_SERVER_METADATA_KEYS);

export function isStripeServerMetadataKey(key: string): boolean {
  return SERVER_METADATA_KEY_SET.has(key);
}

/** Noņem servera atslēgas no neuzticama avota (sīkdatne, CAPI, formas izkliede). */
export function omitStripeServerMetadataKeys(
  untrusted: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!untrusted) return out;
  for (const [key, value] of Object.entries(untrusted)) {
    if (!key || isStripeServerMetadataKey(key)) continue;
    if (typeof value !== "string") continue;
    out[key] = value;
  }
  return out;
}

/**
 * Stripe Checkout `metadata`: vispirms neuzticamie lauki (bez rezervētajām atslēgām),
 * servera atslēgas vienmēr pēdējās.
 */
export function mergeStripeCheckoutMetadata(
  untrusted: Record<string, string> | null | undefined,
  trusted: Record<string, string>,
): Record<string, string> {
  return {
    ...omitStripeServerMetadataKeys(untrusted),
    ...trusted,
  };
}
