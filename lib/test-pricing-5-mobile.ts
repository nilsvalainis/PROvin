import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type Tp5MobileFeature = { name: string; included: boolean };

export type Tp5MobileServiceId = "mini" | "audits";

export type Tp5MobileService = {
  id: Tp5MobileServiceId;
  title: string;
  price: string;
  buttonText: string;
  description: string;
  features: Tp5MobileFeature[];
};

const TP5_MOBILE_FEATURE_NAMES = [
  "Individuāla konsultācija",
  "Sludinājuma un tehnisko risku analīze",
  "EU reģistru pārbaude & TA vēsture",
  "Ieteikumi klātienes apskatei",
  "carVertical integrācija",
  "autoDNA integrācija",
  "Oficiālo dīleru dati*",
  "Starptautiska vēstures pārbaude",
] as const;

const MINI_ACTIVE_FEATURE_COUNT = 4;

function buildTp5MobileFeatures(includedThroughIndex: number): Tp5MobileFeature[] {
  return TP5_MOBILE_FEATURE_NAMES.map((name, index) => ({
    name,
    included: index < includedThroughIndex,
  }));
}

/** Mobile `/test-pricing-5` — approved 2-tier product schema. */
export const TP5_MOBILE_SERVICES: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "39,99 €",
    buttonText: "PASŪTĪT MINI AUDITU — 39,99 €",
    description:
      "Sludinājuma, tehnisko datu un risku analīze. Rekomendējam veikt Latvijā 🇱🇻 ilgāku laiku reģistrētiem auto.",
    features: buildTp5MobileFeatures(MINI_ACTIVE_FEATURE_COUNT),
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    price: "89,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU — 89,99 €",
    description:
      "Detalizēta auto vēstures un risku analīze iekļaujot dažādas maksas vēstures atskaites un oficiālā dīlera datus*.",
    features: buildTp5MobileFeatures(TP5_MOBILE_FEATURE_NAMES.length),
  },
];

export const TP5_MOBILE_SERVICE_ORDER: Tp5MobileServiceId[] = TP5_MOBILE_SERVICES.map(
  (service) => service.id,
);

export const TP5_MOBILE_TURNAROUND = "⏱️ Izpilde: līdz 48h";

/** Stripe checkout plan mapping for mobile tiers. */
export const TP5_MOBILE_CHECKOUT_PLAN: Record<Tp5MobileServiceId, TestPricingPlanId> = {
  mini: "plus",
  audits: "premium",
};

export function getTp5MobileService(id: Tp5MobileServiceId): Tp5MobileService {
  const service = TP5_MOBILE_SERVICES.find((entry) => entry.id === id);
  if (!service) {
    throw new Error(`Unknown mobile service: ${id}`);
  }
  return service;
}

export function getTp5MobileServiceIndex(id: Tp5MobileServiceId): number {
  return TP5_MOBILE_SERVICE_ORDER.indexOf(id);
}
