import { NextResponse } from "next/server";
import { b2bDemoErrorResponse, requireB2bDemoActor } from "@/lib/b2b-demo-api";
import {
  B2bDemoAuctionSessionError,
  auctionSessionStatus,
  encryptB2bDemoAuctionSession,
  parseAuctionSessionWrite,
} from "@/lib/b2b-demo-auction-crypto";
import { canB2bDemoAccessIrissOwnSessions } from "@/lib/b2b-demo-paths";
import { resolveB2bDemoWrapSecret } from "@/lib/b2b-demo-session-token";
import {
  clearB2bDemoAuctionSession,
  listB2bDemoAuctionSessions,
  upsertB2bDemoAuctionSession,
} from "@/lib/b2b-demo-store";
import { B2B_DEMO_AUCTION_PLATFORMS, isB2bDemoAuctionPlatform } from "@/lib/b2b-demo-types";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const tenantId = gate.actor.session.tenantId;
  const rows = await listB2bDemoAuctionSessions(tenantId);
  const items = B2B_DEMO_AUCTION_PLATFORMS.map((platform) =>
    auctionSessionStatus(rows.find((r) => r.platform === platform) ?? null, tenantId, platform),
  );
  return NextResponse.json({
    items,
    irissOwnSessionsAccessible: canB2bDemoAccessIrissOwnSessions(),
    note: "Paroles netiek glabātas. Dīleris ielogojas pats izolētā pārlūkā; šeit paliek tikai šifrēta sesija.",
  });
}

export async function POST(req: Request) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  try {
    const parsed = parseAuctionSessionWrite(body);
    const wrap = resolveB2bDemoWrapSecret();
    if (!wrap) return NextResponse.json({ error: "Trūkst B2B_DEMO_TENANT_WRAP_SECRET." }, { status: 503 });
    const row = encryptB2bDemoAuctionSession({
      tenantId: gate.actor.session.tenantId,
      platform: parsed.platform,
      sessionBlob: parsed.sessionBlob,
      masterSecret: wrap,
    });
    await upsertB2bDemoAuctionSession(gate.actor.session.tenantId, row);
    return NextResponse.json({
      status: auctionSessionStatus(row, gate.actor.session.tenantId, parsed.platform),
    });
  } catch (e) {
    if (e instanceof B2bDemoAuctionSessionError) {
      return NextResponse.json({ error: e.message }, { status: e.code === "password_forbidden" ? 400 : 400 });
    }
    return b2bDemoErrorResponse(e);
  }
}

export async function DELETE(req: Request) {
  const gate = await requireB2bDemoActor();
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") ?? "";
  if (!isB2bDemoAuctionPlatform(platform)) {
    return NextResponse.json({ error: "platform: openlane | auto1 | autobid" }, { status: 400 });
  }
  try {
    await clearB2bDemoAuctionSession(gate.actor.session.tenantId, platform);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return b2bDemoErrorResponse(e);
  }
}
