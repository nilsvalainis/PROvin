import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listBlogPosts, resolveBlogLocale } from "@/lib/blog/posts";
import { homeContentMaxClass } from "@/lib/home-layout";

export async function RelatedBlogLinks() {
  const locale = await getLocale();
  const t = await getTranslations("VinCheck");
  let posts: Awaited<ReturnType<typeof listBlogPosts>> = [];
  try {
    posts = await listBlogPosts();
  } catch {
    posts = [];
  }
  if (posts.length === 0) return null;

  return (
    <nav
      aria-label={t("relatedPostsTitle")}
      className="home-body-ink bg-transparent px-4 pb-10 sm:px-6 sm:pb-12"
    >
      <div className={homeContentMaxClass}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
          {t("relatedPostsTitle")}
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {posts.slice(0, 3).map((post) => {
            const { content } = resolveBlogLocale(post, locale);
            return (
              <li key={post.slug}>
                <Link
                  href={`/blogs/${post.slug}`}
                  className="text-sm font-medium text-white/70 no-underline transition hover:text-provin-accent"
                >
                  {content.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
