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
  lead: "Three clear packages — Korea & USA, Europe PRO, and official dealer data.",
  bentoTitle: "Packages",
  bento: [
    {
      id: "koreaUsa",
      title: "Korea & USA",
      body: "Auction archives, mileage, damage/salvage and title status. 19 AZN.",
    },
    {
      id: "europe",
      title: "Europe PRO",
      body: "Full Europe check — CarVertical*, AutoDNA*, registries, auctions, dealer data. 149 AZN.",
    },
    { id: "dealer", title: "Dealer data", body: "Manufacturer service history and mileage. 49 AZN." },
    { id: "refund", title: "Refund", body: "Full refund if dealer databases have no data." },
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
  lead: "Üç paket — Koreya və ABŞ, Avropa PRO və rəsmi diler məlumatları.",
  bentoTitle: "Paketlər",
  bento: [
    {
      id: "koreaUsa",
      title: "Koreya və ABŞ",
      body: "Hərrac arxivi, yürüş, zədələnmə/salvage və title statusu. 19 AZN.",
    },
    {
      id: "europe",
      title: "Avropa PRO",
      body: "Tam Avropa yoxlaması — CarVertical*, AutoDNA*, reyestr, hərrac, diler. 149 AZN.",
    },
    { id: "dealer", title: "Diler məlumatı", body: "İstehsalçı servis tarixi və yürüş. 49 AZN." },
    { id: "refund", title: "Geri ödəniş", body: "Diler bazasında məlumat yoxdursa — tam geri ödəniş." },
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
  lead: "Три пакета — Корея и США, Европа PRO и данные официального дилера.",
  bentoTitle: "Пакеты",
  bento: [
    {
      id: "koreaUsa",
      title: "Корея и США",
      body: "Архив аукционов, пробег, повреждения/salvage и title-статус. 19 AZN.",
    },
    {
      id: "europe",
      title: "Европа PRO",
      body: "Полная проверка Европы — CarVertical*, AutoDNA*, реестры, аукционы, дилер. 149 AZN.",
    },
    { id: "dealer", title: "Данные дилера", body: "Сервисная история и пробег. 49 AZN." },
    { id: "refund", title: "Возврат", body: "Полный возврат, если данных нет в дилерских базах." },
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
  lead: "Trīs paketes — Koreja un ASV, Eiropa PRO un oficiālie dīlera dati.",
  bentoTitle: "Paketes",
  bento: [
    {
      id: "koreaUsa",
      title: "Koreja un ASV",
      body: "Izsoļu arhīvs, nobraukums, bojājumi/salvage un title statuss. 19 AZN.",
    },
    {
      id: "europe",
      title: "Eiropa PRO",
      body: "Pilns Eiropas komplekts — CarVertical*, AutoDNA*, reģistri, izsoles, dīleris. 149 AZN.",
    },
    { id: "dealer", title: "Dīlera dati", body: "Ražotāja servisa vēsture un nobraukums. 49 AZN." },
    { id: "refund", title: "Atmaksa", body: "Pilna atmaksa, ja dīleru datubāzēs datu nav." },
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
