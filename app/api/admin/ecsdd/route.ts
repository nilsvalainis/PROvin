import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { fetchEcsddRelaySession, readEcsddRelayConfig, startEcsddLookup } from "@/lib/ecsdd-auto";
import { readEcsddAutoStatus } from "@/lib/ecsdd-auto-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admin: e.csdd uzziņas stāvoklis pasūtījumam + releja sesija (vai serveris ielogojies). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const relayConfigured = readEcsddRelayConfig() !== null;
  const [status, session] = await Promise.all([readEcsddAutoStatus(sessionId), relayConfigured ? fetchEcsddRelaySession() : null]);
  return NextResponse.json({ status, relayConfigured, session });
}

/** Admin: "Ņemt no e.csdd" (pēc pasūtījuma VIN, citādi CSDD numura). */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const orderVin = typeof body.vin === "string" ? body.vin : "";
  const out = await startEcsddLookup(sessionId, { trigger: "manual", orderVin, force: body.force === true });
  return NextResponse.json({ ok: out.ok, started: out.started, status: out.status });
}
