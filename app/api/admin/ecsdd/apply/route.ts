import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { markEcsddAutoApplied } from "@/lib/ecsdd-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Admin: e.csdd teksts ievietots CSDD blokā (to dara klients ar to pašu RAW parseri, ko ielīmējums) -
 * atzīmē, lai automātiski neievietotu otrreiz.
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
  const status = await markEcsddAutoApplied(sessionId);
  if (!status || status.state !== "found") return NextResponse.json({ error: "no_result" }, { status: 409 });
  return NextResponse.json({ ok: true, status });
}
