import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteIrissScan, isSafeIrissScanId, readIrissScan, writeIrissScan } from "@/lib/iriss-scan-store";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export const runtime = "nodejs";

function parseOtherFromBody(o: Record<string, unknown>): string[] {
  const v = o.listingLinksOther;
  if (!Array.isArray(v)) return [""];
  return v.map((x) => (typeof x === "string" ? x : "")).slice(0, 20);
}

function parseBodyRecord(id: string, body: unknown): IrissScanRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    id,
    createdAt: str("createdAt"),
    updatedAt: str("updatedAt"),
    pinnedAt: str("pinnedAt"),
    brandModel: str("brandModel"),
    listingLinkMobile: str("listingLinkMobile"),
    listingLinkAutobid: str("listingLinkAutobid"),
    listingLinkOpenline: str("listingLinkOpenline"),
    listingLinkAuto1: str("listingLinkAuto1"),
    listingLinksOther: parseOtherFromBody(o),
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissScan(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ record: rec });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rec = parseBodyRecord(id, body);
  if (!rec) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const w = await writeIrissScan(rec);
  if (!w.ok) return NextResponse.json({ error: w.error }, { status: 500 });
  const saved = await readIrissScan(id);
  return NextResponse.json({ ok: true, record: saved });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissScanId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const d = await deleteIrissScan(id);
  if (!d.ok) return NextResponse.json({ error: d.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
