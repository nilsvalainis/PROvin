import type { MetadataRoute } from "next";
import { PUBLIC_LOCALES, type PublicLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { getPublicSiteOrigin } from "@/lib/site-url";

/** Lokalizācijas, kas drīkst būt sitemap.xml un `robots index`. Vienots avots ar ceļiem zemāk. */
export const INDEXABLE_PUBLIC_LOCALES: readonly PublicLocale[] = PUBLIC_LOCALES;

/** Indeksējamie publiskie ceļi (bez lokales prefiksa). Sitemap un robots meta nāk no šī saraksta. */
export const INDEXABLE_PUBLIC_PATHS: {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/vin-koda-parbaude", changeFrequency: "monthly", priority: 0.9 },
  { path: "/vin-dekoders", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pakalpojumi", changeFrequency: "weekly", priority: 0.85 },
  { path: "/biezi-jautajumi", changeFrequency: "monthly", priority: 0.8 },
  { path: "/par-mums", changeFrequency: "monthly", priority: 0.75 },
  { path: "/blogs", changeFrequency: "weekly", priority: 0.75 },
  { path: "/partneriem", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privatuma-politika", changeFrequency: "yearly", priority: 0.4 },
  { path: "/lietosanas-noteikumi", changeFrequency: "yearly", priority: 0.4 },
  { path: "/partneriem/noteikumi", changeFrequency: "yearly", priority: 0.3 },
];

/**
 * Publiski maršruti, kas renderē noindex (vai ir konta/pasūtījuma plūsma).
 * Nedrīkst nonākt sitemap.xml, arī ja kāds tos pievieno INDEXABLE_PUBLIC_PATHS.
 */
export const NEVER_INDEX_PUBLIC_PATHS = [
  "/pasutit",
  "/paldies",
  "/partneriem/konts",
  "/partneriem/parole",
  "/partneriem/registracija",
  "/partneriem/apstiprinat",
  "/papildinajums",
  "/provin-select-pieteikums",
  "/demo",
  "/view",
  "/dev",
] as const;

export function normalizePublicPath(path: string): string {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function matchesNeverIndexPath(path: string): boolean {
  return NEVER_INDEX_PUBLIC_PATHS.some(
    (blocked) => path === blocked || path.startsWith(`${blocked}/`),
  );
}

/** Vai šī lokale+ceļš drīkst būt kanonisks indeksējams URL (sitemap + robots index). */
export function isIndexablePublicPage(locale: string, path = ""): boolean {
  if (!(INDEXABLE_PUBLIC_LOCALES as readonly string[]).includes(locale)) return false;
  const normalized = normalizePublicPath(path);
  if (matchesNeverIndexPath(normalized)) return false;
  return INDEXABLE_PUBLIC_PATHS.some((entry) => entry.path === normalized);
}

export function indexableLocalesForPath(path = ""): PublicLocale[] {
  const normalized = normalizePublicPath(path);
  return INDEXABLE_PUBLIC_LOCALES.filter((locale) => isIndexablePublicPage(locale, normalized));
}

export function publicPageHref(locale: string, path = ""): string {
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  return `${base}/${locale}${normalizePublicPath(path)}`;
}

/** hreflang tikai indeksējamām lokalēm; x-default paliek noklusējuma lokale. */
export function publicHreflangLanguages(path = ""): Record<string, string> {
  const normalized = normalizePublicPath(path);
  const languages: Record<string, string> = {};
  for (const loc of indexableLocalesForPath(normalized)) {
    languages[loc] = publicPageHref(loc, normalized);
  }
  languages["x-default"] = publicPageHref(routing.defaultLocale, normalized);
  return languages;
}

export function publicPageRobots(locale: string, path = ""): { index: boolean; follow: boolean } {
  const index = isIndexablePublicPage(locale, path);
  return { index, follow: true };
}

/** Vecie / angliskie sliekšņa ceļi → kanoniskais ceļš bez lokales. */
export const LEGACY_PATH_ALIASES: Record<string, string> = {
  "/faq": "/biezi-jautajumi",
  "/about": "/par-mums",
  "/samples": "/pakalpojumi",
  "/paraugi": "/pakalpojumi",
  "/blog": "/blogs",
  "/services": "/pakalpojumi",
  "/terms": "/lietosanas-noteikumi",
  "/privacy": "/privatuma-politika",
};

export const SEO_LOCALE_HEADER = "x-provin-locale";
export const DEFAULT_OG_IMAGE_PATH = "/og.png";
