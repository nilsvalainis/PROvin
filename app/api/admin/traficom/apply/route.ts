import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { markTraficomFiApplied } from "@/lib/traficom-fi-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin: Traficom dati ievietoti `traficom_fi` blokā ar pogu (klients ievieto ar to pašu funkciju) - atzīmē un
 * saglabā iepriekšējo RAW. `{action:"restore"}` - «Atjaunot iepriekšējo RAW» (klients ievieto `previousRawText` pats).
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
  const status = await markTraficomFiApplied(sessionId, { action, previousRawText });
  if (!status || status.state !== "found") return NextResponse.json({ error: "no_result" }, { status: 409 });
  return NextResponse.json({ ok: true, status });
}
