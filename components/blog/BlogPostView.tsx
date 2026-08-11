import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { BlogComments } from "@/components/blog/BlogComments";
import { BlogPostBody } from "@/components/blog/BlogPostBody";
import { BlogViewTracker } from "@/components/blog/BlogViewTracker";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/lib/blog/types";
import { resolveBlogLocale } from "@/lib/blog/posts";
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
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: content.title,
    description: content.socialExcerpt ?? content.excerpt,
    datePublished: `${post.publishedAt}T12:00:00.000Z`,
    inLanguage: locale === "en" ? "en" : "lv",
    mainEntityOfPage: `${base}/${locale}/blogs/${post.slug}`,
    keywords: post.tags.join(", "),
    ...(cover
      ? {
          image: [`${base}${cover.src}`],
        }
      : {}),
    publisher: {
      "@type": "Organization",
      name: "PROVIN.LV",
      url: base,
    },
  };

  return (
    <article className="home-body-ink relative scroll-mt-16 bg-transparent px-4 pb-16 pt-10 sm:pb-20 sm:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <BlogViewTracker slug={post.slug} />
      <div className="demo-design-dir__shell relative mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
        <p className="mx-auto max-w-[min(42.5rem,calc(100vw-2rem))]">
          <Link
            href="/blogs"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 no-underline transition hover:text-provin-accent"
          >
            {t("backToList")}
          </Link>
        </p>

        <header className="mx-auto mt-6 max-w-[min(42.5rem,calc(100vw-2rem))] text-center sm:mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
            <span>{post.category}</span>
            <span className="mx-2 text-white/20">·</span>
            <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
          </p>
          <h1 className="mt-3 text-balance text-[1.55rem] font-semibold tracking-tight text-white/[0.96] sm:text-[2rem] lg:text-[2.25rem]">
            {content.title}
          </h1>
          <div className="mx-auto mt-4 w-full max-w-[min(100%,28rem)]">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          {usingFallback ? <p className="mt-4 text-sm text-white/45">{t("lvOnlyNote")}</p> : null}
        </header>

        {cover ? (
          <figure className="mx-auto mt-8 max-w-[min(42.5rem,calc(100vw-2rem))] overflow-hidden rounded-sm border border-white/[0.08] bg-white/[0.03] sm:mt-10">
            <Image
              src={cover.src}
              alt={cover.alt}
              width={cover.width}
              height={cover.height}
              className="h-auto w-full object-cover"
              sizes="(max-width: 680px) 100vw, 42.5rem"
              priority
            />
            {cover.caption ? (
              <figcaption className="border-t border-white/[0.06] px-3 py-2.5 text-left text-[0.75rem] leading-snug text-white/55 sm:px-4 sm:text-[0.8125rem]">
                {cover.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        <div className="mt-10 sm:mt-12">
          <BlogPostBody blocks={content.body} />
        </div>

        {post.tags.length > 0 ? (
          <ul className="mx-auto mt-10 flex max-w-[min(42.5rem,calc(100vw-2rem))] list-none flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45"
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
    </article>
  );
}

function formatPostDate(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "lv-LV", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
