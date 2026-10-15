import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSafeIrissPasutijumsId, restoreIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const r = await restoreIrissPasutijums(id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : 500 });
  return NextResponse.json({ ok: true, record: r.record });
}
