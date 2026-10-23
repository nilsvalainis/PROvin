import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { irissOfferDeadlinesByOfferId } from "@/lib/iriss-offer-client-link";
import { readIrissOfferClientLinksForOrder } from "@/lib/iriss-offer-client-link-store";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: noStore });
  const order = await readIrissPasutijums(id);
  const links = await readIrissOfferClientLinksForOrder(id, {
    deadlines: irissOfferDeadlinesByOfferId(order?.offers ?? []),
  });
  return NextResponse.json({ links }, { headers: noStore });
}
