import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import {
  isIrissOfferLinkEntityId,
  parseIrissOfferLinkExpiryDays,
  toIrissOfferClientLinkAdminView,
} from "@/lib/iriss-offer-client-link";
import { createIrissOfferClientLink, revokeIrissOfferClientLink } from "@/lib/iriss-offer-client-link-store";
import { isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { isSafeIrissPasutijumsId, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(req: Request, ctx: { params: Promise<{ id: string; offerId: string }> }) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const { id, offerId } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id) || !isIrissOfferLinkEntityId(offerId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: noStore });
  }
  let body: { action?: unknown; expiresInDays?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; expiresInDays?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  }
  const order = await readIrissPasutijums(id);
  if (!order || isIrissRecordDeleted(order) || !order.offers.some((offer) => offer.id === offerId)) {
    return NextResponse.json({ error: "save_first" }, { status: 409, headers: noStore });
  }
  if (body.action === "revoke") {
    const revoked = await revokeIrissOfferClientLink(id, offerId);
    if (!revoked.ok) return NextResponse.json({ error: revoked.error }, { status: revoked.error === "not_found" ? 404 : 503, headers: noStore });
    return NextResponse.json({ link: toIrissOfferClientLinkAdminView(revoked.record) }, { headers: noStore });
  }
  if (body.action !== "create") return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  const days = parseIrissOfferLinkExpiryDays(body.expiresInDays);
  if (days === "invalid") return NextResponse.json({ error: "invalid" }, { status: 400, headers: noStore });
  const created = await createIrissOfferClientLink({ orderId: id, offerId, expiresInDays: days });
  if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.error === "invalid" ? 400 : 503, headers: noStore });
  return NextResponse.json({ link: toIrissOfferClientLinkAdminView(created.record) }, { headers: noStore });
}
