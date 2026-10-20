import type { AppLocale } from "@/i18n/locales";
import { isAppLocale } from "@/i18n/locales";

export type GoogleReviewRelative = {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
};

const BCP47: Record<AppLocale, string> = {
  lv: "lv",
  en: "en",
  de: "de",
  ru: "ru",
};

export function formatGoogleReviewRelativeDate(
  locale: string,
  relative: GoogleReviewRelative,
): string {
  const loc = isAppLocale(locale) ? BCP47[locale] : "lv";
  const fmt = new Intl.RelativeTimeFormat(loc, { numeric: "always", style: "long" });
  return fmt.format(-Math.abs(relative.value), relative.unit);
}
