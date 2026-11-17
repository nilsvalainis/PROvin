import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { businessLinkAbsoluteUrl, normalizeBusinessLinkAdminInput } from "@/lib/business-link";
import { createBusinessLink } from "@/lib/business-link-store";
import { newClientLinkToken } from "@/lib/client-link-crypto";
import { getPublicSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function origin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() ? getPublicSiteOrigin() : "http://localhost:3040";
}

/** Admin: jauna PROVIN Business 69,99 € saite. Summa netiek pieņemta no ievades. */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const input = normalizeBusinessLinkAdminInput(body && typeof body === "object" ? (body as object) : {});
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  const token = newClientLinkToken();
  const created = await createBusinessLink(token, input);
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.error === "store_failed" ? 503 : 400 });
  }
  return NextResponse.json({
    id: created.record.tokenHash,
    url: businessLinkAbsoluteUrl(origin(), token),
    expiresAt: created.record.expiresAt,
  });
}
