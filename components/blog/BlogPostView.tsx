import { getTranslations } from "next-intl/server";
import { BlogComments } from "@/components/blog/BlogComments";
import { BlogPostBody } from "@/components/blog/BlogPostBody";
import { BlogViewTracker } from "@/components/blog/BlogViewTracker";
import { BlogPostToc } from "@/components/blog/BlogPostToc";
import { BlogTypeCover } from "@/components/blog/BlogTypeCover";
import styles from "@/components/blog/blog-post.module.css";
import tp5Styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { blogToc } from "@/lib/blog/toc";
import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/lib/blog/types";
import { b2bDateLocale } from "@/i18n/locales";
import { resolveBlogLocale } from "@/lib/blog/posts";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBlogPostingJsonLd } from "@/lib/seo-json-ld";
import { getPublicSiteOrigin } from "@/lib/site-url";

type Props = {
  post: BlogPost;
  locale: string;
};

export async function BlogPostView({ post, locale }: Props) {
  const t = await getTranslations("Blogs");
  const { content, usingFallback } = resolveBlogLocale(post, locale);
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  const cover = post.coverImage;
  const articleLd = buildBlogPostingJsonLd({
    locale,
    slug: post.slug,
    title: content.title,
    description: content.socialExcerpt ?? content.excerpt,
    publishedAt: post.publishedAt,
    tags: post.tags,
    image: cover ? `${base}${cover.src}` : undefined,
  });

  const toc = blogToc(content.body);
  const hasToc = toc.length > 1;

  return (
    <article className="home-body-ink relative scroll-mt-16 bg-transparent px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-12">
      <JsonLd data={articleLd} />
      <BlogViewTracker slug={post.slug} />
      <div className="mx-auto w-full max-w-[75rem]">
        <Link href="/blogs" className={styles.back}>
          {t("backToList")}
        </Link>

        <header>
          <p className={styles.meta}>
            <span>{post.category}</span>
            <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
          </p>
          <h1 className={styles.title}>{content.title}</h1>
          {usingFallback ? <p className="mt-4 text-sm text-white/45">{t("lvOnlyNote")}</p> : null}
        </header>

        <BlogTypeCover slug={post.slug} title={content.title} className={styles.cover} />

        <div className={`${styles.grid} ${hasToc ? "" : styles.gridSingle}`}>
          <BlogPostToc items={toc} label={t("tocLabel")} />
          <div className={styles.body}>
            <BlogPostBody blocks={content.body} />

            <div className={styles.cta}>
              <b>{t("ctaTitle")}</b>
              <p>{t("ctaBody")}</p>
              <div className={`${tp5Styles.ctaWrap} sm:!w-auto`}>
                <Link href="/#home-hero" className={`${tp5Styles.liquidCtaLink} sm:!w-auto sm:px-10`}>
                  <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
                  <span className={tp5Styles.liquidCtaLabel}>{t("ctaButton")}</span>
                </Link>
              </div>
            </div>

            {post.tags.length > 0 ? (
              <ul className="mt-10 flex list-none flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}

            <BlogComments
              slug={post.slug}
              labels={{
                title: t("commentsTitle"),
                name: t("commentName"),
                comment: t("commentBody"),
                submit: t("commentSubmit"),
                submitting: t("commentSubmitting"),
                empty: t("commentsEmpty"),
                success: t("commentSuccess"),
                error: t("commentError"),
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function formatPostDate(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(b2bDateLocale(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
