import type { Tp5DesktopHeroFeature } from "@/lib/test-pricing-5-desktop-hero-features";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
} from "@/lib/test-pricing-5-ui-copy";

export type B2bPartnerPlanId = "business" | "dealer";

export const B2B_DNA_SWAP_NOTE = "Atskaite var tikt aizstāta ar citu, reģionam atbilstošāku.";
const B2B_DNA_SWAP_NOTE_EN =
  "The report may be substituted with another region-appropriate database.";
const B2B_DNA_SWAP_NOTE_DE =
  "Der Bericht kann durch eine andere, für die Region passende Datenquelle ersetzt werden.";
const B2B_DNA_SWAP_NOTE_RU =
  "Отчёт может быть заменён другой базой, которая лучше подходит для региона.";

export const B2B_BUSINESS_GOAL =
  "PROVIN BUSINESS apvieno datus no oficiālajiem dīleru tīkliem, carVertical, AutoDNA un Eiropas/Amerikas valstu reģistriem. Vienā ērtā atskaitē jūs saņemat pilnu nobraukuma hronoloģiju, negadījumu vēsturi un servisa ierakstus, būtiski samazinot riskus un iegūstot pārliecību katrā darījumā.";

const B2B_BUSINESS_GOAL_EN =
  "PROVIN BUSINESS combines data from official dealer networks, carVertical, AutoDNA and European/US registries. In one clear report you get a full mileage timeline, accident history and service records, reducing risk and giving confidence in every deal.";
const B2B_BUSINESS_GOAL_DE =
  "PROVIN BUSINESS bündelt Daten aus offiziellen Händlernetzen, carVertical, AutoDNA und europäischen sowie US-Registern. In einem Bericht erhalten Sie die Kilometerchronologie, die Unfallhistorie und Serviceeinträge, senken das Risiko und gewinnen Sicherheit in jedem Geschäft.";
const B2B_BUSINESS_GOAL_RU =
  "PROVIN BUSINESS собирает данные официальных дилерских сетей, carVertical, AutoDNA и реестров Европы и США. В одном отчёте вы получаете хронологию пробега, историю ДТП и записи обслуживания: меньше риска и больше уверенности в каждой сделке.";

export const B2B_DEALER_GOAL =
  "DĪLERA DATI nodrošina padziļinātu oficiālo servisu ierakstu analīzi tieši no ražotāju datubāzēm. Vienā pārskatāmā atskaitē jūs saņemat pilnu nobraukuma hronoloģiju, veiktos remontus, apkopes un aktīvo kampaņu pārbaudi, sniedzot maksimālu pārredzamību un tiešu piekļuvi atbalstīto zīmolu sistēmām.";

const B2B_DEALER_GOAL_EN =
  "DEALER DATA provides in-depth analysis of official service records directly from manufacturer databases. In one clear report you get a full mileage timeline, repairs, maintenance and active campaign checks, with maximum transparency and direct access to supported brand systems.";
const B2B_DEALER_GOAL_DE =
  "HÄNDLERDATEN liefern die Servicehistorie direkt aus den Herstellerdatenbanken. In einem Bericht sehen Sie Kilometerstände, Reparaturen, Wartungen und offene Rückrufaktionen, mit direktem Zugang zu den Systemen der unterstützten Marken.";
const B2B_DEALER_GOAL_RU =
  "ДАННЫЕ ДИЛЕРА дают разбор официальных сервисных записей напрямую из баз производителя. В одном отчёте: пробег, ремонты, ТО и проверка активных кампаний, с прямым доступом к системам поддерживаемых марок.";

export const B2B_DEALER_GUARANTEE_TITLE = "100% Naudas atmaksas garantija";
export const B2B_DEALER_GUARANTEE_BODY =
  "Ja konkrētajam VIN kodam ražotāja oficiālajā datubāzē nav ierakstu, veiksim pilnu pirkuma atmaksu.";

const B2B_DEALER_GUARANTEE_TITLE_EN = "100% money-back guarantee";
const B2B_DEALER_GUARANTEE_BODY_EN =
  "If the manufacturer's official database has no records for this VIN, we will refund the purchase in full.";
const B2B_DEALER_GUARANTEE_TITLE_DE = "100% Geld-zurück-Garantie";
const B2B_DEALER_GUARANTEE_BODY_DE =
  "Liegen in der offiziellen Herstellerdatenbank zu dieser VIN keine Einträge vor, erstatten wir den Kaufbetrag in voller Höhe.";
const B2B_DEALER_GUARANTEE_TITLE_RU = "100% гарантия возврата денег";
const B2B_DEALER_GUARANTEE_BODY_RU =
  "Если в официальной базе производителя по этому VIN нет записей, вернём полную стоимость покупки.";

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
const B2B_BUSINESS_DESKTOP_FEATURES_DE: Tp5DesktopHeroFeature[] = [
  { label: "Offizielle Händlerdaten", icon: "dealer-data" },
  { label: "carVertical-Anbindung", icon: "carvertical" },
  { label: "autoDNA-Anbindung", icon: "autodna" },
  { label: "Register des Herkunftslands", icon: "eu-registry" },
  { label: "Auktionsportal-Archiv", icon: "listing-analysis" },
  { label: "Versichererdaten", icon: "consultation" },
  { label: "Technische Prüfhistorie", icon: "inspection-tips" },
  { label: "Internationale Historienprüfung", icon: "international" },
];
const B2B_BUSINESS_DESKTOP_FEATURES_RU: Tp5DesktopHeroFeature[] = [
  { label: "Официальные данные дилера", icon: "dealer-data" },
  { label: "Интеграция carVertical", icon: "carvertical" },
  { label: "Интеграция autoDNA", icon: "autodna" },
  { label: "Реестры страны происхождения", icon: "eu-registry" },
  { label: "Архив аукционов", icon: "listing-analysis" },
  { label: "Данные страховщиков", icon: "consultation" },
  { label: "История техосмотров", icon: "inspection-tips" },
  { label: "Международная проверка истории", icon: "international" },
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
const B2B_BUSINESS_HERO_FEATURES_DE = [
  "Offizielle Händlerdaten*",
  "CarVertical + AutoDNA",
  "Register des Herkunftslands",
  "Auktionsportal-Archiv",
  "Versichererdaten",
  "Technische Prüfhistorie",
  "Datenübersicht",
] as const;
const B2B_BUSINESS_HERO_FEATURES_RU = [
  "Официальные данные дилера*",
  "CarVertical + AutoDNA",
  "Реестры страны происхождения",
  "Архив аукционов",
  "Данные страховщиков",
  "История техосмотров",
  "Сводка данных",
] as const;

export type B2bCatalogItem = {
  title: string;
  description?: string;
  icon: "store" | "globe" | "camera" | "shield" | "clipboard" | "list" | "gauge" | "tags" | "logos";
  /** First BUSINESS source: opens the full dealer-data disclosure. */
  opensDealer?: boolean;
};

export type B2bCatalogPackage = {
  title: string;
  goal: string;
  /** Phrase inside `goal` that opens the dealer-data disclosure. */
  goalDealerLink?: string;
  items: B2bCatalogItem[];
  foot: string;
  sampleHref: string;
  guaranteeTitle?: string;
  guaranteeBody?: string;
};

export function splitB2bGoalAroundLink(
  goal: string,
  link: string | undefined,
): { before: string; link: string; after: string } | null {
  const phrase = link?.trim() ?? "";
  if (!phrase) return null;
  const index = goal.indexOf(phrase);
  if (index < 0) return null;
  return {
    before: goal.slice(0, index),
    link: phrase,
    after: goal.slice(index + phrase.length),
  };
}

export const B2B_CATALOG: Record<B2bPartnerPlanId, B2bCatalogPackage> = {
  business: {
    title: "PROVIN BUSINESS",
    goal: B2B_BUSINESS_GOAL,
    goalDealerLink: "oficiālajiem dīleru tīkliem",
    items: [
      {
        icon: "store" as const,
        title: "Oficiālo dīleru dati*",
        opensDealer: true,
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
    goalDealerLink: "official dealer networks",
    items: [
      {
        icon: "store" as const,
        title: "Official dealer data*",
        opensDealer: true,
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

const B2B_CATALOG_DE: Record<B2bPartnerPlanId, B2bCatalogPackage> = {
  business: {
    title: "PROVIN BUSINESS",
    goal: B2B_BUSINESS_GOAL_DE,
    goalDealerLink: "offiziellen Händlernetzen",
    items: [
      { icon: "store" as const, title: "Offizielle Händlerdaten*", opensDealer: true },
      { icon: "logos" as const, title: "CarVertical + AutoDNA" },
      { icon: "globe" as const, title: "Register des Herkunftslands" },
      { icon: "camera" as const, title: "Auktionsportal-Archiv" },
      { icon: "shield" as const, title: "Versichererdaten" },
      { icon: "clipboard" as const, title: "Technische Prüfhistorie" },
      { icon: "list" as const, title: "Datenübersicht" },
    ],
    foot: "*verfügbar für ausgewählte Hersteller.",
    sampleHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
  },
  dealer: {
    title: "HÄNDLERDATEN",
    goal: B2B_DEALER_GOAL_DE,
    guaranteeTitle: B2B_DEALER_GUARANTEE_TITLE_DE,
    guaranteeBody: B2B_DEALER_GUARANTEE_BODY_DE,
    items: [],
    foot: "",
    sampleHref: TP5_DEALER_SAMPLE_REPORT_HREF,
  },
};

const B2B_CATALOG_RU: Record<B2bPartnerPlanId, B2bCatalogPackage> = {
  business: {
    title: "PROVIN BUSINESS",
    goal: B2B_BUSINESS_GOAL_RU,
    goalDealerLink: "официальных дилерских сетей",
    items: [
      { icon: "store" as const, title: "Официальные данные дилера*", opensDealer: true },
      { icon: "logos" as const, title: "CarVertical + AutoDNA" },
      { icon: "globe" as const, title: "Реестры страны происхождения" },
      { icon: "camera" as const, title: "Архив аукционов" },
      { icon: "shield" as const, title: "Данные страховщиков" },
      { icon: "clipboard" as const, title: "История техосмотров" },
      { icon: "list" as const, title: "Сводка данных" },
    ],
    foot: "*доступно для отдельных производителей.",
    sampleHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
  },
  dealer: {
    title: "ДАННЫЕ ДИЛЕРА",
    goal: B2B_DEALER_GOAL_RU,
    guaranteeTitle: B2B_DEALER_GUARANTEE_TITLE_RU,
    guaranteeBody: B2B_DEALER_GUARANTEE_BODY_RU,
    items: [],
    foot: "",
    sampleHref: TP5_DEALER_SAMPLE_REPORT_HREF,
  },
};

export function getB2bCatalog(locale?: string): Record<B2bPartnerPlanId, B2bCatalogPackage> {
  if (locale === "en") return B2B_CATALOG_EN;
  if (locale === "de") return B2B_CATALOG_DE;
  if (locale === "ru") return B2B_CATALOG_RU;
  return B2B_CATALOG;
}

export function getB2bCatalogPlan(
  plan: B2bPartnerPlanId,
  locale?: string,
): B2bCatalogPackage {
  return getB2bCatalog(locale)[plan];
}

export function getB2bBusinessHeroFeatures(locale?: string): readonly string[] {
  if (locale === "en") return B2B_BUSINESS_HERO_FEATURES_EN;
  if (locale === "de") return B2B_BUSINESS_HERO_FEATURES_DE;
  if (locale === "ru") return B2B_BUSINESS_HERO_FEATURES_RU;
  return B2B_BUSINESS_HERO_FEATURES;
}

const B2B_MILEAGE_HISTORY_TITLE = "Nobraukuma vēsture";
const B2B_MILEAGE_HISTORY_TITLE_EN = "Mileage history";
const B2B_MILEAGE_HISTORY_TITLE_DE = "Kilometerhistorie";
const B2B_MILEAGE_HISTORY_TITLE_RU = "История пробега";

/** 8 hairline sources for the login hero (catalog stays at 7 tiles). */
export function getB2bHeroSourceItems(locale?: string): B2bCatalogItem[] {
  const items = getB2bCatalog(locale).business.items.map((item) => ({ ...item }));
  const title =
    locale === "en"
      ? B2B_MILEAGE_HISTORY_TITLE_EN
      : locale === "de"
        ? B2B_MILEAGE_HISTORY_TITLE_DE
        : locale === "ru"
          ? B2B_MILEAGE_HISTORY_TITLE_RU
          : B2B_MILEAGE_HISTORY_TITLE;
  items.splice(5, 0, { icon: "gauge", title });
  return items;
}

export function getB2bBusinessDesktopFeatures(locale?: string): Tp5DesktopHeroFeature[] {
  if (locale === "en") return B2B_BUSINESS_DESKTOP_FEATURES_EN;
  if (locale === "de") return B2B_BUSINESS_DESKTOP_FEATURES_DE;
  if (locale === "ru") return B2B_BUSINESS_DESKTOP_FEATURES_RU;
  return B2B_BUSINESS_DESKTOP_FEATURES;
}

export function getB2bDnaSwapNote(locale?: string): string {
  if (locale === "en") return B2B_DNA_SWAP_NOTE_EN;
  if (locale === "de") return B2B_DNA_SWAP_NOTE_DE;
  if (locale === "ru") return B2B_DNA_SWAP_NOTE_RU;
  return B2B_DNA_SWAP_NOTE;
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

export function resolveB2bPacksForPartner(
  plan: B2bPartnerPlanId,
  prices?: {
    business1: number | null;
    business10: number | null;
    dealer1: number | null;
    dealer10: number | null;
  } | null,
): B2bPackOffer[] {
  const base = plan === "business" ? B2B_BUSINESS_PACKS : B2B_DEALER_PACKS;
  if (!prices) return [...base];
  if (plan === "business") {
    return [
      { qty: 1, unitCents: prices.business1 ?? base[0]!.unitCents },
      { qty: 10, unitCents: prices.business10 ?? base[1]!.unitCents },
    ];
  }
  return [
    { qty: 1, unitCents: prices.dealer1 ?? base[0]!.unitCents },
    { qty: 10, unitCents: prices.dealer10 ?? base[1]!.unitCents },
  ];
}

export function isB2bPartnerCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}
