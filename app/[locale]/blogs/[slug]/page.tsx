import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostView } from "@/components/blog/BlogPostView";
import productHeroStyles from "@/app/[locale]/demo/page.module.css";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
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
    <div className={`home-page-canvas-root ${productHeroStyles.demoRoot} ${tp5Styles.homePageCanvas}`}>
      <div className="demo-design-dir flex min-h-0 min-w-0 flex-col bg-transparent text-zinc-100">
        <BlogPostView post={post} locale={locale} />
      </div>
    </div>
  );
}
