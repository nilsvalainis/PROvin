import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { fetchTraficomFiRelaySession, readTraficomFiRelayConfig, startTraficomFiLookup } from "@/lib/traficom-fi-auto";
import { readTraficomFiAutoStatus } from "@/lib/traficom-fi-auto-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admin: Traficom (FI) automātikas stāvoklis pasūtījumam + releja sesija. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const relayConfigured = readTraficomFiRelayConfig() !== null;
  const [status, session] = await Promise.all([
    readTraficomFiAutoStatus(sessionId),
    relayConfigured ? fetchTraficomFiRelaySession() : Promise.resolve(null),
  ]);
  return NextResponse.json({ status, relayConfigured, session });
}

/** Admin: «Ielasīt no reģistra» / «Pieprasīt vēlreiz» pēc pasūtījuma VIN (eParaksts apstiprina Nils telefonā). */
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
  const vin = typeof body.vin === "string" ? body.vin : "";
  const out = await startTraficomFiLookup(sessionId, { trigger: "manual", vin, force: body.force === true });
  return NextResponse.json({ ok: out.ok, started: out.started, status: out.status }, { status: out.ok ? 200 : 502 });
}
