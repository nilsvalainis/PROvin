import { postMobileDeScam48000 } from "@/lib/blog/posts/mobile-de-scam-48000";
import type { BlogPost, BlogPostLocale } from "@/lib/blog/types";
import { routing } from "@/i18n/routing";

const ALL_POSTS: readonly BlogPost[] = [postMobileDeScam48000];

export function listBlogPosts(): BlogPost[] {
  return [...ALL_POSTS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function getBlogPost(slug: string): BlogPost | null {
  const s = slug.trim().toLowerCase();
  return ALL_POSTS.find((p) => p.slug === s) ?? null;
}

export function getAllBlogSlugs(): string[] {
  return ALL_POSTS.map((p) => p.slug);
}

export function resolveBlogLocale(
  post: BlogPost,
  locale: string,
): { content: BlogPostLocale; usingFallback: boolean } {
  const loc = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
  if (loc === "en" && post.en) {
    return { content: post.en, usingFallback: false };
  }
  return { content: post.lv, usingFallback: loc !== "lv" };
}

export function blogPostHref(slug: string): string {
  return `/blogs/${slug}`;
}
