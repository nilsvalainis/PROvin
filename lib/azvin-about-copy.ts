import type { AzvinLocale } from "@/lib/azvin-hero-copy";

export type { AzvinLocale };

export type AzvinAboutCopy = {
  sectionId: string;
  eyebrow: string;
  title: string;
  lead: string;
  directionsTitle: string;
  directions: readonly {
    id: string;
    title: string;
    body: string;
    accent?: string;
  }[];
  brandsTitle: string;
  brandsLead: string;
  ctaLabel: string;
  punchlineLead: string;
  punchlineAccent: string;
};

const ABOUT_EN: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "About us",
  title: "Who we are",
  lead:
    "AZ.VIN helps buyers check imported cars with official dealer records, auction archives and mileage history from Europe, Korea and the USA — clear data before you pay.",
  directionsTitle: "What we check",
  directions: [
    {
      id: "koreaUsa",
      title: "Korea & USA",
      body: "Auction, ownership, mileage and legal-status trails.",
    },
    {
      id: "dealer",
      title: "Official dealer",
      body: "Manufacturer / authorised service history for supported brands.",
    },
    {
      id: "europe",
      title: "Europe",
      body: "Registry, inspection and European history depth.",
      accent: "Coming next",
    },
  ],
  brandsTitle: "Dealer brands",
  brandsLead: "Official dealer history coverage (VIN / year dependent):",
  ctaLabel: "Check a vehicle",
  punchlineLead: "Check VIN.",
  punchlineAccent: "Don't be fooled.",
};

const ABOUT_AZ: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "Haqqımızda",
  title: "Biz kimik",
  lead:
    "AZ.VIN idxal avtomobilləri üçün rəsmi diler qeydləri, hərrac arxivləri və yürüş tarixini bir hesabatda birləşdirir — Avropa, Koreya və ABŞ.",
  directionsTitle: "Nə yoxlayırıq",
  directions: [
    {
      id: "koreaUsa",
      title: "Koreya və ABŞ",
      body: "Hərrac, sahiblik, yürüş və hüquqi status.",
    },
    {
      id: "dealer",
      title: "Rəsmi diler",
      body: "İstehsalçı / rəsmi şəbəkə servis tarixi.",
    },
    {
      id: "europe",
      title: "Avropa",
      body: "Reyestr, texniki baxış və Avropa tarixi.",
      accent: "Tezliklə",
    },
  ],
  brandsTitle: "Diler markaları",
  brandsLead: "Rəsmi diler tarixi (VIN / ildən asılıdır):",
  ctaLabel: "Avtomobili yoxla",
  punchlineLead: "VIN yoxla.",
  punchlineAccent: "Aldanma.",
};

const ABOUT_RU: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "О нас",
  title: "Кто мы",
  lead:
    "AZ.VIN помогает проверить импортное авто: официальный дилер, аукционы и пробег из Европы, Кореи и США — до покупки.",
  directionsTitle: "Что проверяем",
  directions: [
    {
      id: "koreaUsa",
      title: "Корея и США",
      body: "Аукционы, владельцы, пробег и правовой статус.",
    },
    {
      id: "dealer",
      title: "Официальный дилер",
      body: "Сервисная история производителя / сети.",
    },
    {
      id: "europe",
      title: "Европа",
      body: "Реестры, техосмотр и европейская история.",
      accent: "Скоро",
    },
  ],
  brandsTitle: "Дилерские бренды",
  brandsLead: "Официальная дилерская история (зависит от VIN / года):",
  ctaLabel: "Проверить авто",
  punchlineLead: "Проверь VIN.",
  punchlineAccent: "Не обманывайся.",
};

const ABOUT_LV: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "Par mums",
  title: "Kas mēs esam",
  lead:
    "AZ.VIN palīdz pārbaudīt importētus auto — oficiālie dīleri, izsoļu arhīvi un nobraukuma vēsture no Eiropas, Korejas un ASV.",
  directionsTitle: "Ko pārbaudām",
  directions: [
    {
      id: "koreaUsa",
      title: "Koreja un ASV",
      body: "Izsoles, īpašnieki, nobraukums un juridiskais statuss.",
    },
    {
      id: "dealer",
      title: "Oficiālais dīleris",
      body: "Ražotāja / oficiālā tīkla servisa vēsture.",
    },
    {
      id: "europe",
      title: "Eiropa",
      body: "Reģistri, tehniskā apskate un Eiropas vēsture.",
      accent: "Drīzumā",
    },
  ],
  brandsTitle: "Dīleru zīmoli",
  brandsLead: "Oficiālā dīlera vēsture (atkarīga no VIN / gada):",
  ctaLabel: "Pārbaudīt auto",
  punchlineLead: "Pārbaudi VIN.",
  punchlineAccent: "Neļaujies apmānīt.",
};

const ABOUT_BY_LOCALE: Record<AzvinLocale, AzvinAboutCopy> = {
  az: ABOUT_AZ,
  en: ABOUT_EN,
  ru: ABOUT_RU,
  lv: ABOUT_LV,
};

export function getAzvinAboutCopy(locale: AzvinLocale): AzvinAboutCopy {
  return ABOUT_BY_LOCALE[locale] ?? ABOUT_AZ;
}
