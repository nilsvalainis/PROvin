import { getTranslations } from "next-intl/server";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { getIrissSocialUrls, IrissSocialIcons } from "@/components/IrissSocialIcons";
import { Link } from "@/i18n/navigation";
import { blogPostHref, listBlogPosts, resolveBlogLocale } from "@/lib/blog/posts";
import { homeEditorialSectionBodyLeadClass } from "@/lib/home-layout";

type Props = { locale: string };

export async function BlogIndex({ locale }: Props) {
  const t = await getTranslations("Blogs");
  const tIriss = await getTranslations("Iriss");
  const social = getIrissSocialUrls();
  const posts = listBlogPosts();

  return (
    <section id="blogs" className="home-body-ink relative scroll-mt-16 bg-transparent px-4 pb-16 pt-10 sm:pb-20 sm:pt-12">
      <div className="demo-design-dir__shell relative mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
        <header className="mx-auto max-w-[min(42.5rem,calc(100vw-2rem))] text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-provin-accent/90">
            {tIriss("pageLead")}
          </p>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,28rem)]">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <div className={`${homeEditorialSectionBodyLeadClass} space-y-3 text-left sm:text-center`}>
            {t("intro")
              .split("\n")
              .filter(Boolean)
              .map((line) => (
                <p key={line.slice(0, 24)}>{line}</p>
              ))}
          </div>
          <div className="mt-6 flex justify-center sm:mt-7">
            <IrissSocialIcons
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
                <article className="border-b border-white/[0.08] pb-6 sm:pb-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    <span>{post.category}</span>
                    <span className="mx-2 text-white/20">·</span>
                    <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
                  </p>
                  <h2 className="mt-2 text-balance text-[1.25rem] font-semibold tracking-tight text-white/[0.96] sm:text-[1.5rem]">
                    <Link
                      href={blogPostHref(post.slug)}
                      className="text-inherit no-underline transition hover:text-white"
                    >
                      {content.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-[rgb(200_205_215/0.78)]">
                    {content.excerpt}
                  </p>
                  <Link
                    href={blogPostHref(post.slug)}
                    className="mt-4 inline-flex text-[11px] font-semibold uppercase tracking-[0.18em] text-provin-accent no-underline transition hover:text-white"
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
