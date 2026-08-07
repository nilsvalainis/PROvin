import { NextResponse } from "next/server";
import { getBlogPost, normalizeBlogSlug } from "@/lib/blog/posts";
import { incrementBlogView } from "@/lib/blog/view-store";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

const MAX_PER_WINDOW = 40;
const WINDOW_MS = 10 * 60 * 1000;

/** Publisks: +1 pie bloga ieraksta lasījuma (bez PII). */
export async function POST(req: Request) {
  let slug = "";
  try {
    const body = (await req.json()) as { slug?: unknown };
    slug = typeof body.slug === "string" ? normalizeBlogSlug(body.slug) : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (!slug) {
    return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });
  }

  const post = await getBlogPost(slug);
  if (!post) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`blog-view:${ip}:${slug}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  try {
    const entry = await incrementBlogView(slug);
    return NextResponse.json({ ok: true, views: entry.views });
  } catch {
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Izmanto POST, lai reģistrētu skatījumu." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
