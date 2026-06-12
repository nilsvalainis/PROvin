import {
  isPlausibleListingUrl,
  isValidVinOrPlate,
  normalizeVin,
} from "@/lib/order-field-validation";
import { HOME_PRICING_CHECKOUT_SOURCE } from "@/lib/home-pricing-checkout";
import { TP5_CHECKOUT_SOURCE } from "@/lib/test-pricing-5-checkout-routing";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export const TP5_INLINE_CHECKOUT_SOURCE = "test-pricing-5" as const;

export type Tp5StripeCheckoutProduct = {
  productName: string;
  /** Ja nav — Stripe Checkout rāda tikai nosaukumu un cenu. */
  productDesc?: string;
  amountCents: number;
};

/** Sākumlapa, `/test-pricing-5` un `/test-checkout` — vienmēr `price_data` (bez Stripe Catalog ID). */
export const TP5_STRIPE_CHECKOUT_PRODUCT: Record<
  Extract<TestPricingPlanId, "plus" | "premium">,
  Tp5StripeCheckoutProduct
> = {
  plus: {
    productName: "PROVIN MINI",
    amountCents: 3999,
  },
  premium: {
    productName: "PROVIN AUDITS",
    amountCents: 9999,
  },
};

export function isTp5CheckoutSource(sourcePage: string): boolean {
  return (
    sourcePage === TP5_INLINE_CHECKOUT_SOURCE ||
    sourcePage === TP5_CHECKOUT_SOURCE ||
    sourcePage === HOME_PRICING_CHECKOUT_SOURCE
  );
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

const TP5_INLINE_FIELD_MESSAGES = {
  lv: {
    listingUrl: "Saitei jābūt pilnai adresei uz konkrētu sludinājumu.",
    vin: "Ievadi derīgu VIN kodu vai valsts numurzīmi (3–6 zīmes).",
  },
  en: {
    listingUrl: "Please enter the full link to a specific listing.",
    vin: "Enter a valid VIN or licence plate number (3–6 characters).",
  },
} as const;

export function validateTp5InlineFields(
  listingUrl: string,
  vin: string,
  locale?: string,
): { ok: true } | { ok: false; errors: Tp5InlineFieldErrors } {
  const messages =
    locale === "en" ? TP5_INLINE_FIELD_MESSAGES.en : TP5_INLINE_FIELD_MESSAGES.lv;
  const errors: Tp5InlineFieldErrors = {};
  const listing = listingUrl.trim();

  /** Sludinājuma saite nav obligāta — pārbauda tikai tad, ja ievadīta. */
  if (listing && !isPlausibleListingUrl(listing)) {
    errors.listingUrl = messages.listingUrl;
  }

  const normalized = normalizeVin(vin.trim());
  if (!normalized || !isValidVinOrPlate(normalized)) {
    errors.vin = messages.vin;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}
