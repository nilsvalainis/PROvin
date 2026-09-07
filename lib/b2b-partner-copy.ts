import type { Tp5DesktopHeroFeature } from "@/lib/test-pricing-5-desktop-hero-features";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
} from "@/lib/test-pricing-5-ui-copy";

export type B2bPartnerPlanId = "business" | "dealer";

export const B2B_DNA_SWAP_NOTE = "Atskaite var tikt aizstāta ar citu, reģionam atbilstošāku.";

export const B2B_BUSINESS_GOAL =
  "PROVIN BUSINESS apvieno datus no oficiālajiem dīleru tīkliem, carVertical, AutoDNA un Eiropas/Amerikas valstu reģistriem. Vienā ērtā atskaitē jūs saņemat pilnu nobraukuma hronoloģiju, negadījumu vēsturi un servisa ierakstus, būtiski samazinot riskus un iegūstot pārliecību katrā darījumā.";

export const B2B_DEALER_GOAL =
  "DĪLERA DATI nodrošina padziļinātu oficiālo servisu ierakstu analīzi tieši no ražotāju datubāzēm. Vienā pārskatāmā atskaitē jūs saņemat pilnu nobraukuma hronoloģiju, veiktos remontus, apkopes un aktīvo kampaņu pārbaudi, sniedzot maksimālu pārredzamību un tiešu piekļuvi atbalstīto zīmolu sistēmām.";

export const B2B_DEALER_GUARANTEE_TITLE = "100% Naudas atmaksas garantija";
export const B2B_DEALER_GUARANTEE_BODY =
  "Ja konkrētajam VIN kodam ražotāja oficiālajā datubāzē nav ierakstu, veiksim pilnu pirkuma atmaksu.";

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

export const B2B_BUSINESS_HERO_FEATURES = [
  "Oficiālo dīleru dati*",
  "CarVertical + AutoDNA",
  "Izcelsmes valsts reģistri",
  "Izsoļu portālu arhīva dati",
  "Apdrošinātāju dati",
  "Tehnisko apskašu vēsture",
  "Datu kopsavilkums",
] as const;

export type B2bCatalogItem = {
  title: string;
  description?: string;
  icon: "store" | "globe" | "camera" | "shield" | "clipboard" | "list" | "gauge" | "tags" | "logos";
};

export const B2B_CATALOG = {
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
    ] satisfies B2bCatalogItem[],
    foot: "*pieejama noteiktiem ražotājiem.",
    sampleHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
  },
  dealer: {
    title: "DĪLERA DATI",
    goal: B2B_DEALER_GOAL,
    guaranteeTitle: B2B_DEALER_GUARANTEE_TITLE,
    guaranteeBody: B2B_DEALER_GUARANTEE_BODY,
    items: [] satisfies B2bCatalogItem[],
    foot: "",
    sampleHref: TP5_DEALER_SAMPLE_REPORT_HREF,
  },
};

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
  recommended: boolean;
};

export const B2B_BUSINESS_PACKS: readonly B2bPackOffer[] = [
  { qty: 1, unitCents: 7999, recommended: false },
  { qty: 10, unitCents: 6999, recommended: true },
];

export const B2B_DEALER_PACKS: readonly B2bPackOffer[] = [
  { qty: 1, unitCents: 1999, recommended: false },
  { qty: 10, unitCents: 1799, recommended: true },
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
