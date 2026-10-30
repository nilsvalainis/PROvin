import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { irissAuctionLinkSupported, parseIrissAuctionLink, type IrissAuctionLinkPlatform } from "@/lib/iriss-auction-link";
import { findIrissOrderRoomHitForAuctionLink } from "@/lib/iriss-auction-link-read";
import { irissAuctionDetailToSeed, mergeListedIntoDetailHit } from "@/lib/iriss-auction-detail";
import { fetchIrissAuctionDetailViaRelay } from "@/lib/iriss-auction-detail-relay";
import { fetchIrissRelayHealth, readIrissRelayConfig, relayPlatformFor } from "@/lib/iriss-listings-relay";

export const runtime = "nodejs";
// Releja detaļu lapa (B): pārlūks + cilnes var aizņemt līdz ~2 min.
export const maxDuration = 180;

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
 * B: `mode: "detail"` - relejs nolasa pašu detaļu lapu -> hit + papildlauki (atslēgas, TA, emisija u.c.).
 * Klients vispirms prasa "listing" (ātri), tad "detail"; ja detaļu lapa neizdodas, paliek A dati.
 */
export async function POST(req: Request) {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  let raw = "";
  let mode: "listing" | "detail" | "diag" = "listing";
  try {
    const body = (await req.json()) as { url?: unknown; mode?: unknown };
    raw = typeof body.url === "string" ? body.url : "";
    if (body.mode === "detail") mode = "detail";
    // Diagnostika (tikai admins): ko relejs redz detaļu lapā - lai saprastu, kāpēc kāds bloks netiek ielasīts.
    if (body.mode === "diag" && gate.actor.kind === "admin") mode = "diag";
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: noStore });
  }
  const link = parseIrissAuctionLink(raw);
  if (!link) return NextResponse.json({ error: "not_auction_link" }, { status: 400, headers: noStore });
  if (!irissAuctionLinkSupported(link.platform)) {
    return NextResponse.json({ error: "platform_unsupported", platform: link.platform satisfies IrissAuctionLinkPlatform }, { status: 422, headers: noStore });
  }
  const listed = await findIrissOrderRoomHitForAuctionLink(link).catch(() => null);
  if (mode === "listing") {
    if (listed) return NextResponse.json({ ok: true, source: "listing", hit: listed }, { headers: noStore });
    return NextResponse.json({ ok: false, error: "not_in_listings", platform: link.platform }, { status: 404, headers: noStore });
  }
  const relay = await fetchIrissAuctionDetailViaRelay(link);
  if (!relay.ok) return NextResponse.json({ ok: false, error: relay.error, note: relay.note, platform: link.platform }, { status: 502, headers: noStore });
  if (mode === "diag") {
    const d = relay.detail;
    const um = [...(d.text ?? "").matchAll(/.{0,60}\d{2,4}\s?(?:µm|μm|um)\b.{0,30}/gi)].map((m) => m[0]).slice(0, 30);
    return NextResponse.json(
      {
        ok: true,
        fields: (d.fields ?? []).slice(0, 120),
        lists: (d.lists ?? []).map((l) => ({ heading: l.heading, count: l.items.length, first: l.items.slice(0, 3) })),
        tables: (d.tables ?? []).length,
        jsonPaint: (d.jsonFields ?? []).filter(([k]) => /paint|thick|lack|coat|layer/i.test(k)).slice(0, 80),
        jsonKeys: [...new Set((d.jsonFields ?? []).map(([k]) => k.split(/[.[]/)[0]))].slice(0, 80),
        textUm: um,
        textLength: (d.text ?? "").length,
      },
      { headers: noStore },
    );
  }
  const { hit, extras } = irissAuctionDetailToSeed(relay.detail, link);
  // Saraksta dati aizpilda to, ko detaļu lapa nedeva (piem. cenas, izsoles beigas).
  return NextResponse.json({ ok: true, source: "detail", hit: listed ? mergeListedIntoDetailHit(hit, listed) : hit, extras }, { headers: noStore });
}
