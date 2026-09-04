/** AZ.VIN / Azerbaijan market demo: 4 UI locales (az, en, ru, lv). */

export const AZVIN_LOCALES = ["az", "en", "ru", "lv"] as const;
export type AzvinLocale = (typeof AZVIN_LOCALES)[number];

export type AzvinHeroCopy = {
  brand: string;
  titlePrefix: string;
  titleAccent: string;
  titleDesktopLine1: string;
  titleDesktopLine2Prefix: string;
  titleDesktopAccent: string;
  subheadLead: string;
  subheadAccent: string;
  demoBanner: string;
  vinInvalid: string;
  listingInvalid: string;
  ctaDemoNote: string;
  langSwitcherAria: string;
};

const COPY_AZ: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Avtomobil tarixi ",
  titleAccent: "yoxlaması",
  titleDesktopLine1: "Avtomobil tarixi",
  titleDesktopLine2Prefix: "və ",
  titleDesktopAccent: "yoxlama",
  subheadLead: "Növbəti avtomobiliniz haqqında hər şeyi bilin.",
  subheadAccent:
    "Rəsmi diler, Koreya/ABŞ hərrac və Avropa reyestr məlumatlarını bir hesabatda birləşdiririk.",
  demoBanner: "AZ.VIN · Azərbaycan demo",
  vinInvalid: "Düzgün VIN daxil edin (11-17 simvol).",
  listingInvalid: "Düzgün elan linki daxil edin.",
  ctaDemoNote: "Demo. Ödəniş tezliklə.",
  langSwitcherAria: "Dil",
};

const COPY_EN: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Vehicle history ",
  titleAccent: "check",
  titleDesktopLine1: "Vehicle history",
  titleDesktopLine2Prefix: "and listing ",
  titleDesktopAccent: "check",
  subheadLead: "Know everything about your next car.",
  subheadAccent:
    "We combine official dealer, Korea/USA auction and Europe registry data into one clear report.",
  demoBanner: "AZ.VIN · Azerbaijan demo",
  vinInvalid: "Enter a valid VIN (11-17 characters).",
  listingInvalid: "Enter a valid listing link.",
  ctaDemoNote: "Demo only. Checkout coming soon.",
  langSwitcherAria: "Language",
};

const COPY_RU: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Проверка истории ",
  titleAccent: "авто",
  titleDesktopLine1: "Проверка истории",
  titleDesktopLine2Prefix: "и объявления ",
  titleDesktopAccent: "авто",
  subheadLead: "Узнайте всё о своём следующем авто.",
  subheadAccent:
    "Объединяем данные официального дилера, аукционов Кореи/США и реестров Европы в одном отчёте.",
  demoBanner: "AZ.VIN · Демо Азербайджан",
  vinInvalid: "Введите корректный VIN (11-17 символов).",
  listingInvalid: "Введите корректную ссылку на объявление.",
  ctaDemoNote: "Демо. Оплата скоро.",
  langSwitcherAria: "Язык",
};

const COPY_LV: AzvinHeroCopy = {
  brand: "AZ.VIN",
  titlePrefix: "Auto vēstures ",
  titleAccent: "pārbaude",
  titleDesktopLine1: "Auto vēstures",
  titleDesktopLine2Prefix: "un sludinājuma ",
  titleDesktopAccent: "pārbaude",
  subheadLead: "Uzzini visu par savu nākamo auto.",
  subheadAccent:
    "Apvienojam oficiālo dīleru, Korejas/ASV izsoļu un Eiropas reģistru datus vienā pārskatāmā atskaitē.",
  demoBanner: "AZ.VIN · Azerbaidžānas demo",
  vinInvalid: "Ievadi derīgu VIN (11-17 rakstzīmes).",
  listingInvalid: "Ievadi derīgu sludinājuma saiti.",
  ctaDemoNote: "Demo. Apmaksa drīzumā.",
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
