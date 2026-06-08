import {
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";
import { TP5_CHECKOUT_SOURCE } from "@/lib/test-pricing-5-checkout-routing";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export const TP5_INLINE_CHECKOUT_SOURCE = "test-pricing-5" as const;

export type Tp5StripeCheckoutProduct = {
  productName: string;
  productDesc: string;
  amountCents: number;
};

/** `/test-pricing-5` un `/test-checkout` — vienmēr `price_data` (bez Stripe Catalog ID). */
export const TP5_STRIPE_CHECKOUT_PRODUCT: Record<
  Extract<TestPricingPlanId, "plus" | "premium">,
  Tp5StripeCheckoutProduct
> = {
  plus: {
    productName: "PROVIN MINI",
    productDesc: "Sludinājuma, tehnisko datu un risku analīze.",
    amountCents: 3999,
  },
  premium: {
    productName: "PROVIN AUDITS",
    productDesc:
      "Detalizēta auto vēstures un risku analīze ar maksas vēstures atskaitēm un oficiālā dīlera datiem.",
    amountCents: 9999,
  },
};

export function isTp5CheckoutSource(sourcePage: string): boolean {
  return sourcePage === TP5_INLINE_CHECKOUT_SOURCE || sourcePage === TP5_CHECKOUT_SOURCE;
}

export function getTp5StripeCheckoutProduct(
  planId: TestPricingPlanId,
): Tp5StripeCheckoutProduct | null {
  if (planId === "plus" || planId === "premium") {
    return TP5_STRIPE_CHECKOUT_PRODUCT[planId];
  }
  return null;
}

export type Tp5InlineFieldErrors = {
  listingUrl?: string;
  vin?: string;
};

export function validateTp5InlineFields(
  listingUrl: string,
  vin: string,
): { ok: true } | { ok: false; errors: Tp5InlineFieldErrors } {
  const errors: Tp5InlineFieldErrors = {};
  const listing = listingUrl.trim();

  if (!listing) {
    errors.listingUrl = "Ievadi sludinājuma saiti.";
  } else if (!isPlausibleListingUrl(listing)) {
    errors.listingUrl = "Saitei jābūt pilnai adresei uz konkrētu sludinājumu.";
  }

  const normalized = normalizeVin(vin.trim());
  if (!normalized || !isValidVin(normalized)) {
    errors.vin = "Ievadi derīgu 17 zīmju VIN kodu.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}
