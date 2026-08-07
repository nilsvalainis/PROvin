import { notFound } from "next/navigation";
import { AdminBlogPostEditor } from "@/components/admin/AdminBlogPostEditor";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { listAdminBlogComments } from "@/lib/blog/comment-store";
import { getStoredBlogPost, normalizeBlogSlug } from "@/lib/blog/post-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getStoredBlogPost(slug);
  return { title: post ? `Blogs · ${post.lv.title}` : "Blogs" };
}

export default async function AdminBlogPostPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = normalizeBlogSlug(decodeURIComponent(raw));
  const post = await getStoredBlogPost(slug);
  if (!post) notFound();
  const comments = await listAdminBlogComments(post.slug);

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Blogs
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          {post.lv.title}
        </h1>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6">
        <AdminBlogPostEditor initialPost={post} initialComments={comments} />
      </div>
    </div>
  );
}
