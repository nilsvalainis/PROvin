import {
  TP5_DEALER_BRANDS,
  TP5_DEALER_BRAND_ROWS,
  type Tp5MobileFeature,
} from "@/lib/test-pricing-5-mobile";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import { getAzvinUiCopy } from "@/lib/azvin-ui-copy";

export type AzvinServiceId = "korea" | "europe" | "usa" | "dealer";

export type AzvinMobileFeature = Tp5MobileFeature & {
  /** Tooltip behind the inline “i” (CarVertical / AutoDNA EU substitution note). */
  infoTip?: string;
};

export type AzvinMobileService = {
  id: AzvinServiceId;
  title: string;
  /** Compact tab label in the 4-column switcher. */
  tabTitle?: string;
  /** Card heading under the tabs (PROVIN dealer `cardTitle` pattern). */
  cardTitle: string;
  price: string;
  priceAzn: number;
  buttonText: string;
  description: string;
  features: AzvinMobileFeature[];
  layout: "checklist" | "dealer";
  brands?: readonly string[];
  turnaround?: string;
};

export const AZVIN_FEATURE_ROW_COUNT = 5;

/** Tab order: Korea / Europe / America / Dealer. */
export const AZVIN_SERVICE_ORDER: AzvinServiceId[] = ["korea", "europe", "usa", "dealer"];

export const AZVIN_DEFAULT_SERVICE_ID: AzvinServiceId = "korea";

export const AZVIN_SERVICE_PRICES_AZN: Record<AzvinServiceId, number> = {
  korea: 19,
  europe: 149,
  usa: 19,
  dealer: 49,
};

export { TP5_DEALER_BRAND_ROWS as AZVIN_DEALER_BRAND_ROWS, TP5_DEALER_BRANDS as AZVIN_TP5_DEALER_BRANDS };

const DEALER_FEATURES_EN: AzvinMobileFeature[] = [
  { name: "Service and maintenance history*", included: true },
  { name: "Odometer readings", included: true },
  { name: "Summary", included: true },
  { name: "Supported manufacturers", included: true, tone: "brands" },
];

const DEALER_FEATURES_LV: AzvinMobileFeature[] = [
  { name: "Servisa un apkopju vēsture*", included: true },
  { name: "Odometra rādījumi", included: true },
  { name: "Kopsavilkums", included: true },
  { name: "Atbalstītie ražotāji", included: true, tone: "brands" },
];

const DEALER_FEATURES_AZ: AzvinMobileFeature[] = [
  { name: "Servis və baxım tarixi*", included: true },
  { name: "Odometr göstəriciləri", included: true },
  { name: "Xülasə", included: true },
  { name: "Dəstəklənən istehsalçılar", included: true, tone: "brands" },
];

const DEALER_FEATURES_RU: AzvinMobileFeature[] = [
  { name: "История сервиса и ТО*", included: true },
  { name: "Показания одометра", included: true },
  { name: "Резюме", included: true },
  { name: "Поддерживаемые производители", included: true, tone: "brands" },
];

const KOREA_FEATURES_EN: AzvinMobileFeature[] = [
  { name: "Korea history report", included: true },
  { name: "Odometer and mileage records", included: true },
  { name: "Korean auction portal archive", included: true },
  { name: "Damage, salvage and title check", included: true },
];

const KOREA_FEATURES_AZ: AzvinMobileFeature[] = [
  { name: "Koreya tarix hesabatı", included: true },
  { name: "Odometr və yürüş qeydləri", included: true },
  { name: "Koreya hərrac portalı arxivi", included: true },
  { name: "Zədələnmə, salvage və title yoxlaması", included: true },
];

const KOREA_FEATURES_RU: AzvinMobileFeature[] = [
  { name: "Отчёт истории Кореи", included: true },
  { name: "Записи одометра и пробега", included: true },
  { name: "Архив корейских аукционов", included: true },
  { name: "Проверка повреждений, salvage и title", included: true },
];

const KOREA_FEATURES_LV: AzvinMobileFeature[] = [
  { name: "Korejas vēstures atskaite", included: true },
  { name: "Nobraukuma un odometra ieraksti", included: true },
  { name: "Korejas izsoļu portālu arhīvs", included: true },
  { name: "Bojājumu, salvage un title pārbaude", included: true },
];

const USA_FEATURES_EN: AzvinMobileFeature[] = [
  { name: "USA history report", included: true },
  { name: "Odometer and mileage records", included: true },
  { name: "Auction archive (Copart, IAAI, etc.)", included: true },
  { name: "Damage, salvage and title check", included: true },
];

const USA_FEATURES_AZ: AzvinMobileFeature[] = [
  { name: "ABŞ tarix hesabatı", included: true },
  { name: "Odometr və yürüş qeydləri", included: true },
  { name: "Hərrac arxivi (Copart, IAAI və s.)", included: true },
  { name: "Zədələnmə, salvage və title yoxlaması", included: true },
];

const USA_FEATURES_RU: AzvinMobileFeature[] = [
  { name: "Отчёт истории США", included: true },
  { name: "Записи одометра и пробега", included: true },
  { name: "Архив аукционов (Copart, IAAI и др.)", included: true },
  { name: "Проверка повреждений, salvage и title", included: true },
];

const USA_FEATURES_LV: AzvinMobileFeature[] = [
  { name: "ASV vēstures atskaite", included: true },
  { name: "Nobraukuma un odometra ieraksti", included: true },
  { name: "Izsoļu arhīvs (Copart, IAAI u.c.)", included: true },
  { name: "Bojājumu, salvage un title pārbaude", included: true },
];

const KOREA_REFUND_EN =
  "If no data is available in Korean databases, we will issue a full refund.";

const KOREA_REFUND_AZ =
  "Koreya bazalarında məlumat yoxdursa, tam geri ödəniş edəcəyik.";

const KOREA_REFUND_RU =
  "Если данных нет в базах Кореи, сделаем полный возврат.";

const KOREA_REFUND_LV =
  "Ja Korejas datubāzēs dati nav pieejami, veiksim pilnu atmaksu.";

const USA_REFUND_EN =
  "If no data is available in USA databases, we will issue a full refund.";

const USA_REFUND_AZ =
  "ABŞ bazalarında məlumat yoxdursa, tam geri ödəniş edəcəyik.";

const USA_REFUND_RU =
  "Если данных нет в базах США, сделаем полный возврат.";

const USA_REFUND_LV =
  "Ja ASV datubāzēs dati nav pieejami, veiksim pilnu atmaksu.";

const EUROPE_FEATURES_EN: AzvinMobileFeature[] = [
  { name: "CarVertical history report", included: true },
  { name: "AutoDNA history report", included: true },
  { name: "European registry check", included: true },
  { name: "Auction portal archive data", included: true },
  { name: "Official dealer data", included: true },
];

const EUROPE_FEATURES_AZ: AzvinMobileFeature[] = [
  { name: "CarVertical tarix hesabatı", included: true },
  { name: "AutoDNA tarix hesabatı", included: true },
  { name: "Avropa reyestr yoxlaması", included: true },
  { name: "Hərrac portalı arxiv məlumatları", included: true },
  { name: "Rəsmi diler məlumatları", included: true },
];

const EUROPE_FEATURES_RU: AzvinMobileFeature[] = [
  { name: "Отчёт истории CarVertical", included: true },
  { name: "Отчёт истории AutoDNA", included: true },
  { name: "Проверка европейских реестров", included: true },
  { name: "Архивные данные аукционов", included: true },
  { name: "Официальные данные дилера", included: true },
];

const EUROPE_FEATURES_LV: AzvinMobileFeature[] = [
  { name: "CarVertical vēstures atskaite", included: true },
  { name: "AutoDNA vēstures atskaite", included: true },
  { name: "Eiropas reģistru pārbaude", included: true },
  { name: "Izsoļu portālu arhīva dati", included: true },
  { name: "Oficiālā dīlera dati", included: true },
];

const EUROPE_NOTE_EN =
  "To provide the most relevant data for a given EU region, a report may be replaced with another specialised paid report.";

const EUROPE_NOTE_AZ =
  "Müəyyən EU regionu üçün ən uyğun məlumatı təmin etmək üçün hesabat digər ixtisaslaşmış pullu hesabatla əvəz oluna bilər.";

const EUROPE_NOTE_RU =
  "Чтобы обеспечить наиболее релевантные данные для конкретного региона ЕС, отчёт может быть заменён другим специализированным платным отчётом.";

const EUROPE_NOTE_LV =
  "Lai nodrošinātu konkrētajam EU reģionam atbilstošākos datus, atskaite var tikt aizstāta ar citu specializētu maksas atskaiti.";

function withEuropeVendorNotes(features: AzvinMobileFeature[], note: string): AzvinMobileFeature[] {
  return features.map((feature, index) => (index < 2 ? { ...feature, infoTip: note } : feature));
}

function withGuaranteeRow(
  features: AzvinMobileFeature[],
  locale: AzvinLocale,
  infoBody: string,
): AzvinMobileFeature[] {
  return [
    ...features,
    {
      name: getAzvinUiCopy(locale).dealerRefundBanner,
      included: true,
      tone: "guarantee",
      infoTip: infoBody,
    },
  ];
}

function buildServices(locale: AzvinLocale): AzvinMobileService[] {
  const packs: Record<AzvinLocale, AzvinMobileService[]> = {
    en: [
      {
        id: "korea",
        title: "KOREA",
        tabTitle: "KOREA",
        cardTitle: "KOREA HISTORY",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ORDER KOREA 19 AZN",
        description: "Full vehicle check package for cars used in Korea.",
        features: withGuaranteeRow(KOREA_FEATURES_EN, "en", KOREA_REFUND_EN),
        layout: "checklist",
        turnaround: "⏱️ Delivery: 24h",
      },
      {
        id: "europe",
        title: "EUROPE",
        tabTitle: "EUROPE",
        cardTitle: "EUROPE HISTORY",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "ORDER EUROPE 149 AZN",
        description: "Full vehicle check package for cars used in Europe.",
        features: withEuropeVendorNotes(EUROPE_FEATURES_EN, EUROPE_NOTE_EN),
        layout: "checklist",
        turnaround: "⏱️ Delivery: 24h",
      },
      {
        id: "usa",
        title: "AMERICA",
        tabTitle: "AMERICA",
        cardTitle: "AMERICA HISTORY",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ORDER AMERICA 19 AZN",
        description: "Full vehicle check package for cars used in the USA.",
        features: withGuaranteeRow(USA_FEATURES_EN, "en", USA_REFUND_EN),
        layout: "checklist",
        turnaround: "⏱️ Delivery: 24h",
      },
      {
        id: "dealer",
        title: "DEALER DATA",
        tabTitle: "DEALER DATA",
        cardTitle: "OFFICIAL DEALER DATA",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "ORDER DEALER DATA 49 AZN",
        description: "Official manufacturer service records and mileage.",
        features: withGuaranteeRow(DEALER_FEATURES_EN, "en", getAzvinUiCopy("en").dealerRefundInfoBody),
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Delivery: 24-48h",
      },
    ],
    ru: [
      {
        id: "korea",
        title: "КОРЕЯ",
        tabTitle: "КОРЕЯ",
        cardTitle: "ИСТОРИЯ КОРЕИ",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ЗАКАЗАТЬ КОРЕЮ 19 AZN",
        description: "Полный пакет проверки авто, эксплуатируемых в Корее.",
        features: withGuaranteeRow(KOREA_FEATURES_RU, "ru", KOREA_REFUND_RU),
        layout: "checklist",
        turnaround: "⏱️ Срок: 24ч",
      },
      {
        id: "europe",
        title: "ЕВРОПА",
        tabTitle: "ЕВРОПА",
        cardTitle: "ИСТОРИЯ ЕВРОПЫ",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "ЗАКАЗАТЬ ЕВРОПУ 149 AZN",
        description: "Полный пакет проверки авто, эксплуатируемых в Европе.",
        features: withEuropeVendorNotes(EUROPE_FEATURES_RU, EUROPE_NOTE_RU),
        layout: "checklist",
        turnaround: "⏱️ Срок: 24ч",
      },
      {
        id: "usa",
        title: "АМЕРИКА",
        tabTitle: "АМЕРИКА",
        cardTitle: "ИСТОРИЯ АМЕРИКИ",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ЗАКАЗАТЬ АМЕРИКУ 19 AZN",
        description: "Полный пакет проверки авто, эксплуатируемых в США.",
        features: withGuaranteeRow(USA_FEATURES_RU, "ru", USA_REFUND_RU),
        layout: "checklist",
        turnaround: "⏱️ Срок: 24ч",
      },
      {
        id: "dealer",
        title: "ДАННЫЕ ДИЛЕРА",
        tabTitle: "ДАННЫЕ ДИЛЕРА",
        cardTitle: "ОФИЦИАЛЬНЫЕ ДАННЫЕ ДИЛЕРА",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "ЗАКАЗАТЬ ДАННЫЕ ДИЛЕРА 49 AZN",
        description: "Официальные записи сервиса производителя и пробег.",
        features: withGuaranteeRow(DEALER_FEATURES_RU, "ru", getAzvinUiCopy("ru").dealerRefundInfoBody),
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Срок: 24-48ч",
      },
    ],
    lv: [
      {
        id: "korea",
        title: "KOREJA",
        tabTitle: "KOREJA",
        cardTitle: "KOREJAS VĒSTURE",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "PASŪTĪT KOREJU 19 AZN",
        description: "Pilns auto pārbaudes komplekts Korejā lietotiem auto.",
        features: withGuaranteeRow(KOREA_FEATURES_LV, "lv", KOREA_REFUND_LV),
        layout: "checklist",
        turnaround: "⏱️ Izpilde: 24h",
      },
      {
        id: "europe",
        title: "EIROPA",
        tabTitle: "EIROPA",
        cardTitle: "EIROPAS VĒSTURE",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "PASŪTĪT EIROPAS PAKETI 149 AZN",
        description: "Pilns auto pārbaudes komplekts Eiropā lietotiem auto.",
        features: withEuropeVendorNotes(EUROPE_FEATURES_LV, EUROPE_NOTE_LV),
        layout: "checklist",
        turnaround: "⏱️ Izpilde: 24h",
      },
      {
        id: "usa",
        title: "AMERIKA",
        tabTitle: "AMERIKA",
        cardTitle: "AMERIKAS VĒSTURE",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "PASŪTĪT AMERIKU 19 AZN",
        description: "Pilns auto pārbaudes komplekts ASV lietotiem auto.",
        features: withGuaranteeRow(USA_FEATURES_LV, "lv", USA_REFUND_LV),
        layout: "checklist",
        turnaround: "⏱️ Izpilde: 24h",
      },
      {
        id: "dealer",
        title: "DĪLERA DATI",
        tabTitle: "DĪLERA DATI",
        cardTitle: "OFICIĀLO DĪLERU DATI",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "PASŪTĪT DĪLERA DATUS 49 AZN",
        description: "Oficiālie ražotāja servisa ieraksti un nobraukums.",
        features: withGuaranteeRow(DEALER_FEATURES_LV, "lv", getAzvinUiCopy("lv").dealerRefundInfoBody),
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Izpilde: 24-48h",
      },
    ],
    az: [
      {
        id: "korea",
        title: "KOREYA",
        tabTitle: "KOREYA",
        cardTitle: "KOREYA TARİXİ",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "SİFARİŞ KOREYA 19 AZN",
        description: "Koreyada istifadə olunan avtomobillər üçün tam yoxlama paketi.",
        features: withGuaranteeRow(KOREA_FEATURES_AZ, "az", KOREA_REFUND_AZ),
        layout: "checklist",
        turnaround: "⏱️ Çatdırılma: 24 saat",
      },
      {
        id: "europe",
        title: "AVROPA",
        tabTitle: "AVROPA",
        cardTitle: "AVROPA TARİXİ",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "SİFARİŞ AVROPA 149 AZN",
        description: "Avropada istifadə olunan avtomobillər üçün tam yoxlama paketi.",
        features: withEuropeVendorNotes(EUROPE_FEATURES_AZ, EUROPE_NOTE_AZ),
        layout: "checklist",
        turnaround: "⏱️ Çatdırılma: 24 saat",
      },
      {
        id: "usa",
        title: "AMERİKA",
        tabTitle: "AMERİKA",
        cardTitle: "AMERİKA TARİXİ",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "SİFARİŞ AMERİKA 19 AZN",
        description: "ABŞ-da istifadə olunan avtomobillər üçün tam yoxlama paketi.",
        features: withGuaranteeRow(USA_FEATURES_AZ, "az", USA_REFUND_AZ),
        layout: "checklist",
        turnaround: "⏱️ Çatdırılma: 24 saat",
      },
      {
        id: "dealer",
        title: "DİLER MƏLUMATI",
        tabTitle: "DİLER MƏLUMATI",
        cardTitle: "RƏSMİ DİLER MƏLUMATLARI",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "SİFARİŞ DİLER MƏLUMATI 49 AZN",
        description: "Rəsmi istehsalçı servis qeydləri və yürüş.",
        features: withGuaranteeRow(DEALER_FEATURES_AZ, "az", getAzvinUiCopy("az").dealerRefundInfoBody),
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Çatdırılma: 24-48 saat",
      },
    ],
  };

  const byId = new Map(packs[locale].map((service) => [service.id, service]));
  return AZVIN_SERVICE_ORDER.map((id) => {
    const service = byId.get(id);
    if (!service) throw new Error(`Missing AZ.VIN service: ${id}`);
    return service;
  });
}

export function getAzvinMobileServices(locale: AzvinLocale): AzvinMobileService[] {
  return buildServices(locale);
}

export function getAzvinMobileService(
  id: AzvinServiceId,
  locale: AzvinLocale,
): AzvinMobileService {
  const service = getAzvinMobileServices(locale).find((entry) => entry.id === id);
  if (!service) {
    throw new Error(`Unknown AZ.VIN service: ${id}`);
  }
  return service;
}
