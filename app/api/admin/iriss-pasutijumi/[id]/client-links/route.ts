import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readIrissOfferClientLinksForOrder } from "@/lib/iriss-offer-client-link-store";
import { isSafeIrissPasutijumsId } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: noStore });
  const links = await readIrissOfferClientLinksForOrder(id);
  return NextResponse.json({ links }, { headers: noStore });
}
