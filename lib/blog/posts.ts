import type { BlogPost, BlogPostLocale } from "@/lib/blog/types";
import {
  getStoredBlogPost,
  listStoredBlogPosts,
  normalizeBlogSlug,
} from "@/lib/blog/post-store";
import { routing } from "@/i18n/routing";

export async function listBlogPosts(): Promise<BlogPost[]> {
  return listStoredBlogPosts();
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return getStoredBlogPost(slug);
}

export async function getAllBlogSlugs(): Promise<string[]> {
  const posts = await listStoredBlogPosts();
  return posts.map((p) => p.slug);
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
  return `/blogs/${normalizeBlogSlug(slug)}`;
}

export { normalizeBlogSlug };
