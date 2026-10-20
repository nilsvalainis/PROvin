import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readIrissListingsLatestViewWithMarketplace } from "@/lib/marketplace/view";
import { isEcarstradeNoPriceNoBid } from "@/lib/iriss-listing-order-gate";
import { runIrissListingsOrderLinkSync } from "@/lib/iriss-listings-sync";
import { orderRoomMatchProps, prepareIrissListingMatchWorkspace } from "@/lib/iriss-listing-match-store";
import { buildIrissOrderRoomHits } from "@/lib/iriss-order-room";
import { isAllowedListingSourceUrl } from "@/lib/iriss-listings-platform";
import { isSafeIrissPasutijumsId, readIrissListingOrderOv, readIrissPasutijums } from "@/lib/iriss-pasutijumi-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  let sourceUrl = "";
  try {
    const body = (await req.json()) as { sourceUrl?: unknown };
    sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!sourceUrl) return NextResponse.json({ error: "missing_url" }, { status: 400 });
  if (!isAllowedListingSourceUrl(sourceUrl)) {
    return NextResponse.json({ error: "url_not_allowed" }, { status: 400 });
  }

  const out = await runIrissListingsOrderLinkSync({ orderId: id, sourceUrl });
  const rec = await readIrissPasutijums(id);
  const latest = await readIrissListingsLatestViewWithMarketplace();
  const listable = (latest?.vehicles ?? []).filter((v) => !isEcarstradeNoPriceNoBid(v));
  const orderOv = await readIrissListingOrderOv().catch(() => ({}));
  const match = await prepareIrissListingMatchWorkspace(listable, []).catch(() => null);
  const roomMatch = match ? orderRoomMatchProps(match.state, id, match.duplicatesByListing) : null;
  const hits = rec
    ? buildIrissOrderRoomHits(
        listable,
        id,
        orderOv,
        roomMatch ? new Set(roomMatch.extraListingIds) : undefined,
        rec.brandModel ?? "",
      )
    : [];

  return NextResponse.json({
    ok: out.ok,
    status: out.status,
    note: out.note,
    vehicleCount: out.vehicleCount,
    newCount: out.newCount,
    warnings: out.warnings,
    hits,
  });
}
