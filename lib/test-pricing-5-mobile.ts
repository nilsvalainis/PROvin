import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type Tp5MobileFeature = { name: string; included: boolean };

export type Tp5MobileServiceId = "mini" | "audits" | "dealer";

export type Tp5MobileService = {
  id: Tp5MobileServiceId;
  /** Short tab label. */
  title: string;
  price: string;
  buttonText: string;
  description: string;
  features: Tp5MobileFeature[];
  /** Optional compact manufacturer list (dealer tier). */
  brands?: readonly string[];
  /** Brands block heading above the compact list. */
  brandsHeading?: string;
  /** Hide listing URL field (dealer: VIN only). */
  hideListingUrl?: boolean;
  /** Per-tier turnaround; falls back to shared audit turnaround. */
  turnaround?: string;
  /** CTA footnote override. */
  footnote?: string;
};

export const TP5_DEALER_BRANDS = [
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Volkswagen",
  "Land Rover",
  "Jaguar",
  "MINI",
  "Škoda",
  "SEAT",
  "Smart",
  "Dacia",
  "Renault",
  "Rolls-Royce",
] as const;

const TP5_MOBILE_FEATURE_NAMES = [
  "Sludinājuma un tehnisko risku analīze",
  "EU reģistru pārbaude & TA vēsture",
  "Ieteikumi klātienes apskatei",
  "Individuāla konsultācija",
  "carVertical integrācija",
  "autoDNA integrācija",
  "Oficiālo dīleru un izsoļu portālu arhīvs*",
  "Starptautiska vēstures pārbaude",
] as const;

const TP5_MOBILE_FEATURE_NAMES_EN = [
  "Listing and technical risk analysis",
  "EU registry check & inspection history",
  "In-person inspection guidance",
  "Personal consultation",
  "carVertical integration",
  "autoDNA integration",
  "Official dealer & auction portal archive*",
  "International history check",
] as const;

const DEALER_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Oficiālie dīlera servisa ieraksti", included: true },
  { name: "Bez PROVIN eksperta analīzes", included: true },
  { name: "Ja dati nav — 100% naudas atmaksa", included: true },
  { name: "Daļēji ieraksti = derīga piegāde", included: true },
];

const DEALER_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Official dealer service records", included: true },
  { name: "No PROVIN expert analysis", included: true },
  { name: "No data available — 100% refund", included: true },
  { name: "Partial records = valid delivery", included: true },
];

const MINI_ACTIVE_FEATURE_COUNT = 4;

const DEALER_FOOTNOTE_LV =
  "*Ja oficiālie ieraksti nav pieejami šim VIN — 100% naudas atmaksa. Daļēji pieejami ieraksti ir derīga piegāde.";

const DEALER_FOOTNOTE_EN =
  "*If no official records are available for this VIN — 100% refund. Partial records count as valid delivery.";

function buildTp5MobileFeatures(
  names: readonly string[],
  includedThroughIndex: number,
): Tp5MobileFeature[] {
  return names.map((name, index) => ({
    name,
    included: index < includedThroughIndex,
  }));
}

/** Mobile `/test-pricing-5` + home hero — MINI, AUDITS, dealer data. */
export const TP5_MOBILE_SERVICES: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "39,99 €",
    buttonText: "PASŪTĪT MINI AUDITU — 39,99 €",
    description:
      "Sludinājuma, tehnisko datu un risku analīze. Rekomendējam veikt Latvijā 🇱🇻 lietotiem auto.",
    features: buildTp5MobileFeatures(TP5_MOBILE_FEATURE_NAMES, MINI_ACTIVE_FEATURE_COUNT),
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    price: "99,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU — 99,99 €",
    description:
      "Detalizēta auto vēstures un risku analīze iekļaujot dažādas maksas vēstures atskaites, oficiālo dīleru un izsoļu portālu arhīvu*.",
    features: buildTp5MobileFeatures(TP5_MOBILE_FEATURE_NAMES, TP5_MOBILE_FEATURE_NAMES.length),
  },
  {
    id: "dealer",
    title: "DĪLERA DATI",
    price: "24,99 €",
    buttonText: "PASŪTĪT DĪLERA DATUS — 24,99 €",
    description:
      "Oficiālā dīlera servisa vēstures dati. Bez PROVIN analīzes — tikai oficiālie ieraksti.",
    features: DEALER_FEATURES_LV,
    brands: TP5_DEALER_BRANDS,
    brandsHeading: "Atbalstītie ražotāji",
    hideListingUrl: true,
    turnaround: "⏱️ Izpilde: tipiski līdz 24h / max 48h",
    footnote: DEALER_FOOTNOTE_LV,
  },
];

const TP5_MOBILE_SERVICES_EN: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "€39.99",
    buttonText: "ORDER MINI AUDIT — €39.99",
    description:
      "Analysis of the listing, technical data and risks. Recommended for cars used in Latvia 🇱🇻.",
    features: buildTp5MobileFeatures(TP5_MOBILE_FEATURE_NAMES_EN, MINI_ACTIVE_FEATURE_COUNT),
  },
  {
    id: "audits",
    title: "PROVIN AUDIT",
    price: "€99.99",
    buttonText: "ORDER PROVIN AUDIT — €99.99",
    description:
      "In-depth vehicle history and risk analysis, combining several paid history reports, official dealer data and auction portal archives*.",
    features: buildTp5MobileFeatures(
      TP5_MOBILE_FEATURE_NAMES_EN,
      TP5_MOBILE_FEATURE_NAMES_EN.length,
    ),
  },
  {
    id: "dealer",
    title: "DEALER DATA",
    price: "€24.99",
    buttonText: "ORDER DEALER DATA — €24.99",
    description:
      "Official dealer service history data. No PROVIN analysis — official records only.",
    features: DEALER_FEATURES_EN,
    brands: TP5_DEALER_BRANDS,
    brandsHeading: "Supported manufacturers",
    hideListingUrl: true,
    turnaround: "⏱️ Delivery: typically within 24h / max 48h",
    footnote: DEALER_FOOTNOTE_EN,
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
    throw new Error(`Unknown mobile service: ${id}`);
  }
  return service;
}

export function getTp5MobileServiceIndex(id: Tp5MobileServiceId): number {
  return TP5_MOBILE_SERVICE_ORDER.indexOf(id);
}
