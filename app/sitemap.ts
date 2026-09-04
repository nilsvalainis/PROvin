import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/blog/posts";
import { routing } from "@/i18n/routing";
import { getPublicSiteOrigin } from "@/lib/site-url";

/** `localePrefix: "always"` — kanoniskie URL ar `/${locale}` (piem. `/lv/pasutit`). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const lastModified = new Date();
  const posts = await listBlogPosts();

  const entries: MetadataRoute.Sitemap = [];

  const publicPaths: {
    path: string;
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
    priority: number;
  }[] = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/pakalpojumi", changeFrequency: "weekly", priority: 0.8 },
    { path: "/par-mums", changeFrequency: "monthly", priority: 0.75 },
    { path: "/blogs", changeFrequency: "weekly", priority: 0.75 },
    { path: "/privatuma-politika", changeFrequency: "yearly", priority: 0.4 },
    { path: "/lietosanas-noteikumi", changeFrequency: "yearly", priority: 0.4 },
  ];

  for (const locale of routing.locales) {
    const prefix = `/${locale}`;
    for (const { path, changeFrequency, priority } of publicPaths) {
      const languages: Record<string, string> = {};
      for (const loc of routing.locales) languages[loc] = `${base}/${loc}${path}`;
      languages["x-default"] = `${base}/${routing.defaultLocale}${path}`;
      entries.push({
        url: `${base}${prefix}${path}`,
        lastModified,
        changeFrequency,
        priority,
        alternates: { languages },
      });
    }
    for (const post of posts) {
      const postPath = `/blogs/${post.slug}`;
      const languages: Record<string, string> = {};
      for (const loc of routing.locales) languages[loc] = `${base}/${loc}${postPath}`;
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
