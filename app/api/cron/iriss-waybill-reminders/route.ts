/**
 * Pavadzīmju push atgādinājumi (ik 15 min): "drīz beigsies", "beigusies", "vēl gaida".
 * Auth: `Authorization: Bearer CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { cronSecretGate } from "@/lib/cron-bearer";
import { runWaybillReminders } from "@/lib/iriss-waybill-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json(await runWaybillReminders());
  } catch (e) {
    console.error("[cron/iriss-waybill-reminders] failed", e);
    return NextResponse.json({ error: "waybill_reminders_failed" }, { status: 500 });
  }
}
