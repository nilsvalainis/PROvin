import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPageShell } from "@/components/blog/BlogPageShell";
import { BlogPostView } from "@/components/blog/BlogPostView";
import { getAllBlogSlugs, getBlogPost, resolveBlogLocale } from "@/lib/blog/posts";
import { getPublicSiteOrigin } from "@/lib/site-url";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};
  const { content } = resolveBlogLocale(post, locale);
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const description = content.socialExcerpt ?? content.excerpt;
  const url = `${base}/${locale}/blogs/${post.slug}`;
  const ogImages = post.coverImage
    ? [
        {
          url: `${base}${post.coverImage.src}`,
          width: post.coverImage.width,
          height: post.coverImage.height,
          alt: post.coverImage.alt,
        },
      ]
    : undefined;
  return {
    title: content.title,
    description,
    keywords: [...post.tags, "auto vēstures pārbaude", "PROVIN"],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: content.title,
      description,
      type: "article",
      publishedTime: `${post.publishedAt}T12:00:00.000Z`,
      url,
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title: content.title,
      description,
      ...(ogImages ? { images: [ogImages[0]!.url] } : {}),
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
