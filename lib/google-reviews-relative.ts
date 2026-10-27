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

/** Brīdis, kad `relative` vērtības nokopētas no Google profila (lib/google-reviews-data.ts). */
export const GOOGLE_REVIEWS_SNAPSHOT_AT = "2026-10-21T08:39:28+03:00";

const UNIT_MS: Partial<Record<Intl.RelativeTimeFormatUnit, number>> = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  year: 365 * 86_400_000,
};

/**
 * Relatīvais laiks "tagad" brīdī: momentuzņēmuma vērtība + kopš tā pagājušais laiks, lai teksts
 * nenoveco (audits 2026-10-27). Vienība kā Google: stundas, dienas, nedēļas, mēneši, gadi.
 */
export function googleReviewRelativeNow(relative: GoogleReviewRelative, now: Date = new Date()): GoogleReviewRelative {
  const unitMs = UNIT_MS[relative.unit];
  if (!unitMs) return relative;
  const snapshot = Date.parse(GOOGLE_REVIEWS_SNAPSHOT_AT);
  const ageMs = Math.abs(relative.value) * unitMs + Math.max(0, now.getTime() - snapshot);
  const hours = ageMs / UNIT_MS.hour!;
  if (hours < 24) return { value: Math.max(1, Math.floor(hours)), unit: "hour" };
  const days = ageMs / UNIT_MS.day!;
  if (days < 7) return { value: Math.floor(days), unit: "day" };
  if (days < 30) return { value: Math.floor(days / 7), unit: "week" };
  if (days < 365) return { value: Math.floor(days / 30), unit: "month" };
  return { value: Math.floor(days / 365), unit: "year" };
}

export function formatGoogleReviewRelativeDate(
  locale: string,
  relative: GoogleReviewRelative,
  now: Date = new Date(),
): string {
  const loc = isAppLocale(locale) ? BCP47[locale] : "lv";
  const fmt = new Intl.RelativeTimeFormat(loc, { numeric: "always", style: "long" });
  const current = googleReviewRelativeNow(relative, now);
  return fmt.format(-Math.abs(current.value), current.unit);
}
