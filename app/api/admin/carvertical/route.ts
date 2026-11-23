import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import {
  carverticalSessionAction,
  getCarverticalOverview,
  startCarverticalPurchase,
  startCarverticalReportDownload,
} from "@/lib/carvertical-auto";
import { readCarverticalAutoStatus } from "@/lib/carvertical-auto-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Admin: CarVertical fona pirkuma stāvoklis pasūtījumam + kredītu atlikums (kešs, atjauno ik 30 min). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
  if (sessionId && !isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const [status, overview] = await Promise.all([
    sessionId ? readCarverticalAutoStatus(sessionId) : Promise.resolve(null),
    getCarverticalOverview({ refresh: url.searchParams.get("refresh") === "1" }),
  ]);
  return NextResponse.json({ status, ...overview });
}

/**
 * Admin pogas:
 *  - `purchase` "Pirkt CarVertical (fonā)": TIKAI ar `confirm: true` (apstiprinājuma dialogs) - 1 kredīts;
 *  - `report` "Ielādēt nopirkto": jau nopirktas atskaites PDF, nekad nepērk;
 *  - `login` / `code`: CarVertical pieteikšanās (kods no konta e-pasta).
 */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  if (action === "login" || action === "code") {
    const out = await carverticalSessionAction(action, typeof body.code === "string" ? body.code : undefined);
    return NextResponse.json(out, { status: out.error === "not_configured" ? 503 : 200 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const vin = typeof body.vin === "string" ? body.vin : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
  if (action === "purchase") {
    if (body.confirm !== true) return NextResponse.json({ error: "missing_confirm" }, { status: 400 });
    const out = await startCarverticalPurchase(sessionId, { vin, explicitOperatorConfirm: true, requestId });
    if ("error" in out) return NextResponse.json(out, { status: 400 });
    return NextResponse.json(out);
  }
  if (action === "report") {
    const out = await startCarverticalReportDownload(sessionId, vin, requestId);
    if ("error" in out) return NextResponse.json(out, { status: 400 });
    return NextResponse.json(out);
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
