import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { upsertOrderDraftAuditComplete } from "@/lib/admin-order-draft-store";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";

export const runtime = "nodejs";

/**
 * Persistē 48 h termiņa „Izpildīts” atzīmi pasūtījuma melnraksta JSON (Blob).
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

  const res = await upsertOrderDraftAuditComplete(sessionId, complete);
  if (!res.ok) {
    const status =
      res.error === "store_disabled" || res.error === "store_not_durable" ? 503 : 500;
    console.error("[audit-deadline-complete] upsert failed", res.error);
    return NextResponse.json(
      {
        error: res.error,
        message:
          res.error === "store_not_durable" || res.error === "store_disabled"
            ? "Neizdevās saglabāt — pārbaudi BLOB_READ_WRITE_TOKEN / ADMIN_ORDER_DRAFT_BLOB_PREFIX."
            : "Neizdevās saglabāt „Izpildīts” atzīmi.",
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    complete,
    auditCompletedAt: res.auditCompletedAt,
    durable: res.durable,
  });
}
