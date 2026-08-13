import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getCompanyPublicBrand } from "@/lib/company";
import { getPublicSiteOrigin } from "@/lib/site-url";

/** `app/[locale]/layout.tsx` metadati mantojas visām apakšlapām. Bez sava `alternates` katra
 * apakšlapa kanonizējas uz sākumlapu, tāpēc katrai indeksējamai lapai jāizsauc šie palīgi. */

type PublicLocale = (typeof routing.locales)[number];

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
  for (const l of routing.locales) languages[l] = publicPageUrl(l, path);
  languages["x-default"] = publicPageUrl(routing.defaultLocale, path);
  return { canonical: publicPageUrl(locale, path), languages };
}

export function openGraphLocale(locale: string): string {
  return locale === "en" ? "en_GB" : "lv_LV";
}

export function isPublicLocale(locale: string): locale is PublicLocale {
  return (routing.locales as readonly string[]).includes(locale);
}

/** Pilns metadatu bloks indeksējamai publiskajai lapai (title, description, canonical, hreflang, OG). */
export function buildPublicPageMetadata(args: {
  locale: string;
  path?: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
}): Metadata {
  const { locale, path = "", title, description } = args;
  const url = publicPageUrl(locale, path);
  const ogImage = `/${locale}/opengraph-image`;
  const ogTitle = args.ogTitle ?? title;
  const ogDescription = args.ogDescription ?? description;

  return {
    title,
    description,
    alternates: publicPageAlternates(locale, path),
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      siteName: getCompanyPublicBrand(),
      locale: openGraphLocale(locale),
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "vin-koda-parbaude-atskaite" }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
  };
}
