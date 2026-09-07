import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

export type Tp5FeatureTone = "default" | "soft" | "guarantee" | "info" | "brands";

export type Tp5MobileFeature = {
  name: string;
  included: boolean;
  /** soft = muted dash (not a red ✕); guarantee = refund-style ✓ */
  tone?: Tp5FeatureTone;
  /** Optional supporting line (dealer highlight card). */
  subtitle?: string;
};

export type Tp5MobileServiceId = "mini" | "audits" | "dealer" | "koreaUsa";

export type Tp5MobileService = {
  id: Tp5MobileServiceId;
  /** Desktop tab / fallback title. */
  title: string;
  /** Compact mobile tab label (MINI / AUDITS / DĪLERI). */
  tabTitle?: string;
  /** Mobile card heading when it differs from `title`. */
  cardTitle?: string;
  price: string;
  buttonText: string;
  /** Compact mobile CTA (`PASŪTĪT 39,99 €`). Desktop keeps `buttonText`. */
  buttonTextShort?: string;
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
  /** Mobile card “Ieteicams” badge (AUDITS). */
  recommended?: boolean;
  /** Desktop dealer globe panel (mobile uses the 5-row checklist). */
  desktopHighlight?: Tp5MobileFeature;
};

/** Supported manufacturers in a fixed 3×6 display grid (premium/popularity + brand groups). */
export const TP5_DEALER_BRAND_ROWS = [
  ["Mercedes-Benz", "BMW", "MINI", "Rolls-Royce", "Audi", "Volkswagen"],
  ["Volvo", "Land Rover", "Jaguar", "Škoda", "SEAT", "Subaru"],
  ["Peugeot", "Citroën", "Renault", "Dacia", "Opel", "Smart"],
] as const;

/** Flat brand list (same set as grid). */
export const TP5_DEALER_BRANDS = TP5_DEALER_BRAND_ROWS.flat();

/** Public logo paths for dealer brand grid cells. */
export const TP5_DEALER_BRAND_LOGO_SRC: Record<(typeof TP5_DEALER_BRANDS)[number], string> = {
  "Mercedes-Benz": "/brand-logos/mercedes.svg?v=6",
  BMW: "/brand-logos/bmw.svg?v=5",
  MINI: "/brand-logos/mini.svg?v=8",
  "Rolls-Royce": "/brand-logos/rolls-royce.svg?v=8",
  Audi: "/brand-logos/audi.svg?v=8",
  Volkswagen: "/brand-logos/volkswagen.svg?v=8",
  Volvo: "/brand-logos/volvo.svg?v=8",
  "Land Rover": "/brand-logos/land-rover.svg?v=8",
  Jaguar: "/brand-logos/jaguar.svg?v=8",
  Škoda: "/brand-logos/skoda.svg?v=5",
  SEAT: "/brand-logos/seat.svg?v=8",
  Subaru: "/brand-logos/subaru.svg?v=8",
  Peugeot: "/brand-logos/peugeot.svg?v=8",
  Citroën: "/brand-logos/citroen.svg?v=8",
  Renault: "/brand-logos/renault.svg?v=8",
  Dacia: "/brand-logos/dacia.svg?v=5",
  Opel: "/brand-logos/opel.svg?v=8",
  Smart: "/brand-logos/smart.svg?v=8",
};

/** Brands whose PNG still ships with a solid black plate (none after alpha strip). */
export const TP5_DEALER_BRAND_DARK_PLATE = new Set<string>([]);

/** Card checklist row count for MINI/AUDITS compare stack. */
export const TP5_MOBILE_FEATURE_ROW_COUNT = 5;

const AUDITS_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Konsultācija un ieteikumi klātienes apskatei", included: true },
  { name: "Apdrošinātāju dati un tehnisko apskašu vēsture", included: true },
  { name: "Sludinājuma, pārdevēja un tehnisko risku analīze", included: true },
  { name: "CarVertical + AutoDNA + Izcelsmes valsts reģistri", included: true },
  { name: "Oficiālo dīleru un izsoļu portālu arhīva dati*", included: true },
];

const AUDITS_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Consultation and in-person viewing tips", included: true },
  { name: "Insurer data and technical inspection history", included: true },
  { name: "Listing, seller and technical risk analysis", included: true },
  { name: "CarVertical + AutoDNA + Origin-country registers", included: true },
  { name: "Official dealer and auction portal archive data*", included: true },
];

const MINI_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Konsultācija un ieteikumi klātienes apskatei", included: true },
  { name: "Apdrošinātāju dati un tehnisko apskašu vēsture", included: true },
  { name: "Sludinājuma, pārdevēja un tehnisko risku analīze", included: true },
  { name: "CarVertical + AutoDNA + Izcelsmes valsts reģistri", included: false },
  { name: "Oficiālo dīleru un izsoļu portālu arhīva dati*", included: false },
];

const MINI_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Consultation and in-person viewing tips", included: true },
  { name: "Insurer data and technical inspection history", included: true },
  { name: "Listing, seller and technical risk analysis", included: true },
  { name: "CarVertical + AutoDNA + Origin-country registers", included: false },
  { name: "Official dealer and auction portal archive data*", included: false },
];

const DEALER_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Odometra rādījumi", included: true },
  { name: "Servisa un apkopju vēsture*", included: true },
  { name: "Kopsavilkums", included: true },
  { name: "100% Naudas atmaksas garantija.", included: true, tone: "guarantee" },
  { name: "Atbalstītie ražotāji", included: true, tone: "brands" },
];

const DEALER_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Odometer readings", included: true },
  { name: "Service and maintenance history*", included: true },
  { name: "Summary", included: true },
  { name: "100% money-back guarantee.", included: true, tone: "guarantee" },
  { name: "Supported manufacturers", included: true, tone: "brands" },
];

const KOREA_USA_FEATURES_LV: Tp5MobileFeature[] = [
  { name: "Oficiālo reģistru vēsture", included: true },
  { name: "Izsoļu arhīvs un foto", included: true },
  { name: "Bojājumu un nobraukuma analīze", included: true },
  { name: "100% Naudas atmaksas garantija", included: true, tone: "guarantee" },
];

const KOREA_USA_FEATURES_EN: Tp5MobileFeature[] = [
  { name: "Official registry history", included: true },
  { name: "Auction archive and photos", included: true },
  { name: "Damage and mileage analysis", included: true },
  { name: "100% money-back guarantee", included: true, tone: "guarantee" },
];

/** Tabs always shown on the home hero (catalog-only tiers appear when deep-linked). */
export const TP5_HERO_TAB_IDS: readonly Tp5MobileServiceId[] = ["mini", "audits", "dealer"];

/** Mobile home hero — MINI, AUDITS, dealer data (+ catalog deep-link tiers). */
export const TP5_MOBILE_SERVICES: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    tabTitle: "MINI",
    price: "39,99 €",
    buttonText: "PASŪTĪT MINI AUDITU 39,99 €",
    buttonTextShort: "PASŪTĪT 39,99 €",
    description: "",
    features: MINI_FEATURES_LV,
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    tabTitle: "AUDITS",
    price: "99,99 €",
    buttonText: "PASŪTĪT PROVIN AUDITU 99,99 €",
    buttonTextShort: "PASŪTĪT 99,99 €",
    description: "",
    features: AUDITS_FEATURES_LV,
    recommended: true,
  },
  {
    id: "dealer",
    title: "DĪLERA DATI",
    tabTitle: "DĪLERI",
    cardTitle: "OFICIĀLO DĪLERU DATI",
    price: "24,99 €",
    buttonText: "PASŪTĪT DĪLERA DATUS 24,99 €",
    buttonTextShort: "PASŪTĪT 24,99 €",
    description: "",
    features: DEALER_FEATURES_LV,
    brands: TP5_DEALER_BRANDS,
    turnaround: "⏱️ Izpilde: 24-72h",
    desktopHighlight: {
      name: "Dīleru servisa vēsture un nobraukums",
      subtitle: "Tiešā piekļuve oficiālajiem ražotāja apkopju ierakstiem.",
      included: true,
    },
  },
  {
    id: "koreaUsa",
    title: "ASV UN KOREJA",
    tabTitle: "ASV / KR",
    price: "19,99 €",
    buttonText: "PASŪTĪT ASV UN KOREJA 19,99 €",
    buttonTextShort: "PASŪTĪT 19,99 €",
    description: "",
    features: KOREA_USA_FEATURES_LV,
    turnaround: "⏱️ Izpilde: 24-72h",
  },
];

const TP5_MOBILE_SERVICES_EN: Tp5MobileService[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    tabTitle: "MINI",
    price: "€39.99",
    buttonText: "ORDER MINI AUDIT €39.99",
    buttonTextShort: "ORDER €39.99",
    description: "",
    features: MINI_FEATURES_EN,
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    tabTitle: "AUDITS",
    price: "€99.99",
    buttonText: "ORDER PROVIN AUDITS €99.99",
    buttonTextShort: "ORDER €99.99",
    description: "",
    features: AUDITS_FEATURES_EN,
    recommended: true,
  },
  {
    id: "dealer",
    title: "DEALER DATA",
    tabTitle: "DEALERS",
    cardTitle: "OFFICIAL DEALER DATA",
    price: "€24.99",
    buttonText: "ORDER DEALER DATA €24.99",
    buttonTextShort: "ORDER €24.99",
    description: "",
    features: DEALER_FEATURES_EN,
    brands: TP5_DEALER_BRANDS,
    turnaround: "⏱️ Delivery: 24-72h",
    desktopHighlight: {
      name: "Dealer service history and mileage",
      subtitle: "Direct access to official manufacturer service records.",
      included: true,
    },
  },
  {
    id: "koreaUsa",
    title: "USA & KOREA",
    tabTitle: "US / KR",
    price: "€19.99",
    buttonText: "ORDER USA & KOREA €19.99",
    buttonTextShort: "ORDER €19.99",
    description: "",
    features: KOREA_USA_FEATURES_EN,
    turnaround: "⏱️ Delivery: 24-72h",
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
  koreaUsa: "koreaUsa",
};

/** Hero tab list — keep main switcher at 3; include deep-linked catalog tiers when active. */
export function getTp5HeroTabServices(
  activeId: Tp5MobileServiceId,
  locale?: string,
): Tp5MobileService[] {
  const all = getTp5MobileServices(locale);
  return all.filter(
    (service) => TP5_HERO_TAB_IDS.includes(service.id) || service.id === activeId,
  );
}

export function getTp5HeroSwipeOrder(activeId: Tp5MobileServiceId): Tp5MobileServiceId[] {
  return getTp5HeroTabServices(activeId).map((service) => service.id);
}

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

export function getTp5MobileTabTitle(service: Tp5MobileService): string {
  return service.tabTitle ?? service.title;
}

export function getTp5MobileCardTitle(service: Tp5MobileService): string {
  return service.cardTitle ?? service.title;
}

export function getTp5MobileCtaLabel(service: Tp5MobileService, compact: boolean): string {
  return compact ? (service.buttonTextShort ?? service.buttonText) : service.buttonText;
}
