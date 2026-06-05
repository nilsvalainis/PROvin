/** Testa cenu lapa `/test-pricing` — MINI, PLUS, PREMIUM (nav saistītas ar hero OrderForm). */

export type TestPricingPlanId = "mini" | "plus" | "premium";

export type TestPricingFeatureItem =
  | { kind: "bullet"; icon: string; label: string }
  | { kind: "includes"; packageName: "PROVIN MINI" | "PROVIN PLUS" };

export type TestPricingPlanConfig = {
  id: TestPricingPlanId;
  title: string;
  priceLabel: string;
  amountCents: number;
  stripePriceEnvKey: string;
  description: string;
  turnaround: string;
  ctaLabel: string;
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
    priceLabel: "29,99 €",
    amountCents: 2999,
    stripePriceEnvKey: "STRIPE_PRICE_MINI",
    description: "Ātrai sludinājuma risku analīzei un LV auto padziļinātai pārbaudei.",
    turnaround: "⏱️ Izpilde: līdz 24h",
    ctaLabel: "PĀRBAUDĪT AUTO",
    highlighted: false,
    vinRequired: false,
    productName: "PROVIN MINI",
    productDesc: "Sludinājuma risku analīze un LV auto padziļināta pārbaude.",
    features: [
      { kind: "bullet", icon: "✔️", label: "Sludinājuma analīze" },
      { kind: "bullet", icon: "✔️", label: "Tehnisko risku izvērtēšana" },
      { kind: "bullet", icon: "✔️", label: "Individuāla konsultācija" },
    ],
  },
  {
    id: "plus",
    title: "PROVIN PLUS",
    priceLabel: "49,99 €",
    amountCents: 4999,
    stripePriceEnvKey: "STRIPE_PRICE_PLUS",
    description: "Latvijā un Ziemeļvalstīs reģistrētu auto vēstures pārbaude.",
    turnaround: "⏱️ Izpilde: līdz 24h",
    ctaLabel: "PASŪTĪT PLUS AUDITU",
    highlighted: false,
    vinRequired: false,
    productName: "PROVIN PLUS",
    productDesc: "Latvijas un Ziemeļvalstu reģistru vēstures pārbaude.",
    features: [
      { kind: "includes", packageName: "PROVIN MINI" },
      { kind: "bullet", icon: "✔️", label: "Vietējo reģistru pārbaude" },
      { kind: "bullet", icon: "✔️", label: "Ziemeļvalstu reģistru pārbaude" },
      { kind: "bullet", icon: "✔️", label: "Tehnisko apskašu vēsture" },
    ],
  },
  {
    id: "premium",
    title: "PROVIN PREMIUM",
    priceLabel: "99,00 €",
    amountCents: 9900,
    stripePriceEnvKey: "STRIPE_PRICE_PREMIUM",
    description: "Maksimāls drošības līmenis – pilna vietējo un starptautisko datu izpēte.",
    turnaround: "⏱️ Izpilde: līdz 48h",
    ctaLabel: "PASŪTĪT PREMIUM AUDITU",
    highlighted: true,
    vinRequired: true,
    productName: "PROVIN PREMIUM",
    productDesc: "Pilna vietējo un starptautisko datu izpēte ar maksas vēstures atskaitēm.",
    features: [
      { kind: "includes", packageName: "PROVIN MINI" },
      { kind: "includes", packageName: "PROVIN PLUS" },
      { kind: "bullet", icon: "✔️", label: "Oficiālo dīleru vēsture*" },
      { kind: "bullet", icon: "✔️", label: "CarVertical & AutoDNA" },
    ],
  },
];

export function getTestPricingPlan(id: TestPricingPlanId): TestPricingPlanConfig | undefined {
  return TEST_PRICING_PLANS.find((p) => p.id === id);
}

export function isTestPricingPlanId(v: string): v is TestPricingPlanId {
  return v === "mini" || v === "plus" || v === "premium";
}
