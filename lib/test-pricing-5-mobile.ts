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

const AUDITS_FEATURE_ROWS: Tp5MobileFeature[] = [
  { name: "Auto vēstures pārbaude", included: true },
  { name: "carVertical integrācija", included: true },
  { name: "autoDNA integrācija", included: true },
  { name: "Oficiālo dīleru dati*", included: true },
  { name: "Individuāla konsultācija", included: true },
];

/** Mobile `/test-pricing-5` — approved 2-tier product schema. */
export const TP5_MOBILE_SERVICES: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "39,99 €",
    buttonText: "PASŪTĪT MINI AUDITU — 39,99 €",
    description:
      "Sludinājuma, tehnisko datu un risku analīze. Rekomendējam veikt Latvijā ilgāku laiku reģistrētiem auto.",
    features: [
      { name: "Sludinājuma un tehnisko risku analīze", included: true },
      { name: "EU reģistru pārbaude & TA vēsture", included: true },
      { name: "Ieteikumi klātienes apskatei", included: true },
      ...AUDITS_FEATURE_ROWS.map((feature) => ({ ...feature, included: false })),
    ],
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    price: "89,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU — 89,99 €",
    description:
      "Detalizēta auto vēstures un risku analīze iekļaujot dažādas maksas vēstures atskaites un oficiālo dīleru datus*.",
    features: AUDITS_FEATURE_ROWS,
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
