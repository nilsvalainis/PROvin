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
  /** Exactly 4 core bullets shown on the card. */
  features: Tp5MobileFeature[];
  /** Full checklist shown in the “view all” modal. */
  modalFeatures: Tp5MobileFeature[];
  /** Modal trigger label. */
  modalTrigger: string;
  /** Modal title. */
  modalTitle: string;
  /** Brands for dealer modal section. */
  brands?: readonly string[];
  brandsHeading?: string;
  /** Explanatory note under checklist (not a ✓ row). */
  extraNote?: string;
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

/** Full shared checklist — MINI includes the first 5; AUDITS includes all. */
export const TP5_FULL_FEATURE_NAMES_LV = [
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

const TP5_FULL_FEATURE_NAMES_EN = [
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

/** Card always shows exactly four core rows. */
export const TP5_CORE_FEATURE_ROW_COUNT = 4;

const MINI_CORE_LV: Tp5MobileFeature[] = [
  { name: "Tehnisko apskašu vēsture (LV) / CSDD", included: true },
  { name: "Sludinājuma un pārdevēja analīze", included: true },
  { name: "Tehnisko risku analīze", included: true },
  { name: "Konsultācija un klātienes ieteikumi", included: true },
];

const MINI_CORE_EN: Tp5MobileFeature[] = [
  { name: "Inspection history (LV) / CSDD", included: true },
  { name: "Listing and seller analysis", included: true },
  { name: "Technical risk analysis", included: true },
  { name: "Consultation and viewing tips", included: true },
];

const AUDITS_CORE_LV: Tp5MobileFeature[] = [
  { name: "CarVertical + AutoDNA + CSDD u.c.", included: true },
  { name: "Oficiālo dīleru dati un izsoļu arhīvi", included: true },
  { name: "Sludinājuma un tehnisko risku analīze", included: true },
  { name: "Konsultācija un klātienes ieteikumi", included: true },
];

const AUDITS_CORE_EN: Tp5MobileFeature[] = [
  { name: "CarVertical + AutoDNA + CSDD and more", included: true },
  { name: "Official dealer data and auction archives", included: true },
  { name: "Listing and technical risk analysis", included: true },
  { name: "Consultation and viewing tips", included: true },
];

const DEALER_CORE_LV: Tp5MobileFeature[] = [
  { name: "Tiešā piekļuve oficiālajām ražotāju datubāzēm", included: true },
  { name: "Odometra rādījumi un servisa vēsture", included: true },
  { name: "Apkopju intervāli un kopsavilkums", included: true },
  { name: "Izsoļu portālu arhīva dati*", included: true },
];

const DEALER_CORE_EN: Tp5MobileFeature[] = [
  { name: "Direct access to official manufacturer databases", included: true },
  { name: "Odometer readings and service history", included: true },
  { name: "Service intervals and summary", included: true },
  { name: "Auction portal archive data*", included: true },
];

const DEALER_MODAL_LV: Tp5MobileFeature[] = [
  { name: "Odometra rādījumi", included: true },
  { name: "Servisa vēsture", included: true },
  { name: "Apkopju intervāli", included: true },
  { name: "Kopsavilkums", included: true },
  { name: "Izsoļu portālu arhīva dati*", included: true },
];

const DEALER_MODAL_EN: Tp5MobileFeature[] = [
  { name: "Odometer readings", included: true },
  { name: "Service history", included: true },
  { name: "Service intervals", included: true },
  { name: "Summary", included: true },
  { name: "Auction portal archive data*", included: true },
];

const DEALER_BRANDS_HEADING_LV = "Atbalstītie ražotāji";
const DEALER_BRANDS_HEADING_EN = "Supported manufacturers";

const AUDITS_FOOTNOTE_LV = "*ja dati ir pieejami";
const AUDITS_FOOTNOTE_EN = "*if data is available";

const DEALER_EXTRA_NOTE_LV = "Ja dati nav pieejami — 100% naudas atmaksa.";
const DEALER_EXTRA_NOTE_EN = "If no data is available — 100% refund.";

function buildFullFeatures(
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
      "Sludinājuma, tehnisko datu un risku analīze. Paredzēts Latvijā ilgstoši ekspluatētām automašīnām.",
    features: MINI_CORE_LV,
    modalFeatures: buildFullFeatures(TP5_FULL_FEATURE_NAMES_LV, MINI_ACTIVE_FEATURE_COUNT),
    modalTrigger: "Skatīt visus iekļautos un neiekļautos punktus",
    modalTitle: "PROVIN MINI — kas iekļauts",
    footnote: " ",
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    price: "99,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU — 99,99 €",
    description: "Pilnīgākais auto pārbaudes komplekts Latvijā.",
    features: AUDITS_CORE_LV,
    modalFeatures: buildFullFeatures(TP5_FULL_FEATURE_NAMES_LV, TP5_FULL_FEATURE_NAMES_LV.length),
    modalTrigger: "Skatīt visus 11 cenā iekļautos pakalpojumus",
    modalTitle: "PROVIN AUDITS — visi 11 pakalpojumi",
    footnote: AUDITS_FOOTNOTE_LV,
  },
  {
    id: "dealer",
    title: "DĪLERA DATI",
    price: "24,99 €",
    buttonText: "PASŪTĪT DĪLERA DATUS — 24,99 €",
    description: "Oficiālo dīleru sistēmu ieraksti un pārbaude izsoļu portālu arhīvā.",
    features: DEALER_CORE_LV,
    modalFeatures: DEALER_MODAL_LV,
    modalTrigger: "Skatīt detalizāciju un atbalstītos ražotājus",
    modalTitle: "DĪLERA DATI — detalizācija",
    brands: TP5_DEALER_BRANDS,
    brandsHeading: DEALER_BRANDS_HEADING_LV,
    extraNote: DEALER_EXTRA_NOTE_LV,
    turnaround: "⏱️ Izpilde: 24-48h",
    footnote: AUDITS_FOOTNOTE_LV,
  },
];

const TP5_MOBILE_SERVICES_EN: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    price: "€39.99",
    buttonText: "ORDER MINI AUDIT — €39.99",
    description:
      "Listing, technical data and risk analysis. Intended for cars that have been used in Latvia for a longer time.",
    features: MINI_CORE_EN,
    modalFeatures: buildFullFeatures(TP5_FULL_FEATURE_NAMES_EN, MINI_ACTIVE_FEATURE_COUNT),
    modalTrigger: "View all included and excluded items",
    modalTitle: "PROVIN MINI — what’s included",
    footnote: " ",
  },
  {
    id: "audits",
    title: "PROVIN AUDIT",
    price: "€99.99",
    buttonText: "ORDER PROVIN AUDIT — €99.99",
    description: "The most complete vehicle check package in Latvia.",
    features: AUDITS_CORE_EN,
    modalFeatures: buildFullFeatures(TP5_FULL_FEATURE_NAMES_EN, TP5_FULL_FEATURE_NAMES_EN.length),
    modalTrigger: "View all 11 services included in the price",
    modalTitle: "PROVIN AUDIT — all 11 services",
    footnote: AUDITS_FOOTNOTE_EN,
  },
  {
    id: "dealer",
    title: "DEALER DATA",
    price: "€24.99",
    buttonText: "ORDER DEALER DATA — €24.99",
    description: "Official dealer system records and auction portal archive check.",
    features: DEALER_CORE_EN,
    modalFeatures: DEALER_MODAL_EN,
    modalTrigger: "View details and supported manufacturers",
    modalTitle: "DEALER DATA — details",
    brands: TP5_DEALER_BRANDS,
    brandsHeading: DEALER_BRANDS_HEADING_EN,
    extraNote: DEALER_EXTRA_NOTE_EN,
    turnaround: "⏱️ Delivery: 24-48h",
    footnote: AUDITS_FOOTNOTE_EN,
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
