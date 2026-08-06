import { getTranslations } from "next-intl/server";
import { BlogComments } from "@/components/blog/BlogComments";
import { BlogPostBody } from "@/components/blog/BlogPostBody";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { Link } from "@/i18n/navigation";
import type { BlogPost } from "@/lib/blog/types";
import { resolveBlogLocale } from "@/lib/blog/posts";

type Props = {
  post: BlogPost;
  locale: string;
};

export async function BlogPostView({ post, locale }: Props) {
  const t = await getTranslations("Blogs");
  const { content, usingFallback } = resolveBlogLocale(post, locale);

  return (
    <article className="relative scroll-mt-16 px-4 pb-16 pt-10 sm:pb-20 sm:pt-12">
      <div className="relative mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
        <p className="mx-auto max-w-[min(42.5rem,calc(100vw-2rem))]">
          <Link
            href="/blogs"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280] no-underline transition hover:text-provin-accent"
          >
            {t("backToList")}
          </Link>
        </p>

        <header className="mx-auto mt-6 max-w-[min(42.5rem,calc(100vw-2rem))] text-center sm:mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
            <span>{post.category}</span>
            <span className="mx-2 text-[#d1d5db]">·</span>
            <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
          </p>
          <h1 className="mt-3 text-balance text-[1.55rem] font-semibold tracking-tight text-[#111827] sm:text-[2rem] lg:text-[2.25rem]">
            {content.title}
          </h1>
          <div className="mx-auto mt-4 w-full max-w-[min(100%,28rem)]">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          {usingFallback ? <p className="mt-4 text-sm text-[#6b7280]">{t("lvOnlyNote")}</p> : null}
        </header>

        <div className="mt-10 sm:mt-12">
          <BlogPostBody blocks={content.body} />
        </div>

        {post.tags.length > 0 ? (
          <ul className="mx-auto mt-10 flex max-w-[min(42.5rem,calc(100vw-2rem))] list-none flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="border border-black/10 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]"
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
