import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { parseAuditResultColor } from "@/lib/admin-audit-result-color";
import { setAuditResultColor } from "@/lib/admin-audit-result-color-store";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Body: { sessionId: string, color: "green" | "orange" | "red" | null } */
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

  const hasColorKey =
    body && typeof body === "object" && "color" in body;
  const colorRaw = hasColorKey ? (body as { color: unknown }).color : undefined;
  const color =
    colorRaw === null || colorRaw === ""
      ? null
      : parseAuditResultColor(colorRaw);

  if (!sessionId || !isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });
  }
  if (!hasColorKey || (colorRaw !== null && colorRaw !== "" && color === null)) {
    return NextResponse.json({ error: "invalid_color" }, { status: 400 });
  }

  const res = await setAuditResultColor(sessionId, color);
  if (!res.ok) {
    console.error("[audit-result-color]", res.error);
    return NextResponse.json(
      {
        error: res.error,
        message:
          res.error === "store_not_durable" || res.error === "store_disabled"
            ? "Neizdevās saglabāt — trūkst BLOB_READ_WRITE_TOKEN / ADMIN_ORDER_DRAFT_BLOB_PREFIX."
            : "Neizdevās saglabāt audita krāsu.",
      },
      { status: res.error === "store_disabled" || res.error === "store_not_durable" ? 503 : 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    color: res.color,
  });
}
