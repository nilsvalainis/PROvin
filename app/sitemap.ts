import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getPublicSiteOrigin } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicSiteOrigin();
  const root = base.replace(/\/$/, "");
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    entries.push({
      url: `${root}${prefix || "/"}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    });
    entries.push({
      url: `${root}${prefix}/biezi-jautajumi`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.65,
    });
    entries.push({
      url: `${root}${prefix}/privatuma-politika`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    });
    entries.push({
      url: `${root}${prefix}/lietosanas-noteikumi`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    });
  }

  return entries;
}
