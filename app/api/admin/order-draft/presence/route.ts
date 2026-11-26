/**
 * Pasūtījuma klātbūtnes heartbeat (ik ~20 s no atvērtas cilnes). Atgriež citus pārlūkus/ierīces,
 * kas šo pasūtījumu atvēruši pēdējās 60 s. Bez satura - tikai ierīces id, pārlūka nosaukums, laiks.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getOrderDraftBlobConfig, isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { isSafePresenceClientId, recordOrderPresence, sanitizePresenceLabel } from "@/lib/admin-order-presence-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId) || !isSafePresenceClientId(clientId)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  try {
    const others = await recordOrderPresence(
      getOrderDraftBlobConfig(),
      sessionId,
      clientId,
      sanitizePresenceLabel(body?.label),
    );
    return NextResponse.json({ ok: true, others });
  } catch (e) {
    console.warn("[order-draft:presence]", { sessionId, detail: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, others: [] }, { status: 200 });
  }
}
