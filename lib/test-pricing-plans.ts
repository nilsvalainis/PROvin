import {
  isPlausibleListingUrl,
  isValidVin,
  normalizeVin,
} from "@/lib/order-field-validation";

/** Testa cenu lapa `/test-pricing` — trīs produktu līnijas (nav saistītas ar hero OrderForm). */

export type TestPricingPlanId = "listing_filter" | "mini" | "premium";

export type TestPricingFeatureId =
  | "listing_analysis"
  | "technical_risks"
  | "lv_registry"
  | "ta_history"
  | "foreign_registry"
  | "autodna"
  | "carvertical"
  | "dealer_db"
  | "consultation";

export type TestPricingFeatureRow = {
  id: TestPricingFeatureId;
  label: string;
};

export const TEST_PRICING_FEATURE_ROWS: TestPricingFeatureRow[] = [
  { id: "listing_analysis", label: "Sludinājuma analīze" },
  { id: "technical_risks", label: "Tehnisko risku analīze" },
  { id: "lv_registry", label: "Pārbaude Latvijas reģistros" },
  { id: "ta_history", label: "Tehnisko apskašu vēsture" },
  { id: "foreign_registry", label: "Ārvalsts reģistri" },
  { id: "autodna", label: "AutoDNA datubāze" },
  { id: "carvertical", label: "CarVertical datubāze" },
  { id: "dealer_db", label: "Oficiālo dīleru datubāzes" },
  { id: "consultation", label: "Individuāla konsultācija" },
];

export type TestPricingPlanConfig = {
  id: TestPricingPlanId;
  title: string;
  priceLabel: string;
  amountCents: number;
  stripePriceEnvKey: string;
  description: string;
  turnaround: string;
  ctaLabel: string;
  vinRequired: boolean;
  vinPlaceholder: string;
  features: Record<TestPricingFeatureId, boolean>;
  productName: string;
  productDesc: string;
};

export const TEST_PRICING_PLANS: TestPricingPlanConfig[] = [
  {
    id: "listing_filter",
    title: "PROVIN SLUDINĀJUMA FILTRS",
    priceLabel: "19,99 €",
    amountCents: 1999,
    stripePriceEnvKey: "STRIPE_PRICE_LISTING_FILTER",
    description:
      "Kam domāts: Ātrai sludinājuma un modeļa risku izvērtēšanai pirms saziņas ar pārdevēju.",
    turnaround: "⏱️ Izpilde: 1 - 12h",
    ctaLabel: "PĀRBAUDĪT SLUDINĀJUMU",
    vinRequired: false,
    vinPlaceholder: "Ievadi VIN (ja ir)",
    productName: "PROVIN sludinājuma filtrs",
    productDesc: "Sludinājuma un modeļa risku izvērtējums pirms saziņas ar pārdevēju.",
    features: {
      listing_analysis: true,
      technical_risks: true,
      lv_registry: true,
      ta_history: false,
      foreign_registry: false,
      autodna: false,
      carvertical: false,
      dealer_db: false,
      consultation: false,
    },
  },
  {
    id: "mini",
    title: "PROVIN MINI",
    priceLabel: "49,99 €",
    amountCents: 4999,
    stripePriceEnvKey: "STRIPE_PRICE_MINI",
    description:
      "Kam domāts: Latvijā reģistrētu auto padziļinātai analīzei bez maksas vēstures atskaitēm.",
    turnaround: "⏱️ Izpilde: līdz 24h",
    ctaLabel: "PASŪTĪT MINI AUDITU",
    vinRequired: true,
    vinPlaceholder: "Ievadi VIN (obligāts)",
    productName: "PROVIN MINI audits",
    productDesc: "Padziļināta analīze Latvijā reģistrētam transportlīdzeklim.",
    features: {
      listing_analysis: true,
      technical_risks: true,
      lv_registry: true,
      ta_history: true,
      foreign_registry: true,
      autodna: false,
      carvertical: false,
      dealer_db: false,
      consultation: true,
    },
  },
  {
    id: "premium",
    title: "PROVIN PREMIUM",
    priceLabel: "99,00 €",
    amountCents: 9900,
    stripePriceEnvKey: "STRIPE_PRICE_PREMIUM",
    description:
      "Kam domāts: Latvijā reģistrētu, kā arī jebkura Eiropas vai Amerikas auto pilnai vēstures izpētei.",
    turnaround: "⏱️ Izpilde: līdz 48h",
    ctaLabel: "PASŪTĪT PREMIUM AUDITU",
    vinRequired: true,
    vinPlaceholder: "Ievadi VIN (obligāts)",
    productName: "PROVIN PREMIUM audits",
    productDesc: "Pilna vēstures izpēte ar starptautiskām datubāzēm.",
    features: {
      listing_analysis: true,
      technical_risks: true,
      lv_registry: true,
      ta_history: true,
      foreign_registry: true,
      autodna: true,
      carvertical: true,
      dealer_db: true,
      consultation: true,
    },
  },
];

export function getTestPricingPlan(id: TestPricingPlanId): TestPricingPlanConfig | undefined {
  return TEST_PRICING_PLANS.find((p) => p.id === id);
}

export function isTestPricingPlanId(v: string): v is TestPricingPlanId {
  return v === "listing_filter" || v === "mini" || v === "premium";
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
