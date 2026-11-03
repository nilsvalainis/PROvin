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
    <nav aria-label={t("relatedPostsTitle")} className="home-body-ink bg-transparent px-4 pb-12 sm:px-6 sm:pb-16">
      <div className={`${homeContentMaxClass} svc-blog`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">{t("relatedPostsTitle")}</p>
        <ul className="mt-3 flex flex-col">
          {posts.slice(0, 3).map((post) => {
            const { content } = resolveBlogLocale(post, locale);
            return (
              <li key={post.slug}>
                <Link href={`/blogs/${post.slug}`}>
                  <span>{content.title}</span>
                  <em aria-hidden>→</em>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
