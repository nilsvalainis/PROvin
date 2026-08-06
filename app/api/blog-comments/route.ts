import { NextResponse } from "next/server";
import { appendBlogComment, listPublicBlogComments } from "@/lib/blog/comment-store";
import { getBlogPost } from "@/lib/blog/posts";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const MAX_PER_WINDOW = 8;
const WINDOW_MS = 15 * 60 * 1000;

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = (searchParams.get("slug") ?? "").trim().toLowerCase();
  if (!slug || !getBlogPost(slug)) {
    return badRequest("Unknown post.", 404);
  }
  const comments = await listPublicBlogComments(slug);
  return NextResponse.json({ comments });
}

export async function POST(request: Request) {
  const ip = getClientIpFromRequest(request) ?? "unknown";
  const limited = checkRateLimit(`blog-comment:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!limited.ok) {
    return badRequest("Too many comments. Try again later.", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON.");
  }

  if (!body || typeof body !== "object") return badRequest("Invalid body.");
  const b = body as Record<string, unknown>;

  /* Honeypot — bots fill this; humans leave empty. */
  if (typeof b.website === "string" && b.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";
  const authorName = typeof b.authorName === "string" ? b.authorName.trim() : "";
  const text = typeof b.body === "string" ? b.body.trim() : "";

  if (!slug || !getBlogPost(slug)) return badRequest("Unknown post.", 404);
  if (authorName.length < 2) return badRequest("Name is too short.");
  if (authorName.length > 80) return badRequest("Name is too long.");
  if (text.length < 2) return badRequest("Comment is too short.");
  if (text.length > 4000) return badRequest("Comment is too long.");

  const comment = await appendBlogComment({ slug, authorName, body: text });
  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
