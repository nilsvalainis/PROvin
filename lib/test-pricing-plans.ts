import {
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";

/** Testa cenu lapa `/test-pricing` — MINI + PREMIUM (nav saistītas ar hero OrderForm). */

export type TestPricingPlanId = "mini" | "premium";

export type TestPricingFeatureItem = {
  icon: string;
  label: string;
};

export type TestPricingFeatureSection = {
  header: string;
  tone: "muted" | "highlight";
  items: TestPricingFeatureItem[];
};

export type TestPricingPlanConfig = {
  id: TestPricingPlanId;
  title: string;
  priceLabel: string;
  amountCents: number;
  stripePriceEnvKey: string;
  description: string;
  /** Tikai PREMIUM — zem apraksta. */
  valueBar?: string;
  turnaround: string;
  ctaLabel: string;
  ctaVariant: "secondary" | "primary";
  vinRequired: boolean;
  vinPlaceholder: string;
  /** Vienkārša saraksta forma (MINI). */
  features?: TestPricingFeatureItem[];
  /** Sekciju forma (PREMIUM). */
  featureSections?: TestPricingFeatureSection[];
  productName: string;
  productDesc: string;
};

export const TEST_PRICING_PLANS: TestPricingPlanConfig[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    priceLabel: "29,99 €",
    amountCents: 2999,
    stripePriceEnvKey: "STRIPE_PRICE_MINI",
    description: "Sludinājuma, risku analīzei un LV auto padziļinātai pārbaudei.",
    turnaround: "⏱️ Izpilde: līdz 12-24h",
    ctaLabel: "PĀRBAUDĪT AUTO",
    ctaVariant: "secondary",
    vinRequired: false,
    vinPlaceholder: "Ievadi VIN (ja ir)",
    productName: "PROVIN MINI",
    productDesc: "Sludinājuma, risku analīze un LV auto padziļināta pārbaude.",
    features: [
      { icon: "✔️", label: "Sludinājuma & tehnisko risku analīze" },
      { icon: "✔️", label: "Pārbaude Latvijas reģistros" },
      { icon: "✔️", label: "Tehnisko apskašu (TA) vēsture & odometrs" },
      { icon: "✔️", label: "Ārvalstu reģistru primārā kontrole" },
    ],
  },
  {
    id: "premium",
    title: "PROVIN PREMIUM",
    priceLabel: "99,00 €",
    amountCents: 9900,
    stripePriceEnvKey: "STRIPE_PRICE_PREMIUM",
    description:
      "Maksimāls drošības līmenis – pilna vietējo un starptautisko datubāzu izpēte iekļaujot maksas vēstures atskaites.",
    valueBar: "💡 Ietver visu MINI paketi + Starptautisko izpēti",
    turnaround: "⏱️ Izpilde: līdz 48h",
    ctaLabel: "PASŪTĪT PREMIUM AUDITU",
    ctaVariant: "primary",
    vinRequired: true,
    vinPlaceholder: "Ievadi VIN (obligāts)",
    productName: "PROVIN PREMIUM",
    productDesc: "Pilna vietējo un starptautisko datubāzu izpēte ar maksas vēstures atskaitēm.",
    featureSections: [
      {
        header: "[ 📦 IEKĻAUTS NO MINI PAKETES ]",
        tone: "muted",
        items: [
          { icon: "➕", label: "Sludinājuma & tehnisko risku analīze" },
          { icon: "➕", label: "Pārbaude Latvijas reģistros" },
          { icon: "➕", label: "Tehnisko apskašu (TA) vēsture" },
          { icon: "➕", label: "Ārvalstu reģistru primārā kontrole" },
        ],
      },
      {
        header: "[ 🔥 + PREMIUM EKSKLUZĪVIE DATI ]",
        tone: "highlight",
        items: [
          { icon: "🚀", label: "carVertical pilnā atskaite" },
          { icon: "🚀", label: "autoDNA vēstures atskaite" },
          { icon: "🚀", label: "Oficiālo dīleru sistēmu dati" },
          { icon: "🚀", label: "Eksperta pirkuma rekomendācija" },
        ],
      },
    ],
  },
];

export function getTestPricingPlan(id: TestPricingPlanId): TestPricingPlanConfig | undefined {
  return TEST_PRICING_PLANS.find((p) => p.id === id);
}

export function isTestPricingPlanId(v: string): v is TestPricingPlanId {
  return v === "mini" || v === "premium";
}

export type TestPricingCheckoutFieldErrors = {
  listingUrl?: string;
  vin?: string;
  consent?: string;
};

export function validateTestPricingCheckout(
  plan: TestPricingPlanConfig,
  listingUrl: string,
  vin: string,
  withdrawalConsent: boolean,
): { ok: true } | { ok: false; errors: TestPricingCheckoutFieldErrors } {
  const errors: TestPricingCheckoutFieldErrors = {};

  if (!listingUrl.trim()) {
    errors.listingUrl = "Ievadi sludinājuma saiti.";
  } else if (!isPlausibleListingUrl(listingUrl)) {
    errors.listingUrl = "Saitei jābūt pilnai adresei uz konkrētu sludinājumu.";
  }

  const vinNorm = vin.trim();
  if (plan.vinRequired) {
    const normalized = normalizeVin(vinNorm);
    if (!normalized || !isValidVin(normalized)) {
      errors.vin = "Ievadi derīgu 17 zīmju VIN.";
    }
  } else if (vinNorm) {
    const normalized = normalizeVin(vinNorm);
    if (!isValidVin(normalized)) {
      errors.vin = "VIN formāts nav derīgs.";
    }
  }

  if (!withdrawalConsent) {
    errors.consent = "Apstiprini noteikumus un digitālā satura izpildi.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true };
}
