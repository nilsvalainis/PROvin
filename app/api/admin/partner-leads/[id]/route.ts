import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { setB2bPartnerLeadHandled } from "@/lib/b2b-partner-lead-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^lead_[a-z0-9_]{4,60}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const ok = await setB2bPartnerLeadHandled(id, raw.handled === true);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
