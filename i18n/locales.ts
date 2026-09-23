export const APP_LOCALES = ["lv", "en", "de", "ru"] as const;
export const PUBLIC_LOCALES = APP_LOCALES;
export const B2B_LOCALES = APP_LOCALES;
export const DEFAULT_LOCALE = "lv";
export const B2B_LOCALE_COOKIE = "provin-b2b-locale";
export const GERMAN_DEFAULT_COUNTRIES = ["DE", "AT"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "lv" || value === "en" || value === "de" || value === "ru";
}

export function isPublicLocale(value: string | null | undefined): value is PublicLocale {
  return value === "lv" || value === "en" || value === "de" || value === "ru";
}

/** Public copy is native in every locale. Russian is never chosen from a RU/BY IP. */
export function siteMessageLocale(locale: AppLocale): PublicLocale {
  return locale;
}

export function detectB2bDefaultLocale(country: string | null | undefined): AppLocale {
  const cc = country?.trim().toUpperCase() ?? "";
  if (GERMAN_DEFAULT_COUNTRIES.includes(cc as (typeof GERMAN_DEFAULT_COUNTRIES)[number])) {
    return "de";
  }
  if (cc === "LV" || cc === "") return DEFAULT_LOCALE;
  return "en";
}

/**
 * B2B entry locale.
 * Explicit `/lv|/en|/de|/ru` always wins (including Latvian). Unprefixed
 * `/partneriem` uses cookie, then IP. The site `/` dump onto `/lv` is handled
 * in middleware with `preferStoredLocale`.
 */
export function resolveB2bEntryLocale(args: {
  urlLocale: AppLocale | null;
  cookie?: string | null;
  country?: string | null;
  /** true only for unprefixed `/partneriem` or a one-time `/` → `/lv` dump. */
  preferStoredLocale?: boolean;
}): AppLocale {
  const cookie = args.cookie?.trim().toLowerCase();
  const saved = isAppLocale(cookie) ? cookie : null;
  if (args.urlLocale && !args.preferStoredLocale) return args.urlLocale;
  if (saved) return saved;
  if (args.urlLocale) return args.urlLocale;
  return detectB2bDefaultLocale(args.country);
}

export function isPartneriemPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/partneriem" || path.startsWith("/partneriem/");
}

/** Noteikumi un privātums DE/RU partneriem, lai kājene neaizvestu uz angļu lapu. */
export function isB2bLegalPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return path === "/lietosanas-noteikumi" || path === "/privatuma-politika";
}

export function parsePrefixedPath(pathname: string): { locale: AppLocale | null; rest: string } {
  const match = pathname.match(/^\/(lv|en|de|ru)(?=\/|$)/);
  if (!match?.[1] || !isAppLocale(match[1])) {
    return { locale: null, rest: pathname };
  }
  const rest = pathname.slice(match[0].length) || "/";
  return { locale: match[1], rest };
}

export function b2bDateLocale(locale: string): string {
  if (locale === "en") return "en-GB";
  if (locale === "de") return "de-DE";
  if (locale === "ru") return "ru-RU";
  return "lv-LV";
}
