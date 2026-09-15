/** AZ.VIN / Azerbaijan market demo: 4 UI locales (az, en, ru, lv). */

export const AZVIN_LOCALES = ["az", "en", "ru", "lv"] as const;
export type AzvinLocale = (typeof AZVIN_LOCALES)[number];

type AzvinHeroServiceId = "korea" | "europe" | "usa" | "dealer";

export type AzvinHeroCopy = {
  brand: string;
  titlePrefix: string;
  titleAccent: string;
  vinInvalid: string;
  listingInvalid: string;
  ctaDemoNote: string;
  langSwitcherAria: string;
};

type AzvinHeroBase = Omit<AzvinHeroCopy, "titlePrefix" | "titleAccent">;

const BASE_AZ: AzvinHeroBase = {
  brand: "AZ.VIN",
  vinInvalid: "Düzgün VIN daxil edin (11-17 simvol).",
  listingInvalid: "Düzgün elan linki daxil edin.",
  ctaDemoNote: "Demo. Ödəniş tezliklə.",
  langSwitcherAria: "Dil",
};

const BASE_EN: AzvinHeroBase = {
  brand: "AZ.VIN",
  vinInvalid: "Enter a valid VIN (11-17 characters).",
  listingInvalid: "Enter a valid listing link.",
  ctaDemoNote: "Demo only. Checkout coming soon.",
  langSwitcherAria: "Language",
};

const BASE_RU: AzvinHeroBase = {
  brand: "AZ.VIN",
  vinInvalid: "Введите корректный VIN (11-17 символов).",
  listingInvalid: "Введите корректную ссылку на объявление.",
  ctaDemoNote: "Демо. Оплата скоро.",
  langSwitcherAria: "Язык",
};

const BASE_LV: AzvinHeroBase = {
  brand: "AZ.VIN",
  vinInvalid: "Ievadi derīgu VIN (11-17 rakstzīmes).",
  listingInvalid: "Ievadi derīgu sludinājuma saiti.",
  ctaDemoNote: "Demo. Apmaksa drīzumā.",
  langSwitcherAria: "Valoda",
};

const TITLES: Record<AzvinLocale, Record<AzvinHeroServiceId, { prefix: string; accent: string }>> = {
  az: {
    korea: { prefix: "Koreya avtomobil tarixi ", accent: "yoxlaması" },
    europe: { prefix: "Avropa avtomobil tarixi ", accent: "yoxlaması" },
    usa: { prefix: "Amerika avtomobil tarixi ", accent: "yoxlaması" },
    dealer: { prefix: "Rəsmi diler məlumatları ", accent: "hesabatı" },
  },
  en: {
    korea: { prefix: "Korea vehicle history ", accent: "check" },
    europe: { prefix: "Europe vehicle history ", accent: "check" },
    usa: { prefix: "America vehicle history ", accent: "check" },
    dealer: { prefix: "Official dealer data ", accent: "report" },
  },
  ru: {
    korea: { prefix: "Проверка истории авто из ", accent: "Кореи" },
    europe: { prefix: "Проверка истории авто из ", accent: "Европы" },
    usa: { prefix: "Проверка истории авто из ", accent: "Америки" },
    dealer: { prefix: "Официальные данные ", accent: "дилера" },
  },
  lv: {
    korea: { prefix: "Korejas auto vēstures ", accent: "pārbaude" },
    europe: { prefix: "Eiropas auto vēstures ", accent: "pārbaude" },
    usa: { prefix: "Amerikas auto vēstures ", accent: "pārbaude" },
    dealer: { prefix: "Oficiālā dīlera datu ", accent: "atskaite" },
  },
};

const BASE: Record<AzvinLocale, AzvinHeroBase> = {
  az: BASE_AZ,
  en: BASE_EN,
  ru: BASE_RU,
  lv: BASE_LV,
};

export function getAzvinHeroCopy(
  locale: AzvinLocale,
  serviceId: AzvinHeroServiceId = "korea",
): AzvinHeroCopy {
  const base = BASE[locale] ?? BASE_AZ;
  const title = TITLES[locale]?.[serviceId] ?? TITLES.az.korea;
  return {
    ...base,
    titlePrefix: title.prefix,
    titleAccent: title.accent,
  };
}
