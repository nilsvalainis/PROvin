import type { MetadataRoute } from "next";
import { isBlogLocaleIndexable, listBlogPosts } from "@/lib/blog/posts";
import { PUBLIC_LOCALES } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import {
  INDEXABLE_PUBLIC_PATHS,
  isCanonicalSitemapHref,
  isIndexablePublicPage,
  publicHreflangLanguages,
  publicPageHref,
} from "@/lib/seo-public-paths";

/** Bloga Blob / FS nedrīkst nogāzt `/sitemap.xml` (Andris: prod 500). */
export const SITEMAP_BLOG_LIST_TIMEOUT_MS = 2500;

export function withSitemapTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function listSitemapBlogPosts(): Promise<Awaited<ReturnType<typeof listBlogPosts>>> {
  return withSitemapTimeout(listBlogPosts(), SITEMAP_BLOG_LIST_TIMEOUT_MS, []);
}

export function sitemapLastModified(publishedAt: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) return undefined;
  const date = new Date(`${publishedAt}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function pushIfCanonical(entries: MetadataRoute.Sitemap, entry: MetadataRoute.Sitemap[number]) {
  const listed = [entry.url, ...Object.values(entry.alternates?.languages ?? {})].filter(
    (url): url is string => typeof url === "string" && url.length > 0,
  );
  if (listed.some((url) => !isCanonicalSitemapHref(url))) return;
  entries.push(entry);
}

/** Tikai indeksējami kanoniskie URL ar `/${locale}`. */
export async function buildPublicSitemap(): Promise<MetadataRoute.Sitemap> {
  let posts: Awaited<ReturnType<typeof listBlogPosts>> = [];
  try {
    posts = await listSitemapBlogPosts();
  } catch {
    posts = [];
  }

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of PUBLIC_LOCALES) {
    for (const { path, changeFrequency, priority } of INDEXABLE_PUBLIC_PATHS) {
      if (!isIndexablePublicPage(locale, path)) continue;
      pushIfCanonical(entries, {
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
      pushIfCanonical(entries, {
        url: publicPageHref(locale, postPath),
        lastModified: sitemapLastModified(post.publishedAt),
        changeFrequency: "monthly",
        priority: 0.65,
        alternates: { languages },
      });
    }
  }

  return entries;
}
