import type { Tp5DesktopHeroFeature } from "@/lib/test-pricing-5-desktop-hero-features";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
} from "@/lib/test-pricing-5-ui-copy";

export type B2bPartnerPlanId = "business" | "dealer";

export const B2B_DNA_SWAP_NOTE = "Atskaite var tikt aizstāta ar citu, reģionam atbilstošāku.";
const B2B_DNA_SWAP_NOTE_EN =
  "The report may be substituted with another region-appropriate database.";

export const B2B_BUSINESS_GOAL =
  "PROVIN BUSINESS apvieno datus no oficiālajiem dīleru tīkliem, carVertical, AutoDNA un Eiropas/Amerikas valstu reģistriem. Vienā ērtā atskaitē jūs saņemat pilnu nobraukuma hronoloģiju, negadījumu vēsturi un servisa ierakstus, būtiski samazinot riskus un iegūstot pārliecību katrā darījumā.";

const B2B_BUSINESS_GOAL_EN =
  "PROVIN BUSINESS combines data from official dealer networks, carVertical, AutoDNA and European/US registries. In one clear report you get a full mileage timeline, accident history and service records, reducing risk and giving confidence in every deal.";

export const B2B_DEALER_GOAL =
  "DĪLERA DATI nodrošina padziļinātu oficiālo servisu ierakstu analīzi tieši no ražotāju datubāzēm. Vienā pārskatāmā atskaitē jūs saņemat pilnu nobraukuma hronoloģiju, veiktos remontus, apkopes un aktīvo kampaņu pārbaudi, sniedzot maksimālu pārredzamību un tiešu piekļuvi atbalstīto zīmolu sistēmām.";

const B2B_DEALER_GOAL_EN =
  "DEALER DATA provides in-depth analysis of official service records directly from manufacturer databases. In one clear report you get a full mileage timeline, repairs, maintenance and active campaign checks, with maximum transparency and direct access to supported brand systems.";

export const B2B_DEALER_GUARANTEE_TITLE = "100% Naudas atmaksas garantija";
export const B2B_DEALER_GUARANTEE_BODY =
  "Ja konkrētajam VIN kodam ražotāja oficiālajā datubāzē nav ierakstu, veiksim pilnu pirkuma atmaksu.";

const B2B_DEALER_GUARANTEE_TITLE_EN = "100% money-back guarantee";
const B2B_DEALER_GUARANTEE_BODY_EN =
  "If the manufacturer's official database has no records for this VIN, we will refund the purchase in full.";

/** Same 8 glyphs as the public AUDITS rail; labels follow BUSINESS sources. */
export const B2B_BUSINESS_DESKTOP_FEATURES: Tp5DesktopHeroFeature[] = [
  { label: "Oficiālo dīleru dati", icon: "dealer-data" },
  { label: "carVertical integrācija", icon: "carvertical" },
  { label: "autoDNA integrācija", icon: "autodna" },
  { label: "Izcelsmes valsts reģistri", icon: "eu-registry" },
  { label: "Izsoļu portālu arhīvs", icon: "listing-analysis" },
  { label: "Apdrošinātāju dati", icon: "consultation" },
  { label: "Tehnisko apskašu vēsture", icon: "inspection-tips" },
  { label: "Starptautiska vēstures pārbaude", icon: "international" },
];

const B2B_BUSINESS_DESKTOP_FEATURES_EN: Tp5DesktopHeroFeature[] = [
  { label: "Official dealer data", icon: "dealer-data" },
  { label: "carVertical integration", icon: "carvertical" },
  { label: "autoDNA integration", icon: "autodna" },
  { label: "Origin-country registers", icon: "eu-registry" },
  { label: "Auction portal archive", icon: "listing-analysis" },
  { label: "Insurer data", icon: "consultation" },
  { label: "Technical inspection history", icon: "inspection-tips" },
  { label: "International history check", icon: "international" },
];

export const B2B_BUSINESS_HERO_FEATURES = [
  "Oficiālo dīleru dati*",
  "CarVertical + AutoDNA",
  "Izcelsmes valsts reģistri",
  "Izsoļu portālu arhīva dati",
  "Apdrošinātāju dati",
  "Tehnisko apskašu vēsture",
  "Datu kopsavilkums",
] as const;

const B2B_BUSINESS_HERO_FEATURES_EN = [
  "Official dealer data*",
  "CarVertical + AutoDNA",
  "Origin-country registers",
  "Auction portal archive data",
  "Insurer data",
  "Technical inspection history",
  "Data summary",
] as const;

export type B2bCatalogItem = {
  title: string;
  description?: string;
  icon: "store" | "globe" | "camera" | "shield" | "clipboard" | "list" | "gauge" | "tags" | "logos";
};

export type B2bCatalogPackage = {
  title: string;
  goal: string;
  items: B2bCatalogItem[];
  foot: string;
  sampleHref: string;
  guaranteeTitle?: string;
  guaranteeBody?: string;
};

export const B2B_CATALOG: Record<B2bPartnerPlanId, B2bCatalogPackage> = {
  business: {
    title: "PROVIN BUSINESS",
    goal: B2B_BUSINESS_GOAL,
    items: [
      {
        icon: "store" as const,
        title: "Oficiālo dīleru dati*",
      },
      {
        icon: "logos" as const,
        title: "CarVertical + AutoDNA",
      },
      {
        icon: "globe" as const,
        title: "Izcelsmes valsts reģistri",
      },
      {
        icon: "camera" as const,
        title: "Izsoļu portālu arhīva dati",
      },
      {
        icon: "shield" as const,
        title: "Apdrošinātāju dati",
      },
      {
        icon: "clipboard" as const,
        title: "Tehnisko apskašu vēsture",
      },
      {
        icon: "list" as const,
        title: "Datu kopsavilkums",
      },
    ],
    foot: "*pieejama noteiktiem ražotājiem.",
    sampleHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
  },
  dealer: {
    title: "DĪLERA DATI",
    goal: B2B_DEALER_GOAL,
    guaranteeTitle: B2B_DEALER_GUARANTEE_TITLE,
    guaranteeBody: B2B_DEALER_GUARANTEE_BODY,
    items: [],
    foot: "",
    sampleHref: TP5_DEALER_SAMPLE_REPORT_HREF,
  },
};

const B2B_CATALOG_EN: Record<B2bPartnerPlanId, B2bCatalogPackage> = {
  business: {
    title: "PROVIN BUSINESS",
    goal: B2B_BUSINESS_GOAL_EN,
    items: [
      {
        icon: "store" as const,
        title: "Official dealer data*",
      },
      {
        icon: "logos" as const,
        title: "CarVertical + AutoDNA",
      },
      {
        icon: "globe" as const,
        title: "Origin-country registers",
      },
      {
        icon: "camera" as const,
        title: "Auction portal archive data",
      },
      {
        icon: "shield" as const,
        title: "Insurer data",
      },
      {
        icon: "clipboard" as const,
        title: "Technical inspection history",
      },
      {
        icon: "list" as const,
        title: "Data summary",
      },
    ],
    foot: "*available for selected manufacturers.",
    sampleHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
  },
  dealer: {
    title: "DEALER DATA",
    goal: B2B_DEALER_GOAL_EN,
    guaranteeTitle: B2B_DEALER_GUARANTEE_TITLE_EN,
    guaranteeBody: B2B_DEALER_GUARANTEE_BODY_EN,
    items: [],
    foot: "",
    sampleHref: TP5_DEALER_SAMPLE_REPORT_HREF,
  },
};

export function getB2bCatalog(locale?: string): Record<B2bPartnerPlanId, B2bCatalogPackage> {
  return locale === "en" ? B2B_CATALOG_EN : B2B_CATALOG;
}

export function getB2bCatalogPlan(
  plan: B2bPartnerPlanId,
  locale?: string,
): B2bCatalogPackage {
  return getB2bCatalog(locale)[plan];
}

export function getB2bBusinessHeroFeatures(locale?: string): readonly string[] {
  return locale === "en" ? B2B_BUSINESS_HERO_FEATURES_EN : B2B_BUSINESS_HERO_FEATURES;
}

export function getB2bBusinessDesktopFeatures(locale?: string): Tp5DesktopHeroFeature[] {
  return locale === "en" ? B2B_BUSINESS_DESKTOP_FEATURES_EN : B2B_BUSINESS_DESKTOP_FEATURES;
}

export function getB2bDnaSwapNote(locale?: string): string {
  return locale === "en" ? B2B_DNA_SWAP_NOTE_EN : B2B_DNA_SWAP_NOTE;
}

export const B2B_PARTNER_PRICE: Record<B2bPartnerPlanId, string> = {
  business: "79,99 €",
  dealer: "19,99 €",
};

export const B2B_PARTNER_PRICE_CENTS: Record<B2bPartnerPlanId, number> = {
  business: 7999,
  dealer: 1999,
};

export type B2bPackQty = 1 | 10;

export type B2bPackOffer = {
  qty: B2bPackQty;
  unitCents: number;
};

export const B2B_BUSINESS_PACKS: readonly B2bPackOffer[] = [
  { qty: 1, unitCents: 7999 },
  { qty: 10, unitCents: 6999 },
];

export const B2B_DEALER_PACKS: readonly B2bPackOffer[] = [
  { qty: 1, unitCents: 1999 },
  { qty: 10, unitCents: 1799 },
];

export function formatB2bEuroFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function b2bPackListCents(plan: B2bPartnerPlanId): number {
  return plan === "business" ? B2B_BUSINESS_PACKS[0].unitCents : B2B_DEALER_PACKS[0].unitCents;
}

export function b2bPackDiscountPct(unitCents: number, listCents: number): number {
  if (listCents <= 0 || unitCents >= listCents) return 0;
  return Math.round(((listCents - unitCents) / listCents) * 100);
}

export function isB2bPartnerCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}
