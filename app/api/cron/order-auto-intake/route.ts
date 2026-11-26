/**
 * Fona darbs pēc apmaksas (25.11): VIN SCAN pēc CSDD + bezmaksas imports blokos + push Nilam.
 * Izsauc Stripe webhook, ja pēc CSDD sēklas tā 300 s budžetā vairs nepietiek laika (savs 300 s budžets).
 * Atbild uzreiz; darbs iet `after()`. Vārti: `Authorization: Bearer CRON_SECRET`. Nekādu pirkumu.
 */
import { NextResponse, after } from "next/server";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { ORDER_AUTO_INTAKE_FUNCTION_BUDGET_MS, ORDER_AUTO_INTAKE_SAFETY_MS } from "@/lib/order-auto-intake-core";
import { orderAutoIntakeRouteGate, runOrderAutoIntake } from "@/lib/order-auto-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const startedAt = Date.now();
  const gate = orderAutoIntakeRouteGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body: Record<string, unknown> = {};
  try {
    const raw = (await req.json()) as unknown;
    if (raw && typeof raw === "object") body = raw as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const vin = typeof body.vin === "string" ? body.vin : null;
  const listingUrl = typeof body.listingUrl === "string" ? body.listingUrl : null;
  const skipPush = body.skipPush === true;

  after(async () => {
    try {
      const r = await runOrderAutoIntake(sessionId, {
        vin,
        listingUrl,
        skipPush,
        trigger: "background",
        deadlineAt: startedAt + ORDER_AUTO_INTAKE_FUNCTION_BUDGET_MS - ORDER_AUTO_INTAKE_SAFETY_MS,
      });
      console.info("[cron/order-auto-intake]", { sessionId: sessionId.slice(-8), ...r });
    } catch (err) {
      console.error("[cron/order-auto-intake] failed", err instanceof Error ? err.message : "unknown");
    }
  });
  return NextResponse.json({ ok: true, queued: true }, { status: 202 });
}
