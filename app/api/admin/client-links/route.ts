import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { newClientLinkToken } from "@/lib/client-link-crypto";
import {
  clientLinkAbsoluteUrl,
  isSafeClientLinkToken,
  normalizeClientLinkAdminInput,
} from "@/lib/client-link";
import { createClientLink, updateClientLink } from "@/lib/client-link-store";
import { getPublicSiteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function origin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() ? getPublicSiteOrigin() : "http://localhost:3040";
}

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
  const input = normalizeClientLinkAdminInput(body && typeof body === "object" ? (body as object) : {});
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  const token = newClientLinkToken();
  const created = await createClientLink(token, input);
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.error === "store_failed" ? 503 : 400 });
  }
  return NextResponse.json({
    id: created.record.tokenHash,
    token,
    url: clientLinkAbsoluteUrl(origin(), token),
    expiresAt: created.record.expiresAt,
    record: created.record,
  });
}

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{64}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const tokenHint = typeof body.token === "string" && isSafeClientLinkToken(body.token) ? body.token.trim() : "";
  const input = normalizeClientLinkAdminInput(body);
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  const updated = await updateClientLink(id, input);
  if (!updated.ok) {
    const status = updated.error === "not_found" ? 404 : updated.error === "already_paid" ? 409 : updated.error === "store_failed" ? 503 : 400;
    return NextResponse.json({ error: updated.error }, { status });
  }
  return NextResponse.json({
    id: updated.record.tokenHash,
    ...(tokenHint ? { url: clientLinkAbsoluteUrl(origin(), tokenHint) } : {}),
    expiresAt: updated.record.expiresAt,
    record: updated.record,
  });
}
