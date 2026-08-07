import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteBlogComment, listAdminBlogComments } from "@/lib/blog/comment-store";
import { getStoredBlogPost, normalizeBlogSlug } from "@/lib/blog/post-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = normalizeBlogSlug(new URL(request.url).searchParams.get("slug") ?? "");
  if (!slug || !(await getStoredBlogPost(slug))) {
    return NextResponse.json({ error: "Unknown post." }, { status: 404 });
  }
  const comments = await listAdminBlogComments(slug);
  return NextResponse.json({ comments });
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const slug = normalizeBlogSlug(searchParams.get("slug") ?? "");
  const id = (searchParams.get("id") ?? "").trim();
  if (!slug || !id) {
    return NextResponse.json({ error: "Trūkst slug vai id." }, { status: 400 });
  }

  const ok = await deleteBlogComment(slug, id);
  if (!ok) return NextResponse.json({ error: "Komentārs nav atrasts." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
