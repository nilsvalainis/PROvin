import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { CreateBlogPostButton } from "@/components/admin/CreateBlogPostButton";
import { countBlogComments } from "@/lib/blog/comment-store";
import { listStoredBlogPosts } from "@/lib/blog/post-store";
import { getBlogViewCounts } from "@/lib/blog/view-store";

export const metadata = {
  title: "Blogs",
};

export const dynamic = "force-dynamic";

export default async function AdminBlogsPage() {
  const posts = await listStoredBlogPosts();
  const [viewCounts, commentCountEntries] = await Promise.all([
    getBlogViewCounts(),
    Promise.all(
      posts.map(async (post) => [post.slug, await countBlogComments(post.slug)] as const),
    ),
  ]);
  const commentCounts = Object.fromEntries(commentCountEntries) as Record<string, number>;

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          PRO
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Blogs
        </h1>
        <p className="mt-2 w-full max-w-none text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          Manuāli pārvaldi IRISS ierakstus: teksti, kategorijas, birkas un komentāri. Sarakstā — skatījumi
          un komentāru skaits.
        </p>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6">
        <CreateBlogPostButton />
      </div>

      {posts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Vēl nav ierakstu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Spied „Jauns ieraksts”, lai sāktu.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
                  <th className="px-4 py-3.5">Datums</th>
                  <th className="px-4 py-3.5">Virsraksts</th>
                  <th className="px-4 py-3.5">Kategorija</th>
                  <th className="px-4 py-3.5 text-right tabular-nums">Skatījumi</th>
                  <th className="px-4 py-3.5 text-right tabular-nums">Komentāri</th>
                  <th className="px-4 py-3.5 text-right">Darbība</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posts.map((post) => (
                  <tr key={post.slug} className="transition-colors hover:bg-slate-50/90">
                    <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-[var(--color-apple-text)]">
                      {post.publishedAt}
                    </td>
                    <td className="max-w-[360px] px-4 py-3.5 font-medium text-[var(--color-apple-text)]">
                      <span className="line-clamp-2">{post.lv.title}</span>
                      <span className="mt-0.5 block text-[11px] font-normal text-[var(--color-provin-muted)]">
                        /blogs/{post.slug}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-apple-text)]">
                      {post.category}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-[var(--color-apple-text)]">
                      {viewCounts[post.slug] ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-[var(--color-apple-text)]">
                      {commentCounts[post.slug] ?? 0}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/blogs/${encodeURIComponent(post.slug)}`}
                        className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] hover:shadow-md"
                      >
                        Rediģēt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
