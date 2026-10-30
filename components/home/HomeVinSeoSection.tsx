import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FreeEvalHashLink } from "@/components/home/FreeEvalHashLink";
import { listBlogPosts, resolveBlogLocale } from "@/lib/blog/posts";
import { faqPageHref, pakalpojumiHref, vinCheckHref } from "@/lib/paths";

function Arrow() {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-[#5c9dff] transition group-hover:border-[#5c9dff]"
    >
      →
    </span>
  );
}

/** Sākumlapas SEO bloks + raksti no bloga (makets «Pilna lapa»; teksts tas pats). */
export async function HomeVinSeoSection() {
  const t = await getTranslations("VinCheck");
  const locale = await getLocale();
  let posts: Awaited<ReturnType<typeof listBlogPosts>> = [];
  try {
    posts = await listBlogPosts();
  } catch {
    posts = [];
  }
  const links: Array<[string, string]> = [
    [vinCheckHref(), t("homeCta")],
    [pakalpojumiHref(), t("ctaServices")],
    [faqPageHref(), t("ctaFaq")],
  ];

  return (
    <section id="vin-koda-parbaude" aria-labelledby="home-vin-seo-heading" className="home-body-ink scroll-mt-16 bg-transparent">
      <div className="mx-auto flex max-w-[80rem] flex-col gap-12 px-[max(1rem,env(safe-area-inset-left,0px))] py-16 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:gap-14 sm:py-24 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-16">
          <div className="lg:col-span-7">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#5c9dff]">{t("homeEyebrow")}</p>
            <h2
              id="home-vin-seo-heading"
              className="mt-3.5 text-balance text-[2.2rem] font-extrabold leading-[1.05] tracking-[-0.035em] text-zinc-50 sm:text-[3rem]"
            >
              {t("homeTitle")}
            </h2>
            <p className="mt-5 max-w-[60ch] text-pretty text-[1.05rem] leading-[1.65] text-zinc-300 sm:text-lg">
              {t.rich("homeBody", {
                freeEval: (chunks) => (
                  <FreeEvalHashLink className="text-[#5c9dff] underline decoration-[#5c9dff]/40 underline-offset-[3px] transition hover:text-white">
                    {chunks}
                  </FreeEvalHashLink>
                ),
              })}
            </p>
          </div>
          <nav aria-label={t("homeTitle")} className="flex flex-col border-t border-[#262a36] lg:col-span-5">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center justify-between gap-4 border-b border-[#262a36] py-5 text-[1.1rem] font-semibold text-zinc-50 no-underline transition hover:text-[#5c9dff]"
              >
                {label}
                <Arrow />
              </Link>
            ))}
          </nav>
        </div>

        {posts.length > 0 ? (
          <nav aria-label={t("relatedPostsTitle")} className="flex flex-col gap-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{t("relatedPostsTitle")}</p>
            <div className="grid gap-4 md:grid-cols-2 md:gap-5">
              {posts.slice(0, 2).map((post) => {
                const { content } = resolveBlogLocale(post, locale);
                return (
                  <Link
                    key={post.slug}
                    href={`/blogs/${post.slug}`}
                    className="group flex flex-col gap-4 rounded-[20px] border border-white/[0.09] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-6 no-underline transition hover:border-white/20 sm:p-8"
                  >
                    <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-zinc-400">{t("blogKicker")}</span>
                    <span className="flex-1 text-balance text-[1.3rem] font-bold leading-snug tracking-[-0.02em] text-zinc-50 sm:text-[1.55rem]">
                      {content.title}
                    </span>
                    <span className="text-sm font-semibold text-[#5c9dff]">{t("readPost")} →</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
