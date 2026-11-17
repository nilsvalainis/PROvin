/**
 * Pavadzīmju push atgādinājumi (ik 15 min): "drīz beigsies", "beigusies", "vēl gaida".
 * Tajā pašā reizē: izdotās pavadzīmes, kuru PDF vēl nav Dropbox, mēģina saglabāt vēlreiz.
 * Auth: `Authorization: Bearer CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { cronSecretGate } from "@/lib/cron-bearer";
import { runWaybillReminders } from "@/lib/iriss-waybill-reminders";
import { sweepWaybillRequestsToDropbox } from "@/lib/iriss-waybill-dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const reminders = await runWaybillReminders();
    const dropbox = await sweepWaybillRequestsToDropbox().catch((e) => {
      console.error("[cron/iriss-waybill-reminders] dropbox sweep failed", e instanceof Error ? e.message : e);
      return { tried: 0, saved: 0, failed: 0 };
    });
    return NextResponse.json({ ...reminders, dropbox });
  } catch (e) {
    console.error("[cron/iriss-waybill-reminders] failed", e);
    return NextResponse.json({ error: "waybill_reminders_failed" }, { status: 500 });
  }
}
