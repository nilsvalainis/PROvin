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

/** Mobile `/test-pricing-5` — approved 2-tier product schema. */
export const TP5_MOBILE_SERVICES: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "39,99 €",
    buttonText: "PASŪTĪT MINI AUDITU — 39,99 €",
    description:
      "Padziļināta tehnisko datu analīze un konsultācija. Rekomendējam veikt Latvijā reģistrētiem auto.",
    features: [
      { name: "Sludinājuma un tehnisko risku analīze", included: true },
      { name: "TA vēsture un publisko reģistru pārbaude", included: true },
      { name: "Ieteikumi klātienes apskatei", included: true },
      { name: "carVertical un autoDNA integrācija", included: false },
      { name: "Oficiālo dīleru sistēmu dati*", included: false },
      { name: "Individuāla konsultācija un atbalsts pirms darījuma.", included: false },
    ],
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    price: "89,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU — 89,99 €",
    description:
      "Maksimāla visu datu analīze iekļaujot maksas atskaites un oficiālā dīlera sistēmu datus*.",
    features: [
      { name: "Sludinājuma un tehnisko risku analīze", included: true },
      { name: "TA vēsture un publisko reģistru pārbaude", included: true },
      { name: "Ieteikumi klātienes apskatei", included: true },
      { name: "carVertical un autoDNA integrācija", included: true },
      { name: "Oficiālo dīleru sistēmu dati*", included: true },
      { name: "Individuāla konsultācija un atbalsts pirms darījuma.", included: true },
    ],
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
