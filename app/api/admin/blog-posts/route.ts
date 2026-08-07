import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  deleteStoredBlogPost,
  emptyBlogPostDraft,
  listStoredBlogPosts,
  normalizeBlogSlug,
  upsertStoredBlogPost,
} from "@/lib/blog/post-store";
import { clearBlogComments } from "@/lib/blog/comment-store";
import type { BlogPost } from "@/lib/blog/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const posts = await listStoredBlogPosts();
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = typeof b.title === "string" && b.title.trim() ? b.title.trim() : "Jauns ieraksts";
  const slugFromBody = typeof b.slug === "string" ? normalizeBlogSlug(b.slug) : "";
  const slug =
    slugFromBody ||
    normalizeBlogSlug(title) ||
    `jauns-ieraksts-${Date.now()}`;

  const existing = await listStoredBlogPosts();
  if (existing.some((p) => p.slug === slug)) {
    return NextResponse.json({ error: "Slug jau aizņemts." }, { status: 409 });
  }

  const draft = emptyBlogPostDraft({
    slug,
    lv: { title, excerpt: "", body: [{ type: "p", text: "" }] },
  });
  const post = await upsertStoredBlogPost(draft);
  return NextResponse.json({ ok: true, post }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const post = await upsertStoredBlogPost(body as BlogPost);
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Neizdevās saglabāt." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const slug = normalizeBlogSlug(searchParams.get("slug") ?? "");
  if (!slug) return NextResponse.json({ error: "Trūkst slug." }, { status: 400 });

  const ok = await deleteStoredBlogPost(slug);
  if (!ok) return NextResponse.json({ error: "Nav atrasts." }, { status: 404 });
  try {
    await clearBlogComments(slug);
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true });
}
