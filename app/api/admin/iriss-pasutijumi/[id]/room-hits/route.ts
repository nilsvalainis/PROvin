import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { readIrissOrderRoomHitsForOrder } from "@/lib/iriss-order-room-hits-read";
import { isSafeIrissPasutijumsId } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const hits = await readIrissOrderRoomHitsForOrder(id);
  return NextResponse.json({ ok: true, hits });
}
