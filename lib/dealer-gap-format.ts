/**
 * „Periods bez ierakstiem” ilgums pilniem vārdiem (Nils 23.11.2026: „robs” ir žargons, bez
 * saīsinājumiem „mēn.”). Atsevišķs modulis bez atkarībām - lieto PDF, admin un ātrās pārbaudes fakti.
 */
export type GapLang = "lv" | "en" | "ru" | "de";

/** Skaitļa forma: LV „1 mēnesis / 2 mēneši / 21 mēnesis”, RU „1 месяц / 2 месяца / 5 месяцев”. */
function pluralForm(n: number, lang: GapLang, forms: { lv: [string, string]; en: [string, string]; ru: [string, string, string]; de: [string, string] }): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (lang === "lv") return mod10 === 1 && mod100 !== 11 ? forms.lv[0] : forms.lv[1];
  if (lang === "ru") {
    if (mod10 === 1 && mod100 !== 11) return forms.ru[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.ru[1];
    return forms.ru[2];
  }
  if (lang === "de") return n === 1 ? forms.de[0] : forms.de[1];
  return n === 1 ? forms.en[0] : forms.en[1];
}

const MONTH_FORMS = {
  lv: ["mēnesis", "mēneši"] as [string, string],
  en: ["month", "months"] as [string, string],
  ru: ["месяц", "месяца", "месяцев"] as [string, string, string],
  de: ["Monat", "Monate"] as [string, string],
};
const YEAR_FORMS = {
  lv: ["gads", "gadi"] as [string, string],
  en: ["year", "years"] as [string, string],
  ru: ["год", "года", "лет"] as [string, string, string],
  de: ["Jahr", "Jahre"] as [string, string],
};

/**
 * Ilgums pilniem vārdiem (Nils 23.11: bez saīsinājumiem): „15 mēneši”, „1 mēnesis”;
 * no 24 mēnešiem - gadi un mēneši („2 gadi 3 mēneši”).
 */
export function formatDealerGapMonths(months: number, lang: GapLang = "lv"): string {
  const m = Math.max(0, Math.round(months));
  if (m < 24) return `${m} ${pluralForm(m, lang, MONTH_FORMS)}`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  const y = `${years} ${pluralForm(years, lang, YEAR_FORMS)}`;
  return rest > 0 ? `${y} ${rest} ${pluralForm(rest, lang, MONTH_FORMS)}` : y;
}

