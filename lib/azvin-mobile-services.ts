import {
  TP5_DEALER_BRANDS,
  TP5_DEALER_BRAND_ROWS,
  type Tp5MobileFeature,
} from "@/lib/test-pricing-5-mobile";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";

export type AzvinServiceId = "europe" | "koreaUsa" | "dealer";

export type AzvinMobileFeature = Tp5MobileFeature;

export type AzvinMobileService = {
  id: AzvinServiceId;
  title: string;
  price: string;
  priceAzn: number;
  buttonText: string;
  description: string;
  features: AzvinMobileFeature[];
  /** Dealer highlight uses Globe + brands grid (PROVIN 1:1). */
  layout: "checklist" | "koreaHighlight" | "dealer";
  brands?: readonly string[];
  turnaround?: string;
  /** Asterisk footnote under checklist (e.g. CarVertical*/AutoDNA*). */
  extraNote?: string;
  /** Show the 100% dealer-data refund banner above CTA. */
  showRefundBanner?: boolean;
};

/** Tab order: left EUROPE PRO · center Korea & USA (default) · right Dealer. */
export const AZVIN_SERVICE_ORDER: AzvinServiceId[] = ["europe", "koreaUsa", "dealer"];

export const AZVIN_DEFAULT_SERVICE_ID: AzvinServiceId = "koreaUsa";

export const AZVIN_SERVICE_PRICES_AZN: Record<AzvinServiceId, number> = {
  europe: 149,
  koreaUsa: 19,
  dealer: 49,
};

export { TP5_DEALER_BRAND_ROWS as AZVIN_DEALER_BRAND_ROWS, TP5_DEALER_BRANDS as AZVIN_TP5_DEALER_BRANDS };

const DEALER_FEATURES_EN: AzvinMobileFeature[] = [
  {
    name: "Dealer service history and mileage",
    subtitle: "Direct access to official manufacturer service records.",
    included: true,
  },
];

const DEALER_FEATURES_LV: AzvinMobileFeature[] = [
  {
    name: "Dīleru servisa vēsture un nobraukums",
    subtitle: "Tiešā piekļuve oficiālajiem ražotāja apkopju ierakstiem.",
    included: true,
  },
];

const DEALER_FEATURES_AZ: AzvinMobileFeature[] = [
  {
    name: "Diler servis tarixi və yürüş",
    subtitle: "Rəsmi istehsalçı servis qeydlərinə birbaşa çıxış.",
    included: true,
  },
];

const DEALER_FEATURES_RU: AzvinMobileFeature[] = [
  {
    name: "Сервисная история дилера и пробег",
    subtitle: "Прямой доступ к официальным записям производителя.",
    included: true,
  },
];

const KOREA_FEATURES_EN: AzvinMobileFeature[] = [
  {
    name: "Korea & USA history",
    subtitle: "Auction · mileage · legal status",
    included: true,
  },
];

const KOREA_FEATURES_AZ: AzvinMobileFeature[] = [
  {
    name: "Koreya və ABŞ tarixi",
    subtitle: "Hərrac · yürüş · hüquqi status",
    included: true,
  },
];

const KOREA_FEATURES_RU: AzvinMobileFeature[] = [
  {
    name: "История Корея и США",
    subtitle: "Аукцион · пробег · правовой статус",
    included: true,
  },
];

const KOREA_FEATURES_LV: AzvinMobileFeature[] = [
  {
    name: "Korejas un ASV vēsture",
    subtitle: "Izsoles · nobraukums · juridiskais statuss",
    included: true,
  },
];

const EUROPE_FEATURES_EN: AzvinMobileFeature[] = [
  { name: "CarVertical* history report", included: true },
  { name: "AutoDNA* history report", included: true },
  { name: "European registry check", included: true },
  { name: "Auction portal archive data", included: true },
  { name: "Official dealer data", included: true },
  { name: "Consultation", included: true },
];

const EUROPE_FEATURES_AZ: AzvinMobileFeature[] = [
  { name: "CarVertical* tarix hesabatı", included: true },
  { name: "AutoDNA* tarix hesabatı", included: true },
  { name: "Avropa reyestr yoxlaması", included: true },
  { name: "Hərrac portalı arxiv məlumatları", included: true },
  { name: "Rəsmi diler məlumatları", included: true },
  { name: "Konsultasiya", included: true },
];

const EUROPE_FEATURES_RU: AzvinMobileFeature[] = [
  { name: "Отчёт истории CarVertical*", included: true },
  { name: "Отчёт истории AutoDNA*", included: true },
  { name: "Проверка европейских реестров", included: true },
  { name: "Архивные данные аукционов", included: true },
  { name: "Официальные данные дилера", included: true },
  { name: "Консультация", included: true },
];

const EUROPE_FEATURES_LV: AzvinMobileFeature[] = [
  { name: "CarVertical* vēstures atskaite", included: true },
  { name: "AutoDNA* vēstures atskaite", included: true },
  { name: "Eiropas reģistru pārbaude", included: true },
  { name: "Izsoļu portālu arhīva dati", included: true },
  { name: "Oficiālā dīlera dati", included: true },
  { name: "Konsultācija", included: true },
];

const EUROPE_NOTE_EN =
  "*To provide the most relevant data for a given EU region, a report may be replaced with another specialised paid report.";

const EUROPE_NOTE_AZ =
  "*Müəyyən EU regionu üçün ən uyğun məlumatı təmin etmək üçün hesabat digər ixtisaslaşmış pullu hesabatla əvəz oluna bilər.";

const EUROPE_NOTE_RU =
  "*Чтобы обеспечить наиболее релевантные данные для конкретного региона ЕС, отчёт может быть заменён другим специализированным платным отчётом.";

const EUROPE_NOTE_LV =
  "*Lai nodrošinātu konkrētajam EU reģionam atbilstošākos datus, atskaite var tikt aizstāta ar citu specializētu maksas atskaiti.";

function buildServices(locale: AzvinLocale): AzvinMobileService[] {
  if (locale === "en") {
    return [
      {
        id: "europe",
        title: "EUROPE PRO",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "ORDER EUROPE PRO — 149 AZN",
        description: "Full vehicle check package for cars used in Europe.",
        features: EUROPE_FEATURES_EN,
        layout: "checklist",
        turnaround: "⏱️ Delivery: 24h",
        extraNote: EUROPE_NOTE_EN,
        showRefundBanner: true,
      },
      {
        id: "koreaUsa",
        title: "KOREA & USA",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ORDER KOREA & USA — 19 AZN",
        description: "",
        features: KOREA_FEATURES_EN,
        layout: "koreaHighlight",
        turnaround: "⏱️ Delivery: 24h",
      },
      {
        id: "dealer",
        title: "DEALER DATA",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "ORDER DEALER DATA — 49 AZN",
        description: "",
        features: DEALER_FEATURES_EN,
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Delivery: 24-48h",
        showRefundBanner: true,
      },
    ];
  }

  if (locale === "ru") {
    return [
      {
        id: "europe",
        title: "ЕВРОПА PRO",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "ЗАКАЗАТЬ ЕВРОПА PRO — 149 AZN",
        description: "Полный пакет проверки авто, эксплуатируемых в Европе.",
        features: EUROPE_FEATURES_RU,
        layout: "checklist",
        turnaround: "⏱️ Срок: 24ч",
        extraNote: EUROPE_NOTE_RU,
        showRefundBanner: true,
      },
      {
        id: "koreaUsa",
        title: "КОРЕЯ И США",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ЗАКАЗАТЬ КОРЕЯ И США — 19 AZN",
        description: "",
        features: KOREA_FEATURES_RU,
        layout: "koreaHighlight",
        turnaround: "⏱️ Срок: 24ч",
      },
      {
        id: "dealer",
        title: "ДАННЫЕ ДИЛЕРА",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "ЗАКАЗАТЬ ДАННЫЕ ДИЛЕРА — 49 AZN",
        description: "",
        features: DEALER_FEATURES_RU,
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Срок: 24-48ч",
        showRefundBanner: true,
      },
    ];
  }

  if (locale === "lv") {
    return [
      {
        id: "europe",
        title: "EIROPA PRO",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "PASŪTĪT EIROPA PRO — 149 AZN",
        description: "Pilns auto pārbaudes komplekts Eiropā lietotiem auto.",
        features: EUROPE_FEATURES_LV,
        layout: "checklist",
        turnaround: "⏱️ Izpilde: 24h",
        extraNote: EUROPE_NOTE_LV,
        showRefundBanner: true,
      },
      {
        id: "koreaUsa",
        title: "KOREJA UN ASV",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "PASŪTĪT KOREJA UN ASV — 19 AZN",
        description: "",
        features: KOREA_FEATURES_LV,
        layout: "koreaHighlight",
        turnaround: "⏱️ Izpilde: 24h",
      },
      {
        id: "dealer",
        title: "DĪLERA DATI",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "PASŪTĪT DĪLERA DATUS — 49 AZN",
        description: "",
        features: DEALER_FEATURES_LV,
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Izpilde: 24-48h",
        showRefundBanner: true,
      },
    ];
  }

  /* az (default) */
  return [
    {
      id: "europe",
      title: "AVROPA PRO",
      price: "149 AZN",
      priceAzn: 149,
      buttonText: "SİFARİŞ AVROPA PRO — 149 AZN",
      description: "Avropada istifadə olunan avtomobillər üçün tam yoxlama paketi.",
      features: EUROPE_FEATURES_AZ,
      layout: "checklist",
      turnaround: "⏱️ Çatdırılma: 24 saat",
      extraNote: EUROPE_NOTE_AZ,
      showRefundBanner: true,
    },
    {
      id: "koreaUsa",
      title: "KOREYA VƏ ABŞ",
      price: "19 AZN",
      priceAzn: 19,
      buttonText: "SİFARİŞ KOREYA VƏ ABŞ — 19 AZN",
      description: "",
      features: KOREA_FEATURES_AZ,
      layout: "koreaHighlight",
      turnaround: "⏱️ Çatdırılma: 24 saat",
    },
    {
      id: "dealer",
      title: "DİLER MƏLUMATI",
      price: "49 AZN",
      priceAzn: 49,
      buttonText: "SİFARİŞ DİLER MƏLUMATI — 49 AZN",
      description: "",
      features: DEALER_FEATURES_AZ,
      layout: "dealer",
      brands: TP5_DEALER_BRANDS,
      turnaround: "⏱️ Çatdırılma: 24-48 saat",
      showRefundBanner: true,
    },
  ];
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
