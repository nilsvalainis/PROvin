import type { MetadataRoute } from "next";
import { isBlogLocaleIndexable, listBlogPosts } from "@/lib/blog/posts";
import { PUBLIC_LOCALES } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import {
  INDEXABLE_PUBLIC_PATHS,
  isIndexablePublicPage,
  publicHreflangLanguages,
  publicPageHref,
} from "@/lib/seo-public-paths";

/** `localePrefix: "always"`: tikai indeksējami kanoniskie URL ar `/${locale}`. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let posts: Awaited<ReturnType<typeof listBlogPosts>> = [];
  try {
    posts = await listBlogPosts();
  } catch {
    posts = [];
  }

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of PUBLIC_LOCALES) {
    for (const { path, changeFrequency, priority } of INDEXABLE_PUBLIC_PATHS) {
      if (!isIndexablePublicPage(locale, path)) continue;
      entries.push({
        url: publicPageHref(locale, path),
        changeFrequency,
        priority,
        alternates: { languages: publicHreflangLanguages(path) },
      });
    }
    for (const post of posts) {
      if (!isBlogLocaleIndexable(post, locale)) continue;
      const postPath = `/blogs/${post.slug}`;
      const languages: Record<string, string> = {};
      for (const loc of PUBLIC_LOCALES) {
        if (isBlogLocaleIndexable(post, loc)) languages[loc] = publicPageHref(loc, postPath);
      }
      languages["x-default"] = publicPageHref(routing.defaultLocale, postPath);
      entries.push({
        url: publicPageHref(locale, postPath),
        lastModified: new Date(`${post.publishedAt}T12:00:00.000Z`),
        changeFrequency: "monthly",
        priority: 0.65,
        alternates: { languages },
      });
    }
  }

  return entries;
}
