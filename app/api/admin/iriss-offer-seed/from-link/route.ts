import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { irissAuctionLinkSupported, parseIrissAuctionLink, type IrissAuctionLinkPlatform } from "@/lib/iriss-auction-link";
import { findIrissOrderRoomHitForAuctionLink } from "@/lib/iriss-auction-link-read";
import { fetchIrissRelayHealth, readIrissRelayConfig, relayPlatformFor } from "@/lib/iriss-listings-relay";

export const runtime = "nodejs";
export const maxDuration = 60;

const noStore = { "Cache-Control": "private, no-store" };

/**
 * j56 "No saites": GET ?platform=auto1|openline - releja sesijas stāvoklis (tas pats, ko rāda IRISS Saraksti).
 * Paroles un tokeni netiek atgriezti; health ir releja publiskais ceļš.
 */
export async function GET(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  const platform = new URL(req.url).searchParams.get("platform") ?? "";
  if (platform !== "auto1" && platform !== "openline") return NextResponse.json({ session: "unknown" }, { headers: noStore });
  const cfg = readIrissRelayConfig();
  if (!cfg) return NextResponse.json({ session: "not_configured" }, { headers: noStore });
  const health = await fetchIrissRelayHealth(cfg, { timeoutMs: 6_000 });
  if (!health.reachable) return NextResponse.json({ session: "unreachable" }, { headers: noStore });
  const session = health.platforms[relayPlatformFor(platform)]?.session ?? "unknown";
  return NextResponse.json({ session }, { headers: noStore });
}

/**
 * POST { url } - ielīmēta Auto1/Openlane detaļu saite -> piedāvājuma sākuma dati.
 * A: auto jau ir IRISS sarakstos -> tas pats hit, ko lieto "Sagatavot piedāvājumu" (lauki, foto izsoles secībā).
 */
export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  let raw = "";
  try {
    const body = (await req.json()) as { url?: unknown };
    raw = typeof body.url === "string" ? body.url : "";
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }
  const link = parseIrissAuctionLink(raw);
  if (!link) return NextResponse.json({ error: "not_auction_link" }, { status: 400, headers: noStore });
  if (!irissAuctionLinkSupported(link.platform)) {
    return NextResponse.json({ error: "platform_unsupported", platform: link.platform satisfies IrissAuctionLinkPlatform }, { status: 422, headers: noStore });
  }
  const hit = await findIrissOrderRoomHitForAuctionLink(link).catch(() => null);
  if (hit) return NextResponse.json({ ok: true, source: "listing", hit }, { headers: noStore });
  return NextResponse.json({ ok: false, error: "not_in_listings", platform: link.platform }, { status: 404, headers: noStore });
}
