import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPageShell } from "@/components/blog/BlogPageShell";
import { BlogPostView } from "@/components/blog/BlogPostView";
import { getAllBlogSlugs, getBlogPost, resolveBlogLocale } from "@/lib/blog/posts";
import { DEFAULT_OG_IMAGE_PATH } from "@/lib/seo-public-paths";
import { publicPageAlternates, publicPageUrl } from "@/lib/seo-public-metadata";
import { getPublicSiteOrigin } from "@/lib/site-url";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const revalidate = 3600;
/** Jauni ieraksti (pievienoti pēc build) jārenderē pieprasījuma laikā, nevis 404. */
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};
  const { content } = resolveBlogLocale(post, locale);
  const description = content.socialExcerpt ?? content.excerpt;
  const url = publicPageUrl(locale, `/blogs/${post.slug}`);
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const ogImages = post.coverImage
    ? [
        {
          url: `${base}${post.coverImage.src}`,
          width: post.coverImage.width,
          height: post.coverImage.height,
          alt: post.coverImage.alt,
        },
      ]
    : [{ url: `${base}${DEFAULT_OG_IMAGE_PATH}`, width: 1200, height: 630, alt: content.title }];
  return {
    title: { absolute: `${content.title} | PROVIN` },
    description,
    keywords: [...post.tags, "auto vēstures pārbaude", "VIN koda pārbaude", "PROVIN"],
    alternates: publicPageAlternates(locale, `/blogs/${post.slug}`),
    openGraph: {
      title: content.title,
      description,
      type: "article",
      publishedTime: `${post.publishedAt}T12:00:00.000Z`,
      url,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: content.title,
      description,
      images: [ogImages[0]!.url],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  return (
    <BlogPageShell>
      <BlogPostView post={post} locale={locale} />
    </BlogPageShell>
  );
}
