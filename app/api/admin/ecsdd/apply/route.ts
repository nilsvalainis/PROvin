import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { markEcsddAutoApplied } from "@/lib/ecsdd-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin: e.csdd teksts ievietots CSDD blokā ar pogu (to dara klients ar to pašu RAW parseri, ko ielīmējums) -
 * atzīmē un saglabā iepriekšējo RAW (`previousRawText`), lai to varētu atjaunot.
 * `{action:"restore"}` - «Atjaunot iepriekšējo RAW» (klients ievieto `previousRawText` pats).
 */
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
  const action = body.action === "restore" ? "restore" : "apply";
  const previousRawText = typeof body.previousRawText === "string" ? body.previousRawText.slice(0, 60_000) : "";
  const status = await markEcsddAutoApplied(sessionId, { action, previousRawText });
  if (!status || status.state !== "found") return NextResponse.json({ error: "no_result" }, { status: 409 });
  return NextResponse.json({ ok: true, status });
}
