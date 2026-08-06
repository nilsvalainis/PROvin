import { getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { getIrissSocialUrls, IrissSocialIcons } from "@/components/IrissSocialIcons";
import { Link } from "@/i18n/navigation";
import { blogPostHref, listBlogPosts, resolveBlogLocale } from "@/lib/blog/posts";
import { homeEditorialSectionTitleClass } from "@/lib/home-layout";

type Props = { locale: string };

export async function BlogIndex({ locale }: Props) {
  const t = await getTranslations("Blogs");
  const tIriss = await getTranslations("Iriss");
  const social = getIrissSocialUrls();
  const posts = listBlogPosts();

  return (
    <section id="blogs" className="relative scroll-mt-16 px-4 pb-16 pt-10 sm:pb-20 sm:pt-12">
      <div className="relative mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
        <header className="mx-auto max-w-[min(42.5rem,calc(100vw-2rem))] text-center">
          <h1 className={`${homeEditorialSectionTitleClass} text-provin-accent`}>{t("sermonTitle")}</h1>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,28rem)]">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className="mx-auto mt-4 max-w-[min(100%,40rem)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b7280] sm:mt-5 sm:text-[12px]">
            {tIriss("pageLead")}
          </p>
          <p className="mx-auto mt-4 max-w-[min(100%,40rem)] text-pretty text-[0.95rem] leading-relaxed text-[#374151] sm:mt-5 sm:text-[1.05rem] sm:leading-[1.7]">
            {t("introBody")}
          </p>
          <div className="mt-6 flex justify-center sm:mt-7">
            <IrissSocialIcons
              tone="light"
              tiktok={social.tiktok}
              youtube={social.youtube}
              instagram={social.instagram}
              socialLabel={tIriss("socialLabel")}
              socialSoon={tIriss("socialSoon")}
            />
          </div>
        </header>

        <ul className="mx-auto mt-12 flex list-none flex-col gap-6 sm:mt-14 sm:gap-8">
          {posts.map((post) => {
            const { content } = resolveBlogLocale(post, locale);
            return (
              <li key={post.slug} className="mx-auto w-full max-w-[min(42.5rem,calc(100vw-2rem))]">
                <article className="border-b border-black/[0.08] pb-6 sm:pb-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ca3af]">
                    <span>{post.category}</span>
                    <span className="mx-2 text-[#d1d5db]">·</span>
                    <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
                  </p>
                  <h2 className="mt-2 text-balance text-[1.25rem] font-semibold tracking-tight text-[#111827] sm:text-[1.5rem]">
                    <Link
                      href={blogPostHref(post.slug)}
                      className="text-inherit no-underline transition hover:text-provin-accent"
                    >
                      {content.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-[#4b5563]">{content.excerpt}</p>
                  <Link
                    href={blogPostHref(post.slug)}
                    className="mt-4 inline-flex text-[11px] font-semibold uppercase tracking-[0.18em] text-provin-accent no-underline transition hover:text-[#111827]"
                  >
                    {t("readMore")}
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
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
