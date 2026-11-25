import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { autodnaLogin, getAutodnaOverview, getAutodnaPurchasePrecheck, startAutodnaPurchase, startAutodnaReportDownload } from "@/lib/autodna-auto";
import { readAutodnaAutoStatus } from "@/lib/autodna-auto-store";
import { AUTODNA_PRECHECK_BLOCK_LV } from "@/lib/autodna-purchase-guard";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * Admin: AutoDNA fona pirkuma stāvoklis pasūtījumam + kredītu atlikums (kešs, atjauno ik 30 min).
 * Ar `vin`: arī priekšpārbaude (arhīva foto / vēsture) pirkuma pogai; `precheck=live` - ja saglabātas nav, ielasa svaigi.
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
  if (sessionId && !isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const vin = normalizeVin(url.searchParams.get("vin") ?? "");
  const [status, overview, precheck] = await Promise.all([
    sessionId ? readAutodnaAutoStatus(sessionId) : Promise.resolve(null),
    getAutodnaOverview({ refresh: url.searchParams.get("refresh") === "1" }),
    sessionId && isValidVin(vin)
      ? getAutodnaPurchasePrecheck(sessionId, vin, { live: url.searchParams.get("precheck") === "live" }).catch(() => null)
      : Promise.resolve(null),
  ]);
  return NextResponse.json({ status, ...overview, precheck });
}

/**
 * Admin pogas:
 *  - `purchase` "Pirkt AutoDNA (fonā)": TIKAI ar `confirm: true` (apstiprinājuma dialogs) - 1 kredīts; un TIKAI, ja
 *    AutoDNA priekšpārbaude rāda >0 arhīva foto vai vēstures ierakstu (Nila likums 25.11) - citādi 409, relejam nesūta;
 *  - `report` "Ielādēt nopirkto": jau nopirktas atskaites PDF, nekad nepērk;
 *  - `login` "Pieslēgt AutoDNA".
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
  if (action === "login") {
    const out = await autodnaLogin();
    return NextResponse.json(out, { status: out.error === "not_configured" ? 503 : 200 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const vin = typeof body.vin === "string" ? body.vin : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
  if (action === "purchase") {
    if (body.confirm !== true) return NextResponse.json({ error: "missing_confirm" }, { status: 400 });
    const out = await startAutodnaPurchase(sessionId, { vin, explicitOperatorConfirm: true, requestId });
    if ("error" in out) return NextResponse.json(out, { status: 400 });
    if (out.precheck && !out.precheck.allowed) {
      const code = out.precheck.code ?? "precheck_unavailable";
      return NextResponse.json({ ...out, error: code, message: AUTODNA_PRECHECK_BLOCK_LV[code] }, { status: 409 });
    }
    return NextResponse.json(out);
  }
  if (action === "report") {
    const out = await startAutodnaReportDownload(sessionId, vin, requestId);
    if ("error" in out) return NextResponse.json(out, { status: 400 });
    return NextResponse.json(out);
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
