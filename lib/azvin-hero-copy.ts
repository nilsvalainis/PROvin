import { AZVIN_DEALER_BRANDS } from "@/lib/azvin-dealer-brands";

/** AZ.VIN / Azerbaijan market demo — 4 UI locales (az, en, ru, lv). */

export { AZVIN_DEALER_BRANDS };

export const AZVIN_LOCALES = ["az", "en", "ru", "lv"] as const;
export type AzvinLocale = (typeof AZVIN_LOCALES)[number];

/** Purchasable services. */
export const AZVIN_SERVICE_IDS = ["koreaUsa", "dealer", "europe"] as const;
export type AzvinServiceId = (typeof AZVIN_SERVICE_IDS)[number];

export const AZVIN_SERVICE_PRICES_AZN: Record<AzvinServiceId, number> = {
  koreaUsa: 15,
  dealer: 30,
  europe: 50,
};

export const AZVIN_SERVICE_ENABLED: Record<AzvinServiceId, boolean> = {
  koreaUsa: true,
  dealer: true,
  europe: true,
};

/** Marketing icon row (4 pillars) — separate from purchasable checkboxes. */
export const AZVIN_ICON_IDS = ["koreaUsa", "europe", "auction", "dealer"] as const;
export type AzvinIconId = (typeof AZVIN_ICON_IDS)[number];

export type AzvinHeroCopy = {
  brand: string;
  titlePrefix: string;
  titleAccent: string;
  cardTitle: string;
  cardDescription: string;
  demoBanner: string;
  servicesLabel: string;
  services: Record<
    AzvinServiceId,
    { name: string; hint: string; priceLabel: string; comingSoon?: string }
  >;
  icons: Record<AzvinIconId, string>;
  iconRowAria: string;
  vinPlaceholder: string;
  vinAria: string;
  ctaLabel: (totalAzn: number) => string;
  ctaSelectHint: string;
  ctaDemoNote: string;
  turnaround: string;
  footnote: string;
  dealerBrandsTrigger: string;
  dealerBrandsAria: string;
  dealerBrandsYearNote: string;
  dealerBrandsRefundNote: string;
  dealerBrandsClose: string;
  vinInvalid: string;
  langSwitcherAria: string;
};

const COPY_AZ: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Avtomobil tarixi ",
  titleAccent: "yoxlaması",
  cardTitle: "AZ.VIN hesabat",
  cardDescription: "Avropa, Koreya və ABŞ avtomobilləri üçün rəsmi diler, hərrac portalı və yürüş tarixi məlumatları.",
  demoBanner: "AZ.VIN · Azərbaycan demo",
  servicesLabel: "Xidmətləri seçin",
  services: {
    koreaUsa: {
      name: "Koreya və ABŞ tarixi",
      hint: "Hərrac · yürüş · hüquqi status",
      priceLabel: "15 AZN",
    },
    dealer: {
      name: "Rəsmi diler tarixi",
      hint: "İstehsalçı servis qeydləri",
      priceLabel: "30 AZN",
    },
    europe: {
      name: "Avropa tarixi",
      hint: "Reyestr · texniki baxış · risklər",
      priceLabel: "50 AZN",
    },
  },
  icons: {
    koreaUsa: "Koreya və ABŞ tarixi",
    europe: "Avropa tarixi",
    auction: "Hərrac portalı məlumatları",
    dealer: "Rəsmi diler məlumatları",
  },
  iconRowAria: "AZ.VIN xidmətləri",
  vinPlaceholder: "VIN kodunu daxil edin",
  vinAria: "VIN kodunu daxil edin",
  ctaLabel: (total) => `YOXLA — ${total} AZN`,
  ctaSelectHint: "Ən azı bir xidmət seçin.",
  ctaDemoNote: "Demo — ödəniş tezliklə.",
  turnaround: "Tipik çatdırılma: 24 saat",
  footnote: "Hesabat üçün məlumat yoxdursa — 14 günlük tam geri ödəniş zəmanəti. Əlavə suallar olmadan.",
  dealerBrandsTrigger: "Dəstəklənən istehsalçılar",
  dealerBrandsAria: "Dəstəklənən istehsalçılar",
  dealerBrandsYearNote:
    "Rəsmi diler məlumatları adətən 2009–2026-cı illərdə istehsal olunmuş avtomobillər üçün mövcuddur.",
  dealerBrandsRefundNote: "Hesabat üçün məlumat yoxdursa — 14 günlük tam geri ödəniş. Əlavə suallar olmadan.",
  dealerBrandsClose: "Bağla",
  vinInvalid: "Düzgün VIN daxil edin (11–17 simvol).",
  langSwitcherAria: "Dil",
};

const COPY_EN: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Vehicle history ",
  titleAccent: "check",
  cardTitle: "AZ.VIN report",
  cardDescription:
    "Official dealer, auction portal and mileage history data for cars from Europe, Korea and the USA.",
  demoBanner: "AZ.VIN · Azerbaijan demo",
  servicesLabel: "Select services",
  services: {
    koreaUsa: {
      name: "Korea & USA history",
      hint: "Auction · mileage · legal status",
      priceLabel: "15 AZN",
    },
    dealer: {
      name: "Official dealer history",
      hint: "Manufacturer service records",
      priceLabel: "30 AZN",
    },
    europe: {
      name: "Europe history",
      hint: "Registry · inspections · risks",
      priceLabel: "50 AZN",
    },
  },
  icons: {
    koreaUsa: "Korea & USA history",
    europe: "Europe history",
    auction: "Auction portal data",
    dealer: "Official dealer data",
  },
  iconRowAria: "AZ.VIN services",
  vinPlaceholder: "Enter VIN code",
  vinAria: "Enter VIN code",
  ctaLabel: (total) => `CHECK — ${total} AZN`,
  ctaSelectHint: "Select at least one service.",
  ctaDemoNote: "Demo only — checkout coming soon.",
  turnaround: "Typical delivery: 24h",
  footnote:
    "14-day full refund guarantee if data is not available for your report. No questions asked.",
  dealerBrandsTrigger: "Supported manufacturers",
  dealerBrandsAria: "Supported manufacturers",
  dealerBrandsYearNote:
    "Official dealer data is usually available for vehicles built 2009–2026.",
  dealerBrandsRefundNote:
    "14-day full refund if data is not available for your report. No questions asked.",
  dealerBrandsClose: "Close",
  vinInvalid: "Enter a valid VIN (11–17 characters).",
  langSwitcherAria: "Language",
};

const COPY_RU: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Проверка истории ",
  titleAccent: "авто",
  cardTitle: "Отчёт AZ.VIN",
  cardDescription: "Данные официальных дилеров, аукционов и пробега для авто из Европы, Кореи и США.",
  demoBanner: "AZ.VIN · Демо Азербайджан",
  servicesLabel: "Выберите услуги",
  services: {
    koreaUsa: {
      name: "История Корея и США",
      hint: "Аукцион · пробег · правовой статус",
      priceLabel: "15 AZN",
    },
    dealer: {
      name: "История официального дилера",
      hint: "Сервисные записи производителя",
      priceLabel: "30 AZN",
    },
    europe: {
      name: "История Европы",
      hint: "Реестры · техосмотр · риски",
      priceLabel: "50 AZN",
    },
  },
  icons: {
    koreaUsa: "История Корея и США",
    europe: "История Европы",
    auction: "Данные аукционов",
    dealer: "Данные официального дилера",
  },
  iconRowAria: "Услуги AZ.VIN",
  vinPlaceholder: "Введите VIN-код",
  vinAria: "Введите VIN-код",
  ctaLabel: (total) => `ПРОВЕРИТЬ — ${total} AZN`,
  ctaSelectHint: "Выберите хотя бы одну услугу.",
  ctaDemoNote: "Демо — оплата скоро.",
  turnaround: "Срок: 24ч",
  footnote:
    "14-дневная гарантия полного возврата, если данные по отчёту недоступны. Без лишних вопросов.",
  dealerBrandsTrigger: "Поддерживаемые производители",
  dealerBrandsAria: "Поддерживаемые производители",
  dealerBrandsYearNote:
    "Официальные данные дилера обычно доступны для авто 2009–2026 гг.",
  dealerBrandsRefundNote:
    "14-дневная гарантия полного возврата, если данные недоступны. Без лишних вопросов.",
  dealerBrandsClose: "Закрыть",
  vinInvalid: "Введите корректный VIN (11–17 символов).",
  langSwitcherAria: "Язык",
};

const COPY_LV: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Auto vēstures ",
  titleAccent: "pārbaude",
  cardTitle: "AZ.VIN atskaite",
  cardDescription:
    "Oficiālo dīleru, izsoļu portālu un nobraukuma vēstures dati automašīnām no Eiropas, Korejas un ASV.",
  demoBanner: "AZ.VIN · Azerbaidžānas demo",
  servicesLabel: "Izvēlies pakalpojumus",
  services: {
    koreaUsa: {
      name: "Korejas un ASV vēsture",
      hint: "Izsoles · nobraukums · juridiskais statuss",
      priceLabel: "15 AZN",
    },
    dealer: {
      name: "Oficiālā dīlera vēsture",
      hint: "Ražotāja servisa ieraksti",
      priceLabel: "30 AZN",
    },
    europe: {
      name: "Eiropas vēsture",
      hint: "Reģistri · TA · risku signāli",
      priceLabel: "50 AZN",
    },
  },
  icons: {
    koreaUsa: "Korejas un ASV vēsture",
    europe: "Eiropas vēsture",
    auction: "Izsoļu portālu dati",
    dealer: "Oficiālo dīleru dati",
  },
  iconRowAria: "AZ.VIN pakalpojumi",
  vinPlaceholder: "Ievadi VIN kodu",
  vinAria: "Ievadi VIN kodu",
  ctaLabel: (total) => `PĀRBAUDĪT — ${total} AZN`,
  ctaSelectHint: "Izvēlies vismaz vienu pakalpojumu.",
  ctaDemoNote: "Demo — apmaksa drīzumā.",
  turnaround: "Tipisks izpildes laiks: 24h",
  footnote:
    "14 dienu pilnas maksas atmaksas garantija, ja jūsu ziņojumam dati nav pieejami. Bez papildu jautājumiem.",
  dealerBrandsTrigger: "Atbalstītie ražotāji",
  dealerBrandsAria: "Atbalstītie ražotāji",
  dealerBrandsYearNote:
    "Oficiālie dīlera dati parasti pieejami automašīnām, kas ražotas no 2009.–2026. gadam.",
  dealerBrandsRefundNote:
    "14 dienu pilnas atmaksas garantija, ja dati nav pieejami. Bez papildu jautājumiem.",
  dealerBrandsClose: "Aizvērt",
  vinInvalid: "Ievadi derīgu VIN (11–17 rakstzīmes).",
  langSwitcherAria: "Valoda",
};

const COPY_BY_LOCALE: Record<AzvinLocale, AzvinHeroCopy> = {
  az: COPY_AZ,
  en: COPY_EN,
  ru: COPY_RU,
  lv: COPY_LV,
};

export function getAzvinHeroCopy(locale: AzvinLocale): AzvinHeroCopy {
  return COPY_BY_LOCALE[locale] ?? COPY_AZ;
}

export function sumAzvinSelectedAzn(selected: ReadonlySet<AzvinServiceId>): number {
  let total = 0;
  for (const id of selected) {
    if (!AZVIN_SERVICE_ENABLED[id]) continue;
    total += AZVIN_SERVICE_PRICES_AZN[id];
  }
  return total;
}
