import type { AzvinLocale } from "@/lib/azvin-hero-copy";

export type { AzvinLocale };

export type AzvinAboutCopy = {
  sectionId: string;
  eyebrow: string;
  title: string;
  lead: string;
  bentoTitle: string;
  bento: readonly {
    id: string;
    title: string;
    body: string;
    accent?: string;
  }[];
  brandsTitle: string;
  ctaLabel: string;
  punchlineLead: string;
  punchlineAccent: string;
};

const ABOUT_EN: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "About",
  title: "Built for imported cars",
  lead: "Official dealer records, auction archives and mileage trails — Europe, Korea and the USA.",
  bentoTitle: "What you get",
  bento: [
    { id: "dealer", title: "Dealer history", body: "Authorised service records for supported brands." },
    { id: "auction", title: "Auction data", body: "Portal archives for Korea & USA imports." },
    { id: "mileage", title: "Mileage trail", body: "Odometer and usage history where available." },
    { id: "europe", title: "Europe", body: "Registry and inspection depth.", accent: "Soon" },
  ],
  brandsTitle: "Dealer brands",
  ctaLabel: "Check VIN",
  punchlineLead: "Check VIN.",
  punchlineAccent: "Don't be fooled.",
};

const ABOUT_AZ: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "Haqqımızda",
  title: "İdxal avtomobillər üçün",
  lead: "Rəsmi diler, hərrac arxivləri və yürüş — Avropa, Koreya və ABŞ.",
  bentoTitle: "Nə alırsınız",
  bento: [
    { id: "dealer", title: "Diler tarixi", body: "Rəsmi şəbəkə servis qeydləri." },
    { id: "auction", title: "Hərrac", body: "Koreya və ABŞ portal arxivləri." },
    { id: "mileage", title: "Yürüş", body: "Odometr və istismar izi." },
    { id: "europe", title: "Avropa", body: "Reyestr və texniki baxış.", accent: "Tezliklə" },
  ],
  brandsTitle: "Diler markaları",
  ctaLabel: "VIN yoxla",
  punchlineLead: "VIN yoxla.",
  punchlineAccent: "Aldanma.",
};

const ABOUT_RU: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "О нас",
  title: "Для импортных авто",
  lead: "Официальный дилер, аукционы и пробег — Европа, Корея и США.",
  bentoTitle: "Что вы получаете",
  bento: [
    { id: "dealer", title: "Дилер", body: "Сервисные записи официальной сети." },
    { id: "auction", title: "Аукционы", body: "Архивы Кореи и США." },
    { id: "mileage", title: "Пробег", body: "Одометр и история эксплуатации." },
    { id: "europe", title: "Европа", body: "Реестры и техосмотр.", accent: "Скоро" },
  ],
  brandsTitle: "Дилерские бренды",
  ctaLabel: "Проверить VIN",
  punchlineLead: "Проверь VIN.",
  punchlineAccent: "Не обманывайся.",
};

const ABOUT_LV: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "Par mums",
  title: "Importētiem auto",
  lead: "Oficiālie dīleri, izsoļu arhīvi un nobraukums — Eiropa, Koreja un ASV.",
  bentoTitle: "Ko saņemsi",
  bento: [
    { id: "dealer", title: "Dīlera vēsture", body: "Oficiālā tīkla servisa ieraksti." },
    { id: "auction", title: "Izsoles", body: "Korejas un ASV portālu arhīvi." },
    { id: "mileage", title: "Nobraukums", body: "Odometra un ekspluatācijas pēda." },
    { id: "europe", title: "Eiropa", body: "Reģistri un tehniskā apskate.", accent: "Drīzumā" },
  ],
  brandsTitle: "Dīleru zīmoli",
  ctaLabel: "Pārbaudīt VIN",
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
