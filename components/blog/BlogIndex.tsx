import { getTranslations } from "next-intl/server";
import { getIrissSocialUrls, IrissSocialIcons } from "@/components/IrissSocialIcons";
import { Link } from "@/i18n/navigation";
import { BlogTypeCover } from "@/components/blog/BlogTypeCover";
import { BlogRowsFx } from "@/components/blog/BlogRowsFx";
import { b2bDateLocale } from "@/i18n/locales";
import { blogPostHref, listBlogPosts, resolveBlogLocale } from "@/lib/blog/posts";

type Props = { locale: string };

export async function BlogIndex({ locale }: Props) {
  const t = await getTranslations("Blogs");
  const tIriss = await getTranslations("Iriss");
  const social = getIrissSocialUrls();
  const posts = await listBlogPosts();

  return (
    <section id="blogs" className="home-body-ink relative scroll-mt-16 bg-transparent px-4 pb-16 pt-10 sm:pb-20 sm:pt-12">
      <div className="demo-design-dir__shell relative mx-auto w-full max-w-[min(100%,80rem)] px-1 sm:px-2">
        <header className="mx-auto max-w-[min(42.5rem,calc(100vw-2rem))] text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5c9dff]">
            {t("sermonTitle")}
          </p>
          <h1 className="mt-3.5 text-[clamp(2.5rem,5vw,4rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-white [text-wrap:balance]">{t("indexH1")}</h1>
                    <p className="mx-auto mt-4 max-w-[min(100%,40rem)] text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45 sm:mt-5 sm:text-[12px]">
            {tIriss("pageLead")}
          </p>
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

        <BlogRowsFx>
          <ul className="mx-auto mt-16 flex max-w-[75rem] list-none flex-col gap-16 p-0 sm:mt-24 sm:gap-[110px]">
            {posts.map((post, i) => {
              const { content } = resolveBlogLocale(post, locale);
              return (
                <li key={post.slug}>
                  <article>
                    <Link
                      href={blogPostHref(post.slug)}
                      className={`blog-row grid items-center gap-[22px] text-inherit no-underline [perspective:1200px] lg:gap-16 ${
                        i % 2 ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
                      }`}
                    >
                      <BlogTypeCover slug={post.slug} title={content.title} className={`blog-row__cover ${i % 2 ? "lg:order-2" : ""}`} />
                      <div className="blog-row__text">
                        <p className="flex flex-wrap gap-3.5 text-[11px] font-extrabold uppercase tracking-[0.16em]">
                          <span className="text-[#5c9dff]">{post.category}</span>
                          <time dateTime={post.publishedAt} className="text-zinc-500">
                            {formatPostDate(post.publishedAt, locale)}
                          </time>
                        </p>
                        <h2 className="blog-row__title mt-4 text-[clamp(1.6rem,3vw,2.5rem)] font-bold leading-[1.15] tracking-[-0.03em] text-white [text-wrap:balance]">
                          {content.title.split(/(\s+)/).map((w, k) => (/\s+/.test(w) ? w : <span key={k} className="blog-w">{w}</span>))}
                        </h2>
                        <p className="mt-3.5 max-w-[560px] text-[16.5px] leading-[1.65] text-zinc-500">{content.excerpt}</p>
                        <span className="blog-row__more mt-[22px] inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-white">
                          {t("readMore")}
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </span>
                      </div>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        </BlogRowsFx>
      </div>
    </section>
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
