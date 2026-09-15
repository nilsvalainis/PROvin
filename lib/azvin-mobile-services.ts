import {
  TP5_DEALER_BRANDS,
  TP5_DEALER_BRAND_ROWS,
  type Tp5MobileFeature,
} from "@/lib/test-pricing-5-mobile";
import type { AzvinLocale } from "@/lib/azvin-hero-copy";

export type AzvinServiceId = "korea" | "europe" | "usa" | "dealer";

export type AzvinMobileFeature = Tp5MobileFeature;

export type AzvinMobileService = {
  id: AzvinServiceId;
  title: string;
  /** Compact tab label in the 4-column switcher. */
  tabTitle?: string;
  price: string;
  priceAzn: number;
  buttonText: string;
  description: string;
  features: AzvinMobileFeature[];
  /** Dealer highlight uses Globe + brands grid (PROVIN 1:1). */
  layout: "checklist" | "dealer";
  brands?: readonly string[];
  turnaround?: string;
  /** Asterisk footnote under checklist (e.g. CarVertical*, AutoDNA*). */
  extraNote?: string;
  /** Show refund banner above CTA. */
  showRefundBanner?: boolean;
  /** Optional refund banner override (else shared dealer refund copy). */
  refundBanner?: string;
};

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
  { name: "Korea history report", included: true },
  { name: "Odometer and mileage records", included: true },
  { name: "Korean auction portal archive", included: true },
  { name: "Damage, accident and salvage records", included: true },
  { name: "Title, theft and lien status check", included: true },
  { name: "Consultation", included: true },
];

const KOREA_FEATURES_AZ: AzvinMobileFeature[] = [
  { name: "Koreya tarix hesabatı", included: true },
  { name: "Odometr və yürüş qeydləri", included: true },
  { name: "Koreya hərrac portalı arxivi", included: true },
  { name: "Zədələnmə, qəza və salvage qeydləri", included: true },
  { name: "Title, oğurluq və girov statusu yoxlaması", included: true },
  { name: "Konsultasiya", included: true },
];

const KOREA_FEATURES_RU: AzvinMobileFeature[] = [
  { name: "Отчёт истории Кореи", included: true },
  { name: "Записи одометра и пробега", included: true },
  { name: "Архив корейских аукционов", included: true },
  { name: "Повреждения, аварии и salvage-записи", included: true },
  { name: "Проверка title, угона и обременений", included: true },
  { name: "Консультация", included: true },
];

const KOREA_FEATURES_LV: AzvinMobileFeature[] = [
  { name: "Korejas vēstures atskaite", included: true },
  { name: "Nobraukuma un odometra ieraksti", included: true },
  { name: "Korejas izsoļu portālu arhīvs", included: true },
  { name: "Bojājumu, avāriju un salvage ieraksti", included: true },
  { name: "Title, zādzību un apgrūtinājumu pārbaude", included: true },
  { name: "Konsultācija", included: true },
];

const USA_FEATURES_EN: AzvinMobileFeature[] = [
  { name: "USA history report", included: true },
  { name: "Odometer and mileage records", included: true },
  { name: "Auction portal archive (Copart, IAAI, etc.)", included: true },
  { name: "Damage, accident and salvage records", included: true },
  { name: "Title, theft and lien status check", included: true },
  { name: "Consultation", included: true },
];

const USA_FEATURES_AZ: AzvinMobileFeature[] = [
  { name: "ABŞ tarix hesabatı", included: true },
  { name: "Odometr və yürüş qeydləri", included: true },
  { name: "Hərrac portalı arxivi (Copart, IAAI və s.)", included: true },
  { name: "Zədələnmə, qəza və salvage qeydləri", included: true },
  { name: "Title, oğurluq və girov statusu yoxlaması", included: true },
  { name: "Konsultasiya", included: true },
];

const USA_FEATURES_RU: AzvinMobileFeature[] = [
  { name: "Отчёт истории США", included: true },
  { name: "Записи одометра и пробега", included: true },
  { name: "Архив аукционов (Copart, IAAI и др.)", included: true },
  { name: "Повреждения, аварии и salvage-записи", included: true },
  { name: "Проверка title, угона и обременений", included: true },
  { name: "Консультация", included: true },
];

const USA_FEATURES_LV: AzvinMobileFeature[] = [
  { name: "ASV vēstures atskaite", included: true },
  { name: "Nobraukuma un odometra ieraksti", included: true },
  { name: "Izsoļu portālu arhīvs (Copart, IAAI u.c.)", included: true },
  { name: "Bojājumu, avāriju un salvage ieraksti", included: true },
  { name: "Title, zādzību un apgrūtinājumu pārbaude", included: true },
  { name: "Konsultācija", included: true },
];

const KOREA_REFUND_EN =
  "100% refund guarantee: If no data is available in Korean databases, we will issue a full refund.";

const KOREA_REFUND_AZ =
  "100% pulun qaytarılması zəmanəti: Koreya bazalarında məlumat yoxdursa, tam geri ödəniş edəcəyik.";

const KOREA_REFUND_RU =
  "100% гарантия возврата: если данных нет в базах Кореи, сделаем полный возврат.";

const KOREA_REFUND_LV =
  "100% Naudas atmaksas garantija: Ja Korejas datubāzēs dati nav pieejami, veiksim pilnu atmaksu.";

const USA_REFUND_EN =
  "100% refund guarantee: If no data is available in USA databases, we will issue a full refund.";

const USA_REFUND_AZ =
  "100% pulun qaytarılması zəmanəti: ABŞ bazalarında məlumat yoxdursa, tam geri ödəniş edəcəyik.";

const USA_REFUND_RU =
  "100% гарантия возврата: если данных нет в базах США, сделаем полный возврат.";

const USA_REFUND_LV =
  "100% Naudas atmaksas garantija: Ja ASV datubāzēs dati nav pieejami, veiksim pilnu atmaksu.";

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
  const packs: Record<AzvinLocale, AzvinMobileService[]> = {
    en: [
      {
        id: "korea",
        title: "KOREA",
        tabTitle: "KOREA",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ORDER KOREA 19 AZN",
        description: "Full vehicle check package for cars used in Korea.",
        features: KOREA_FEATURES_EN,
        layout: "checklist",
        turnaround: "⏱️ Delivery: 24h",
        showRefundBanner: true,
        refundBanner: KOREA_REFUND_EN,
      },
      {
        id: "europe",
        title: "EUROPE",
        tabTitle: "EUROPE",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "ORDER EUROPE 149 AZN",
        description: "Full vehicle check package for cars used in Europe.",
        features: EUROPE_FEATURES_EN,
        layout: "checklist",
        turnaround: "⏱️ Delivery: 24h",
        extraNote: EUROPE_NOTE_EN,
        showRefundBanner: true,
      },
      {
        id: "usa",
        title: "AMERICA",
        tabTitle: "AMERICA",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ORDER AMERICA 19 AZN",
        description: "Full vehicle check package for cars used in the USA.",
        features: USA_FEATURES_EN,
        layout: "checklist",
        turnaround: "⏱️ Delivery: 24h",
        showRefundBanner: true,
        refundBanner: USA_REFUND_EN,
      },
      {
        id: "dealer",
        title: "DEALER DATA",
        tabTitle: "DEALER DATA",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "ORDER DEALER DATA 49 AZN",
        description: "",
        features: DEALER_FEATURES_EN,
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Delivery: 24-48h",
        showRefundBanner: true,
      },
    ],
    ru: [
      {
        id: "korea",
        title: "КОРЕЯ",
        tabTitle: "КОРЕЯ",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ЗАКАЗАТЬ КОРЕЮ 19 AZN",
        description: "Полный пакет проверки авто, эксплуатируемых в Корее.",
        features: KOREA_FEATURES_RU,
        layout: "checklist",
        turnaround: "⏱️ Срок: 24ч",
        showRefundBanner: true,
        refundBanner: KOREA_REFUND_RU,
      },
      {
        id: "europe",
        title: "ЕВРОПА",
        tabTitle: "ЕВРОПА",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "ЗАКАЗАТЬ ЕВРОПУ 149 AZN",
        description: "Полный пакет проверки авто, эксплуатируемых в Европе.",
        features: EUROPE_FEATURES_RU,
        layout: "checklist",
        turnaround: "⏱️ Срок: 24ч",
        extraNote: EUROPE_NOTE_RU,
        showRefundBanner: true,
      },
      {
        id: "usa",
        title: "АМЕРИКА",
        tabTitle: "АМЕРИКА",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "ЗАКАЗАТЬ АМЕРИКУ 19 AZN",
        description: "Полный пакет проверки авто, эксплуатируемых в США.",
        features: USA_FEATURES_RU,
        layout: "checklist",
        turnaround: "⏱️ Срок: 24ч",
        showRefundBanner: true,
        refundBanner: USA_REFUND_RU,
      },
      {
        id: "dealer",
        title: "ДАННЫЕ ДИЛЕРА",
        tabTitle: "ДАННЫЕ ДИЛЕРА",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "ЗАКАЗАТЬ ДАННЫЕ ДИЛЕРА 49 AZN",
        description: "",
        features: DEALER_FEATURES_RU,
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Срок: 24-48ч",
        showRefundBanner: true,
      },
    ],
    lv: [
      {
        id: "korea",
        title: "KOREJA",
        tabTitle: "KOREJA",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "PASŪTĪT KOREJU 19 AZN",
        description: "Pilns auto pārbaudes komplekts Korejā lietotiem auto.",
        features: KOREA_FEATURES_LV,
        layout: "checklist",
        turnaround: "⏱️ Izpilde: 24h",
        showRefundBanner: true,
        refundBanner: KOREA_REFUND_LV,
      },
      {
        id: "europe",
        title: "EIROPA",
        tabTitle: "EIROPA",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "PASŪTĪT EIROPAS PAKETI 149 AZN",
        description: "Pilns auto pārbaudes komplekts Eiropā lietotiem auto.",
        features: EUROPE_FEATURES_LV,
        layout: "checklist",
        turnaround: "⏱️ Izpilde: 24h",
        extraNote: EUROPE_NOTE_LV,
        showRefundBanner: true,
      },
      {
        id: "usa",
        title: "AMERIKA",
        tabTitle: "AMERIKA",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "PASŪTĪT AMERIKU 19 AZN",
        description: "Pilns auto pārbaudes komplekts ASV lietotiem auto.",
        features: USA_FEATURES_LV,
        layout: "checklist",
        turnaround: "⏱️ Izpilde: 24h",
        showRefundBanner: true,
        refundBanner: USA_REFUND_LV,
      },
      {
        id: "dealer",
        title: "DĪLERA DATI",
        tabTitle: "DĪLERA DATI",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "PASŪTĪT DĪLERA DATUS 49 AZN",
        description: "",
        features: DEALER_FEATURES_LV,
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Izpilde: 24-48h",
        showRefundBanner: true,
      },
    ],
    az: [
      {
        id: "korea",
        title: "KOREYA",
        tabTitle: "KOREYA",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "SİFARİŞ KOREYA 19 AZN",
        description: "Koreyada istifadə olunan avtomobillər üçün tam yoxlama paketi.",
        features: KOREA_FEATURES_AZ,
        layout: "checklist",
        turnaround: "⏱️ Çatdırılma: 24 saat",
        showRefundBanner: true,
        refundBanner: KOREA_REFUND_AZ,
      },
      {
        id: "europe",
        title: "AVROPA",
        tabTitle: "AVROPA",
        price: "149 AZN",
        priceAzn: 149,
        buttonText: "SİFARİŞ AVROPA 149 AZN",
        description: "Avropada istifadə olunan avtomobillər üçün tam yoxlama paketi.",
        features: EUROPE_FEATURES_AZ,
        layout: "checklist",
        turnaround: "⏱️ Çatdırılma: 24 saat",
        extraNote: EUROPE_NOTE_AZ,
        showRefundBanner: true,
      },
      {
        id: "usa",
        title: "AMERİKA",
        tabTitle: "AMERİKA",
        price: "19 AZN",
        priceAzn: 19,
        buttonText: "SİFARİŞ AMERİKA 19 AZN",
        description: "ABŞ-da istifadə olunan avtomobillər üçün tam yoxlama paketi.",
        features: USA_FEATURES_AZ,
        layout: "checklist",
        turnaround: "⏱️ Çatdırılma: 24 saat",
        showRefundBanner: true,
        refundBanner: USA_REFUND_AZ,
      },
      {
        id: "dealer",
        title: "DİLER MƏLUMATI",
        tabTitle: "DİLER MƏLUMATI",
        price: "49 AZN",
        priceAzn: 49,
        buttonText: "SİFARİŞ DİLER MƏLUMATI 49 AZN",
        description: "",
        features: DEALER_FEATURES_AZ,
        layout: "dealer",
        brands: TP5_DEALER_BRANDS,
        turnaround: "⏱️ Çatdırılma: 24-48 saat",
        showRefundBanner: true,
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
