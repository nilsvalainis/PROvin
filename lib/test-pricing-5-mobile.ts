import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type Tp5FeatureTone = "default" | "soft" | "guarantee" | "info" | "brands";

export type Tp5MobileFeature = {
  name: string;
  included: boolean;
  /** soft = muted dash (not a red ✕); guarantee = refund-style ✓ */
  tone?: Tp5FeatureTone;
};

export type Tp5MobileServiceId = "mini" | "audits" | "dealer";

export type Tp5MobileService = {
  id: Tp5MobileServiceId;
  /** Short tab label. */
  title: string;
  price: string;
  buttonText: string;
  description: string;
  features: Tp5MobileFeature[];
  /** Brands for dealer popup only (not rendered inline). */
  brands?: readonly string[];
  brandsHeading?: string;
  /** Explanatory note under checklist (not a ✓ row). */
  extraNote?: string;
  /** Hide listing URL field (dealer: VIN only). */
  hideListingUrl?: boolean;
  /** Per-tier turnaround; falls back to shared audit turnaround. */
  turnaround?: string;
  /** CTA footnote override. */
  footnote?: string;
};

/** Supported manufacturers in a fixed 4×4 display grid. */
export const TP5_DEALER_BRAND_ROWS = [
  ["Mercedes-Benz", "Volvo", "Jaguar", "Land Rover"],
  ["BMW", "MINI", "Audi", "Volkswagen"],
  ["Škoda", "SEAT", "Peugeot", "Citroën"],
  ["Renault", "Dacia", "Opel", "Smart"],
] as const;

/** Flat brand list (same set as grid). */
export const TP5_DEALER_BRANDS = TP5_DEALER_BRAND_ROWS.flat();

/** Public logo paths for dealer brand grid cells. */
export const TP5_DEALER_BRAND_LOGO_SRC: Record<(typeof TP5_DEALER_BRANDS)[number], string> = {
  "Mercedes-Benz": "/brand-logos/mercedes.svg?v=5",
  Volvo: "/brand-logos/volvo.svg?v=5",
  Jaguar: "/brand-logos/jaguar.svg?v=5",
  "Land Rover": "/brand-logos/land-rover.svg?v=5",
  BMW: "/brand-logos/bmw.svg?v=5",
  MINI: "/brand-logos/mini.svg?v=5",
  Audi: "/brand-logos/audi.svg?v=5",
  Volkswagen: "/brand-logos/volkswagen.svg?v=5",
  Škoda: "/brand-logos/skoda.svg?v=5",
  SEAT: "/brand-logos/seat.svg?v=5",
  Peugeot: "/brand-logos/peugeot.svg?v=5",
  Citroën: "/brand-logos/citroen.svg?v=5",
  Renault: "/brand-logos/renault.svg?v=5",
  Dacia: "/brand-logos/dacia.svg?v=5",
  Opel: "/brand-logos/opel.svg?v=5",
  Smart: "/brand-logos/smart.svg?v=5",
};

/** Brands whose PNG still ships with a solid black plate (none after alpha strip). */
export const TP5_DEALER_BRAND_DARK_PLATE = new Set<string>([]);

/** Card checklist row count for MINI/AUDITS compare stack. */
export const TP5_MOBILE_FEATURE_ROW_COUNT = 5;

const AUDITS_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Konsultācija un ieteikumi klātienes apskatei", included: true },
  { name: "Apdrošinātāju dati un tehnisko apskašu vēsture", included: true },
  { name: "Sludinājuma, pārdevēja un tehnisko risku analīze", included: true },
  { name: "CarVertical + AutoDNA + EU reģistru pārbaude", included: true },
  { name: "Oficiālo dīleru un izsoļu portālu arhīva dati*", included: true },
];

const AUDITS_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Consultation and in-person viewing tips", included: true },
  { name: "Insurer data and technical inspection history", included: true },
  { name: "Listing, seller and technical risk analysis", included: true },
  { name: "CarVertical + AutoDNA + EU registry check", included: true },
  { name: "Official dealer and auction portal archive data*", included: true },
];

const MINI_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Konsultācija un ieteikumi klātienes apskatei", included: true },
  { name: "Apdrošinātāju dati un tehnisko apskašu vēsture", included: true },
  { name: "Sludinājuma, pārdevēja un tehnisko risku analīze", included: true },
  { name: "CarVertical + AutoDNA + EU reģistru pārbaude", included: false },
  { name: "Oficiālo dīleru un izsoļu portālu arhīva dati*", included: false },
];

const MINI_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Consultation and in-person viewing tips", included: true },
  { name: "Insurer data and technical inspection history", included: true },
  { name: "Listing, seller and technical risk analysis", included: true },
  { name: "CarVertical + AutoDNA + EU registry check", included: false },
  { name: "Official dealer and auction portal archive data*", included: false },
];

const DEALER_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Odometra rādījumi un apkopju vēsture", included: true },
];

const DEALER_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Odometer readings and service history", included: true },
];

/** Mobile `/test-pricing-5` + home hero — MINI, AUDITS, dealer data. */
export const TP5_MOBILE_SERVICES: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "39,99 €",
    buttonText: "PASŪTĪT MINI AUDITU — 39,99 €",
    description: "Rekomendējam veikt Latvijā ekspluatētiem auto.",
    features: MINI_FEATURES_LV,
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    price: "99,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU — 99,99 €",
    description: "Pilnīgākais auto pārbaudes komplekts Latvijā.",
    features: AUDITS_FEATURES_LV,
  },
  {
    id: "dealer",
    title: "DĪLERA DATI",
    price: "24,99 €",
    buttonText: "PASŪTĪT DĪLERA DATUS — 24,99 €",
    description: "Tiešā piekļuve oficiālo dīleru datiem.",
    features: DEALER_FEATURES_LV,
    brands: TP5_DEALER_BRANDS,
    turnaround: "⏱️ Izpilde: 24-48h",
  },
];

const TP5_MOBILE_SERVICES_EN: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "€39.99",
    buttonText: "ORDER MINI AUDIT — €39.99",
    description: "Recommended for cars used in Latvia.",
    features: MINI_FEATURES_EN,
  },
  {
    id: "audits",
    title: "PROVIN AUDIT",
    price: "€99.99",
    buttonText: "ORDER PROVIN AUDIT — €99.99",
    description: "The most complete vehicle check package in Latvia.",
    features: AUDITS_FEATURES_EN,
  },
  {
    id: "dealer",
    title: "DEALER DATA",
    price: "€24.99",
    buttonText: "ORDER DEALER DATA — €24.99",
    description: "Direct access to official dealer data.",
    features: DEALER_FEATURES_EN,
    brands: TP5_DEALER_BRANDS,
    turnaround: "⏱️ Delivery: 24-48h",
  },
];

export const TP5_MOBILE_SERVICE_ORDER: Tp5MobileServiceId[] = TP5_MOBILE_SERVICES.map(
  (service) => service.id,
);

export const TP5_MOBILE_TURNAROUND = "⏱️ Izpilde: 24-72h";

const TP5_MOBILE_TURNAROUND_EN = "⏱️ Delivery: 24-72h";

/** Stripe checkout plan mapping for mobile tiers. */
export const TP5_MOBILE_CHECKOUT_PLAN: Record<Tp5MobileServiceId, TestPricingPlanId> = {
  mini: "plus",
  audits: "premium",
  dealer: "dealer",
};

/** Locale-aware tier list; anything other than `en` falls back to Latvian. */
export function getTp5MobileServices(locale?: string): Tp5MobileService[] {
  return locale === "en" ? TP5_MOBILE_SERVICES_EN : TP5_MOBILE_SERVICES;
}

export function getTp5MobileTurnaround(locale?: string): string {
  return locale === "en" ? TP5_MOBILE_TURNAROUND_EN : TP5_MOBILE_TURNAROUND;
}

export function getTp5MobileService(id: Tp5MobileServiceId, locale?: string): Tp5MobileService {
  const service = getTp5MobileServices(locale).find((entry) => entry.id === id);
  if (!service) {
    throw new Error(`Unknown TP5 mobile service: ${id}`);
  }
  return service;
}

export function getTp5MobileServiceIndex(id: Tp5MobileServiceId): number {
  return TP5_MOBILE_SERVICE_ORDER.indexOf(id);
}
