import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { addIrissOfferToOrder } from "@/lib/iriss-offer-add";
import { isSafeIrissPasutijumsId } from "@/lib/iriss-pasutijumi-store";
import { parseIrissOfferFromBody } from "@/lib/iriss-pasutijumi-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const noStore = { "Cache-Control": "private, no-store" };

/** POST { offer } - pievieno jaunu piedāvājumu klienta pasūtījumam (no formas "Klients ▾"). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: noStore });
  let body: { offer?: unknown };
  try {
    body = (await req.json()) as { offer?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }
  const offer = parseIrissOfferFromBody(body.offer, 0);
  if (!offer) return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  const res = await addIrissOfferToOrder(id, offer);
  if (!res.ok) {
    const status = res.error === "not_found" ? 404 : res.error === "exists" ? 409 : res.error === "store_failed" ? 503 : 400;
    return NextResponse.json({ error: res.error }, { status, headers: noStore });
  }
  return NextResponse.json({ orderId: id, offerId: res.offerId }, { headers: noStore });
}
