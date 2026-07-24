import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { upsertDashboardDraftIndexEntry } from "@/lib/admin-dashboard-draft-index";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";

export const runtime = "nodejs";

/**
 * Persistē 48 h termiņa „Izpildīts” atzīmi dashboard indeksā (ne tikai localStorage).
 * Body: { sessionId: string, complete: boolean }
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sessionId =
    body &&
    typeof body === "object" &&
    "sessionId" in body &&
    typeof (body as { sessionId: unknown }).sessionId === "string"
      ? (body as { sessionId: string }).sessionId.trim()
      : "";
  const complete =
    body &&
    typeof body === "object" &&
    "complete" in body &&
    typeof (body as { complete: unknown }).complete === "boolean"
      ? (body as { complete: boolean }).complete
      : null;

  if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });
  }
  if (complete === null) {
    return NextResponse.json({ error: "missing_complete" }, { status: 400 });
  }

  const auditCompletedAt = complete ? new Date().toISOString() : null;
  try {
    await upsertDashboardDraftIndexEntry(sessionId, { auditCompletedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[audit-deadline-complete] upsert failed", msg);
    return NextResponse.json({ error: "store_failed", detail: msg }, { status: 503 });
  }

  return NextResponse.json({ ok: true, sessionId, complete, auditCompletedAt });
}
