import { DEFAULT_LOCALE, type PublicLocale } from "@/i18n/locales";

/**
 * Bloga lokāles ar pilnu rakstu (robots index).
 * DE/RU ir LV kopijas. Īss EN aizvietotājs paliek noindex un nav jāsasaista no indeksējamām lapām.
 * Jauns pilns EN raksts jāpievieno šeit; tests salīdzina ar `isBlogLocaleIndexable`.
 */
const FULL_ARTICLE_LOCALES: Record<string, readonly PublicLocale[]> = {
  "ka-pirkt-lietotu-auto-bez-tabu": ["lv"],
  "krapsanas-shemas-mobile-de-48000": ["lv"],
};

export function blogSlugFromPublicPath(pathname: string): string | null {
  const path = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/";
  const match = path.match(/^\/blogs\/([^/]+)$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function crawlableBlogLocales(slug: string): readonly PublicLocale[] {
  return FULL_ARTICLE_LOCALES[slug] ?? [DEFAULT_LOCALE];
}

export function isCrawlableBlogLocale(slug: string, locale: string): boolean {
  return (crawlableBlogLocales(slug) as readonly string[]).includes(locale);
}
