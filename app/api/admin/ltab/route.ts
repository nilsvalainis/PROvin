import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { readLtabRelayConfig, startLtabLookup } from "@/lib/ltab-auto";
import { readLtabAutoStatus } from "@/lib/ltab-auto-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Admin: LTAB automātikas stāvoklis pasūtījumam. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const status = await readLtabAutoStatus(sessionId);
  return NextResponse.json({ status, relayConfigured: readLtabRelayConfig() !== null });
}

/** Admin: "Pieprasīt no LTAB" (tikai LV numurzīme pēc CSDD datiem). */
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
  const out = await startLtabLookup(sessionId, { trigger: "manual", orderVin, force: body.force === true });
  return NextResponse.json({ ok: out.ok, started: out.started, status: out.status });
}
