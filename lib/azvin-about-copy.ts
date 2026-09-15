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
  lead: "Four packages: Korea, Europe, America and official dealer data.",
  bentoTitle: "Packages",
  bento: [
    {
      id: "korea",
      title: "Korea",
      body: "Korean auction archives, mileage, damage/salvage and title status. 19 AZN.",
    },
    {
      id: "europe",
      title: "Europe",
      body: "CarVertical*, AutoDNA*, registries, auctions, dealer data. 149 AZN.",
    },
    {
      id: "usa",
      title: "America",
      body: "Copart, IAAI, mileage, salvage and title status. 19 AZN.",
    },
    { id: "dealer", title: "Dealer data", body: "Manufacturer service history and mileage. 49 AZN." },
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
  lead: "Dörd paket: Koreya, Avropa, Amerika və rəsmi diler məlumatları.",
  bentoTitle: "Paketlər",
  bento: [
    {
      id: "korea",
      title: "Koreya",
      body: "Koreya hərrac arxivi, yürüş, zədələnmə/salvage və title. 19 AZN.",
    },
    {
      id: "europe",
      title: "Avropa",
      body: "CarVertical*, AutoDNA*, reyestr, hərrac, diler. 149 AZN.",
    },
    {
      id: "usa",
      title: "Amerika",
      body: "Copart, IAAI, yürüş, salvage və title. 19 AZN.",
    },
    { id: "dealer", title: "Diler məlumatı", body: "İstehsalçı servis tarixi və yürüş. 49 AZN." },
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
  lead: "Четыре пакета: Корея, Европа, Америка и данные официального дилера.",
  bentoTitle: "Пакеты",
  bento: [
    {
      id: "korea",
      title: "Корея",
      body: "Архив корейских аукционов, пробег, salvage и title. 19 AZN.",
    },
    {
      id: "europe",
      title: "Европа",
      body: "CarVertical*, AutoDNA*, реестры, аукционы, дилер. 149 AZN.",
    },
    {
      id: "usa",
      title: "Америка",
      body: "Copart, IAAI, пробег, salvage и title. 19 AZN.",
    },
    { id: "dealer", title: "Данные дилера", body: "Сервисная история и пробег. 49 AZN." },
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
  lead: "Četras paketes: Koreja, Eiropa, Amerika un oficiālie dīlera dati.",
  bentoTitle: "Paketes",
  bento: [
    {
      id: "korea",
      title: "Koreja",
      body: "Korejas izsoļu arhīvs, nobraukums, salvage un title. 19 AZN.",
    },
    {
      id: "europe",
      title: "Eiropa",
      body: "CarVertical*, AutoDNA*, reģistri, izsoles, dīleris. 149 AZN.",
    },
    {
      id: "usa",
      title: "Amerika",
      body: "Copart, IAAI, nobraukums, salvage un title. 19 AZN.",
    },
    { id: "dealer", title: "Dīlera dati", body: "Ražotāja servisa vēsture un nobraukums. 49 AZN." },
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
