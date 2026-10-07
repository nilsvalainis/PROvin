import type { MetadataRoute } from "next";
import { isBlogLocaleIndexable, listBlogPosts } from "@/lib/blog/posts";
import { PUBLIC_LOCALES } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { INDEXABLE_PUBLIC_PATHS } from "@/lib/seo-public-paths";
import { getPublicSiteOrigin } from "@/lib/site-url";

function languagesForPath(base: string, path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of PUBLIC_LOCALES) languages[loc] = `${base}/${loc}${path}`;
  languages["x-default"] = `${base}/${routing.defaultLocale}${path}`;
  return languages;
}

/** `localePrefix: "always"` — kanoniskie URL ar `/${locale}` (piem. `/lv/pasutit`). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  let posts: Awaited<ReturnType<typeof listBlogPosts>> = [];
  try {
    posts = await listBlogPosts();
  } catch {
    posts = [];
  }

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of PUBLIC_LOCALES) {
    const prefix = `/${locale}`;
    for (const { path, changeFrequency, priority } of INDEXABLE_PUBLIC_PATHS) {
      entries.push({
        url: `${base}${prefix}${path}`,
        changeFrequency,
        priority,
        alternates: { languages: languagesForPath(base, path) },
      });
    }
    for (const post of posts) {
      if (!isBlogLocaleIndexable(post, locale)) continue;
      const postPath = `/blogs/${post.slug}`;
      const languages: Record<string, string> = {};
      for (const loc of PUBLIC_LOCALES) {
        if (isBlogLocaleIndexable(post, loc)) languages[loc] = `${base}/${loc}${postPath}`;
      }
      languages["x-default"] = `${base}/${routing.defaultLocale}${postPath}`;
      entries.push({
        url: `${base}${prefix}${postPath}`,
        lastModified: new Date(`${post.publishedAt}T12:00:00.000Z`),
        changeFrequency: "monthly",
        priority: 0.65,
        alternates: { languages },
      });
    }
  }

  return entries;
}
