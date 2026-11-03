import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BlogTypeCover } from "@/components/blog/BlogTypeCover";
import { b2bDateLocale } from "@/i18n/locales";
import { blogPostHref, listBlogPosts, resolveBlogLocale } from "@/lib/blog/posts";

/** Par PROVIN beigās: 2 jaunākie bloga ieraksti (iekšējās saites SEO). */
export async function AboutBlogTeaser({ locale }: { locale: string }) {
  const t = await getTranslations("Iriss");
  const posts = (await listBlogPosts()).slice(0, 2);
  if (posts.length === 0) return null;
  return (
    <section className="mx-auto mt-24 w-full max-w-[75rem] px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:mt-28 lg:px-10">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5c9dff]">{t("fromBlog")}</h2>
        <Link href="/blogs" className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#5c9dff] no-underline hover:text-white">
          {t("allPosts")}
        </Link>
      </div>
      <div className="mt-[22px] grid gap-6 sm:grid-cols-2">
        {posts.map((post) => {
          const { content } = resolveBlogLocale(post, locale);
          const d = new Date(`${post.publishedAt}T12:00:00`);
          const date = Number.isNaN(d.getTime())
            ? post.publishedAt
            : d.toLocaleDateString(b2bDateLocale(locale), { year: "numeric", month: "long", day: "numeric" });
          return (
            <Link key={post.slug} href={blogPostHref(post.slug)} className="blog-mini block text-inherit no-underline">
              <BlogTypeCover slug={post.slug} title={content.title} className="!aspect-[16/7]" />
              <p className="mt-4 flex gap-3.5 text-[11px] font-extrabold uppercase tracking-[0.16em]">
                <span className="text-[#5c9dff]">{post.category}</span>
                <time dateTime={post.publishedAt} className="text-zinc-500">{date}</time>
              </p>
              <h3 className="mt-2.5 text-[19px] font-bold leading-[1.3] tracking-[-0.01em] text-white transition-colors">{content.title}</h3>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
