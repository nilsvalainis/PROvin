import type { MetadataRoute } from "next";
import { buildPublicSitemap } from "@/lib/seo-sitemap";

/** Stundas ISR: samazina aukstā starta 500 risku, kad blog Blob ir lēns. */
export const revalidate = 3600;

/** `localePrefix: "always"`: tikai indeksējami kanoniskie URL ar `/${locale}`. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildPublicSitemap();
}
