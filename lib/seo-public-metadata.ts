import type { Metadata } from "next";
import { PUBLIC_LOCALES } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { getCompanyPublicBrand } from "@/lib/company";
import { DEFAULT_OG_IMAGE_PATH } from "@/lib/seo-public-paths";
import { getPublicSiteOrigin } from "@/lib/site-url";

/** `app/[locale]/layout.tsx` metadati mantojas visām apakšlapām. Bez sava `alternates` katra
 * apakšlapa kanonizējas uz sākumlapu, tāpēc katrai indeksējamai lapai jāizsauc šie palīgi. */

type PublicLocale = (typeof PUBLIC_LOCALES)[number];

function normalizePath(path: string): string {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function publicPageUrl(locale: string, path = ""): string {
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  return `${base}/${locale}${normalizePath(path)}`;
}

/** Kanoniskais URL + `hreflang` pāri (`x-default` → noklusējuma lokalizācija). */
export function publicPageAlternates(locale: string, path = ""): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of PUBLIC_LOCALES) languages[l] = publicPageUrl(l, path);
  languages["x-default"] = publicPageUrl(routing.defaultLocale, path);
  return { canonical: publicPageUrl(locale, path), languages };
}

export function openGraphLocale(locale: string): string {
  if (locale === "en") return "en_GB";
  if (locale === "de") return "de_DE";
  if (locale === "ru") return "ru_RU";
  return "lv_LV";
}

export function openGraphLocaleAlternates(locale: string): string[] {
  return PUBLIC_LOCALES.filter((l) => l !== locale).map(openGraphLocale);
}

export function isPublicLocale(locale: string): locale is PublicLocale {
  return (PUBLIC_LOCALES as readonly string[]).includes(locale);
}

export function htmlLangForLocale(locale: string): string {
  if (locale === "en") return "en";
  if (locale === "de") return "de";
  if (locale === "ru") return "ru";
  return "lv";
}

/** Pilns metadatu bloks indeksējamai publiskajai lapai (title, description, canonical, hreflang, OG). */
export function buildPublicPageMetadata(args: {
  locale: string;
  path?: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageAlt?: string;
  keywords?: string[];
}): Metadata {
  const { locale, path = "", title, description } = args;
  const url = publicPageUrl(locale, path);
  const ogTitle = args.ogTitle ?? title;
  const ogDescription = args.ogDescription ?? description;
  const ogImageAlt = args.ogImageAlt ?? title;
  const brand = getCompanyPublicBrand();

  return {
    title: { absolute: title },
    description,
    ...(args.keywords?.length ? { keywords: args.keywords } : {}),
    alternates: publicPageAlternates(locale, path),
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      siteName: brand,
      locale: openGraphLocale(locale),
      alternateLocale: openGraphLocaleAlternates(locale),
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE_PATH, width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
    robots: { index: true, follow: true },
  };
}

export function buildNoindexMetadata(args: { title: string; description?: string }): Metadata {
  return {
    title: { absolute: args.title },
    ...(args.description ? { description: args.description } : {}),
    robots: { index: false, follow: false },
  };
}
