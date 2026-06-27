/** Testa cenu lapa `/test-pricing` — MINI, PLUS, PREMIUM (nav saistītas ar hero OrderForm). */

import {
  isPlausibleListingUrl,
  isValidVinOrPlate,
  normalizeVin,
} from "@/lib/order-field-validation";

export type TestPricingPlanId = "mini" | "plus" | "premium";

export type TestPricingFeatureItem =
  | { kind: "bullet"; label: string }
  | { kind: "includes"; tierName: "MINI" | "PLUS" }
  | { kind: "exclusion"; label: string };

export type TestPricingPlanConfig = {
  id: TestPricingPlanId;
  title: string;
  priceLabel: string;
  amountCents: number;
  stripePriceEnvKey: string;
  description: string;
  turnaround: string;
  ctaLabel: string;
  /** Dinamiskā hero CTA ar cenu — `/test-pricing-2`. */
  heroCtaLabel: string;
  highlighted: boolean;
  vinRequired: boolean;
  features: TestPricingFeatureItem[];
  productName: string;
  productDesc: string;
};

export const TEST_PRICING_PLANS: TestPricingPlanConfig[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    priceLabel: "19,99 €",
    amountCents: 1999,
    stripePriceEnvKey: "STRIPE_PRICE_MINI",
    description: "Ātrai sludinājuma risku analīzei un LV auto padziļinātai pārbaudei.",
    turnaround: "⏱️ Izpilde: līdz 24h",
    ctaLabel: "PĀRBAUDĪT AUTO",
    heroCtaLabel: "PASŪTĪT MINI AUDITU — 19,99 €",
    highlighted: false,
    vinRequired: true,
    productName: "PROVIN MINI",
    productDesc: "Sludinājuma risku analīze un LV auto padziļināta pārbaude.",
    features: [
      { kind: "bullet", label: "Sludinājuma analīze" },
      { kind: "bullet", label: "Tehnisko risku izvērtēšana" },
      { kind: "bullet", label: "Individuāla konsultācija" },
      {
        kind: "exclusion",
        label: "Nav iekļauts CarVertical & AutoDNA",
      },
    ],
  },
  {
    id: "plus",
    title: "PROVIN PLUS",
    priceLabel: "39,99 €",
    amountCents: 3999,
    stripePriceEnvKey: "STRIPE_PRICE_PLUS",
    description: "Latvijā un Ziemeļvalstīs reģistrētu auto vēstures pārbaude.",
    turnaround: "⏱️ Izpilde: līdz 48h",
    ctaLabel: "PASŪTĪT PLUS AUDITU",
    heroCtaLabel: "PASŪTĪT PLUS AUDITU — 39,99 €",
    highlighted: false,
    vinRequired: true,
    productName: "PROVIN PLUS",
    productDesc: "Latvijas un Ziemeļvalstu reģistru vēstures pārbaude.",
    features: [
      { kind: "includes", tierName: "MINI" },
      { kind: "bullet", label: "Vietējo reģistru pārbaude" },
      { kind: "bullet", label: "Ziemeļvalstu reģistru pārbaude" },
      { kind: "bullet", label: "Tehnisko apskašu vēsture" },
      {
        kind: "exclusion",
        label: "Nav iekļauts CarVertical & AutoDNA",
      },
    ],
  },
  {
    id: "premium",
    title: "PROVIN PREMIUM",
    priceLabel: "99,99 €",
    amountCents: 9999,
    stripePriceEnvKey: "STRIPE_PRICE_PREMIUM",
    description: "Maksimāls drošības līmenis – pilna vietējo un starptautisko datu izpēte.",
    turnaround: "⏱️ Izpilde: līdz 48h",
    ctaLabel: "PASŪTĪT PREMIUM AUDITU",
    heroCtaLabel: "PASŪTĪT PREMIUM AUDITU — 99,99 €",
    highlighted: true,
    vinRequired: true,
    productName: "PROVIN PREMIUM",
    productDesc: "Pilna vietējo un starptautisko datu izpēte ar maksas vēstures atskaitēm.",
    features: [
      { kind: "includes", tierName: "MINI" },
      { kind: "includes", tierName: "PLUS" },
      { kind: "bullet", label: "Oficiālo dīleru un izsoļu portālu arhīvs*" },
      { kind: "bullet", label: "CarVertical & AutoDNA" },
    ],
  },
];

export function getTestPricingPlan(id: TestPricingPlanId): TestPricingPlanConfig | undefined {
  return TEST_PRICING_PLANS.find((p) => p.id === id);
}

export function isTestPricingPlanId(v: string): v is TestPricingPlanId {
  return v === "mini" || v === "plus" || v === "premium";
}

export type TestPricingStep2FieldErrors = {
  listingUrl?: string;
  vin?: string;
  consent?: string;
};

const TEST_PRICING_STEP2_MESSAGES = {
  lv: {
    listingUrl: "Saitei jābūt pilnai adresei uz konkrētu sludinājumu.",
    vin: "Ievadi derīgu VIN kodu vai valsts numurzīmi (3–6 zīmes).",
    consent: "Apstiprini noteikumus un digitālā satura izpildi.",
  },
  en: {
    listingUrl: "Please enter the full link to a specific listing.",
    vin: "Enter a valid VIN or licence plate number (3–6 characters).",
    consent: "Please accept the terms and the digital content delivery conditions.",
  },
} as const;

export function validateTestPricingStep2(
  plan: TestPricingPlanConfig,
  listingUrl: string,
  vin: string,
  withdrawalConsent: boolean,
  locale?: string,
): { ok: true } | { ok: false; errors: TestPricingStep2FieldErrors } {
  const messages =
    locale === "en" ? TEST_PRICING_STEP2_MESSAGES.en : TEST_PRICING_STEP2_MESSAGES.lv;
  const errors: TestPricingStep2FieldErrors = {};
  const listing = listingUrl.trim();

  /** Sludinājuma saite nav obligāta — pārbauda tikai tad, ja ievadīta. */
  if (listing && !isPlausibleListingUrl(listing)) {
    errors.listingUrl = messages.listingUrl;
  }

  const vinNorm = vin.trim();
  const normalized = normalizeVin(vinNorm);
  if (!normalized || !isValidVinOrPlate(normalized)) {
    errors.vin = messages.vin;
  }

  if (!withdrawalConsent) {
    errors.consent = messages.consent;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}
