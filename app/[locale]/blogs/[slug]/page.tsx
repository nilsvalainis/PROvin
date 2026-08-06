import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPageShell } from "@/components/blog/BlogPageShell";
import { BlogPostView } from "@/components/blog/BlogPostView";
import { getAllBlogSlugs, getBlogPost, resolveBlogLocale } from "@/lib/blog/posts";
import { getPublicSiteOrigin } from "@/lib/site-url";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  const { content } = resolveBlogLocale(post, locale);
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const description = content.socialExcerpt ?? content.excerpt;
  return {
    title: content.title,
    description,
    alternates: {
      canonical: `${base}/${locale}/blogs/${post.slug}`,
    },
    openGraph: {
      title: content.title,
      description,
      type: "article",
      publishedTime: `${post.publishedAt}T12:00:00.000Z`,
      url: `${base}/${locale}/blogs/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
    <BlogPageShell>
      <BlogPostView post={post} locale={locale} />
    </BlogPageShell>
  );
}
