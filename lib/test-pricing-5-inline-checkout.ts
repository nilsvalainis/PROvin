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

/** Sākumlapa un vēsturiski tp5/test-checkout avoti — vienmēr `price_data` (bez Stripe Catalog ID). */
export const TP5_STRIPE_CHECKOUT_PRODUCT: Record<
  Extract<TestPricingPlanId, "plus" | "premium" | "dealer" | "koreaUsa">,
  Tp5StripeCheckoutProduct
> = {
  plus: {
    productName: "PROVIN MINI",
    productDesc:
      "Latvijā ekspluatētiem auto. Bez maksas starptautisko datubāžu pārbaudes. Citiem auto izvēlies PROVIN AUDITS.",
    amountCents: 3999,
  },
  premium: {
    productName: "PROVIN AUDITS",
    productDesc:
      "Pilna datu analīze vairākās datubāzēs, sludinājuma analīze un eksperta slēdziens.",
    amountCents: 9999,
  },
  dealer: {
    productName: "Oficiālā dīlera servisa vēstures dati",
    productDesc:
      "Oficiālie dīlera servisa vēstures ieraksti. Ja dati nav pieejami, 100% naudas atmaksa.",
    amountCents: 2499,
  },
  koreaUsa: {
    productName: "ASV UN KOREJA",
    productDesc:
      "ASV un Korejas reģistru, izsoļu arhīva un bojājumu pārbaude. Ja dati nav pieejami, 100% naudas atmaksa.",
    amountCents: 1999,
  },
};

export function isTp5CheckoutSource(sourcePage: string): boolean {
  return (
    sourcePage === TP5_INLINE_CHECKOUT_SOURCE ||
    sourcePage === TP5_CHECKOUT_SOURCE ||
    sourcePage === HOME_PRICING_CHECKOUT_SOURCE
  );
}

const TP5_MINI_CHECKOUT_NOTE = {
  lv: "PROVIN MINI ir paredzēts Latvijā ekspluatētiem auto bez maksas starptautisko datubāžu pārbaudes. Citiem auto izvēlies PROVIN AUDITS.",
  en: "PROVIN MINI is for cars used in Latvia and does not include paid international database checks. For other cars, choose PROVIN AUDITS.",
} as const;

const TP5_DEALER_CHECKOUT_NOTE = {
  lv: "Oficiālā dīlera servisa vēsture. Ja dati nav pieejami, 100% naudas atmaksa.",
  en: "Official dealer service history. 100% refund if no data is available.",
} as const;

const TP5_KOREA_USA_CHECKOUT_NOTE = {
  lv: "ASV un Korejas reģistru, izsoļu arhīva un bojājumu pārbaude. Ja dati nav pieejami, 100% naudas atmaksa.",
  en: "US and Korea registry, auction archive and damage check. 100% refund if no data is available.",
} as const;

/** Stripe Checkout submit note (step 2) for PROVIN MINI. */
export function getTp5MiniCheckoutNote(locale?: string): string {
  return locale === "en" ? TP5_MINI_CHECKOUT_NOTE.en : TP5_MINI_CHECKOUT_NOTE.lv;
}

/** Stripe `custom_text.submit.message` when the selected plan needs a pre-pay note. */
export function getTp5CheckoutSubmitMessage(
  planId: TestPricingPlanId,
  locale?: string,
): string | null {
  if (planId === "plus") return getTp5MiniCheckoutNote(locale);
  if (planId === "dealer") {
    return locale === "en" ? TP5_DEALER_CHECKOUT_NOTE.en : TP5_DEALER_CHECKOUT_NOTE.lv;
  }
  if (planId === "koreaUsa") {
    return locale === "en" ? TP5_KOREA_USA_CHECKOUT_NOTE.en : TP5_KOREA_USA_CHECKOUT_NOTE.lv;
  }
  return null;
}

const TP5_STRIPE_CHECKOUT_PRODUCT_EN: Record<
  keyof typeof TP5_STRIPE_CHECKOUT_PRODUCT,
  Pick<Tp5StripeCheckoutProduct, "productDesc">
> = {
  plus: {
    productDesc:
      "For cars used in Latvia. No paid international database checks. Other cars: choose PROVIN AUDITS.",
  },
  premium: {
    productDesc:
      "Full data analysis across multiple databases, listing analysis and an expert conclusion.",
  },
  dealer: {
    productDesc: "Official dealer service history. 100% refund if no data is available.",
  },
  koreaUsa: {
    productDesc:
      "US and Korea registry, auction archive and damage check. 100% refund if no data is available.",
  },
};

export function getTp5StripeCheckoutProduct(
  planId: TestPricingPlanId,
  locale?: string,
): Tp5StripeCheckoutProduct | null {
  if (planId === "plus" || planId === "premium" || planId === "dealer" || planId === "koreaUsa") {
    const row = TP5_STRIPE_CHECKOUT_PRODUCT[planId];
    if (locale === "en") {
      return { ...row, ...TP5_STRIPE_CHECKOUT_PRODUCT_EN[planId] };
    }
    return row;
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
