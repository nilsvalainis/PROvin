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
  /** Brands for dealer popup only (not rendered inline). */
  brands?: readonly string[];
  brandsHeading?: string;
  /** Hide listing URL field (dealer: VIN only). */
  hideListingUrl?: boolean;
  /** Per-tier turnaround; falls back to shared audit turnaround. */
  turnaround?: string;
  /** CTA footnote override. */
  footnote?: string;
};

/** Merged supported manufacturers (PROVIN + supplier list). */
export const TP5_DEALER_BRANDS = [
  "Audi",
  "BMW",
  "Citroën",
  "Dacia",
  "Jaguar",
  "Land Rover",
  "Mercedes-Benz (2010+)",
  "MINI",
  "Opel",
  "Peugeot",
  "Renault",
  "SEAT",
  "Škoda",
  "Smart",
  "Volkswagen",
  "Volvo",
] as const;

/** Shared checklist — MINI includes the first 5; AUDITS includes all. */
const TP5_MOBILE_FEATURE_NAMES = [
  "Tehnisko apskašu vēsture (LV)",
  "Sludinājuma un pārdevēja analīze",
  "Ieteikumi klātienes apskatei",
  "Tehnisko risku analīze",
  "Individuāla konsultācija",
  "autoDNA atskaite",
  "carVertical atskaite",
  "Izsoļu portālu arhīva dati*",
  "Oficiālo dīleru sistēmu dati*",
  "Starptautisku reģistru pārbaude",
  "Apdrošinātāju dati (avārijas, zādzības)",
] as const;

const TP5_MOBILE_FEATURE_NAMES_EN = [
  "Technical inspection history (LV)",
  "Listing and seller analysis",
  "In-person inspection guidance",
  "Technical risk analysis",
  "Personal consultation",
  "autoDNA report",
  "carVertical report",
  "Auction portal archive data*",
  "Official dealer system data*",
  "International registry check",
  "Insurer data (accidents, theft)",
] as const;

const MINI_ACTIVE_FEATURE_COUNT = 5;

const DEALER_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Servisa vēsture, apkopju intervāli u.c.", included: true },
  { name: "Ja dati nav pieejami — 100% naudas atmaksa", included: true },
];

const DEALER_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Service history, service intervals, etc.", included: true },
  { name: "If no data available — 100% refund", included: true },
];

const DEALER_BRANDS_HEADING_LV = "Atbalstītie ražotāji";
const DEALER_BRANDS_HEADING_EN = "Supported manufacturers";

const AUDITS_FOOTNOTE_LV = "*ja dati ir pieejami";
const AUDITS_FOOTNOTE_EN = "*if data is available";

const DEALER_FOOTNOTE_LV =
  "Atmaksājam 100%, ja oficiālajā datubāzē ierakstu nav.";

const DEALER_FOOTNOTE_EN =
  "We refund 100% if official database records are unavailable.";

function buildTp5MobileFeatures(
  names: readonly string[],
  includedThroughIndex: number,
): Tp5MobileFeature[] {
  return names.map((name, index) => ({
    name,
    included: index < includedThroughIndex,
  }));
}

/** Feature row count shared by MINI/AUDITS — drives fixed liquidAccent height. */
export const TP5_MOBILE_FEATURE_ROW_COUNT = TP5_MOBILE_FEATURE_NAMES.length;

/** Mobile `/test-pricing-5` + home hero — MINI, AUDITS, dealer data. */
export const TP5_MOBILE_SERVICES: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "39,99 €",
    buttonText: "PASŪTĪT MINI AUDITU — 39,99 €",
    description:
      "Sludinājuma, risku un LV vēstures analīze ar konsultāciju — bez starptautiskajām maksas atskaitēm.",
    features: buildTp5MobileFeatures(TP5_MOBILE_FEATURE_NAMES, MINI_ACTIVE_FEATURE_COUNT),
    footnote: " ",
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    price: "99,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU — 99,99 €",
    description:
      "Viena cena — vairākas starptautiskas vēstures atskaites plus PROVIN eksperta analīze un konsultācija vienā pārskatā.",
    features: buildTp5MobileFeatures(TP5_MOBILE_FEATURE_NAMES, TP5_MOBILE_FEATURE_NAMES.length),
    footnote: AUDITS_FOOTNOTE_LV,
  },
  {
    id: "dealer",
    title: "DĪLERA DATI",
    price: "24,99 €",
    buttonText: "PASŪTĪT DĪLERA DATUS — 24,99 €",
    description: "Tikai oficiālo dīleru sistēmu ieraksti.",
    features: DEALER_FEATURES_LV,
    brands: TP5_DEALER_BRANDS,
    brandsHeading: DEALER_BRANDS_HEADING_LV,
    turnaround: "⏱️ Izpilde: 24-48h",
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
      "Listing, risk and LV history analysis with consultation — without international paid reports.",
    features: buildTp5MobileFeatures(TP5_MOBILE_FEATURE_NAMES_EN, MINI_ACTIVE_FEATURE_COUNT),
    footnote: " ",
  },
  {
    id: "audits",
    title: "PROVIN AUDIT",
    price: "€99.99",
    buttonText: "ORDER PROVIN AUDIT — €99.99",
    description:
      "One price — several international history reports plus PROVIN expert analysis and consultation in a single overview.",
    features: buildTp5MobileFeatures(
      TP5_MOBILE_FEATURE_NAMES_EN,
      TP5_MOBILE_FEATURE_NAMES_EN.length,
    ),
    footnote: AUDITS_FOOTNOTE_EN,
  },
  {
    id: "dealer",
    title: "DEALER DATA",
    price: "€24.99",
    buttonText: "ORDER DEALER DATA — €24.99",
    description: "Official dealer system records only.",
    features: DEALER_FEATURES_EN,
    brands: TP5_DEALER_BRANDS,
    brandsHeading: DEALER_BRANDS_HEADING_EN,
    turnaround: "⏱️ Delivery: 24-48h",
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
