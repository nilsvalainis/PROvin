import type { MetadataRoute } from "next";
import { parsePrefixedPath, PUBLIC_LOCALES, type PublicLocale } from "@/i18n/locales";
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
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/\/+$/, "");
}

/**
 * GSC 02.11.2026: «Page with redirect» (12). Sitemap un kanoniskās saites tās neemitē.
 * Apex / HTTP / bez `/lv` / trailing slash / `/paraugi` paliek 308 uz www + lokali.
 */
export const GSC_REDIRECTING_INDEX_URLS = [
  "https://provin.lv/",
  "https://www.provin.lv/",
  "http://www.provin.lv/",
  "http://provin.lv/",
  "https://www.provin.lv/biezi-jautajumi",
  "https://www.provin.lv/lv/paraugi",
  "https://www.provin.lv/pakalpojumi",
  "https://www.provin.lv/en/",
  "https://www.provin.lv/par-mums",
  "https://www.provin.lv/lietosanas-noteikumi",
  "https://www.provin.lv/privatuma-politika",
  "https://www.provin.lv/lv/",
] as const;

/**
 * GSC 02.11.2026: «Excluded by noindex» (4). PDF un `?plan=` paliek noindex, ārpus sitemap.
 * `/de/partneriem` un `/ru/partneriem` dzīvajā ir `index, follow` (GSC ieraksts novecojis).
 */
export const GSC_NOINDEX_SITEMAP_BLOCKLIST = [
  "https://www.provin.lv/samples/provin-audits-piemers.pdf",
  "https://www.provin.lv/lv?plan=audits",
] as const;

/** Absolūts URL, ko drīkst likt sitemap.xml / hreflang (HTTPS www, lokale, bez `?` un `/` beigās). */
export function isCanonicalSitemapHref(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.search || parsed.hash) return false;
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) return false;
  const origin = getPublicSiteOrigin().replace(/\/$/, "");
  if (parsed.origin !== origin) return false;
  const { locale, rest } = parsePrefixedPath(parsed.pathname);
  if (!locale) return false;
  const path = rest === "/" ? "" : rest;
  if (path.startsWith("/blogs/") && path !== "/blogs") return true;
  return isIndexablePublicPage(locale, path);
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
