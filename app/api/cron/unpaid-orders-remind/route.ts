/**
 * Neapmaksāto pasūtījumu atgādinājums TIKAI Nilam (admin push), nekad klientam.
 * Auth: `Authorization: Bearer CRON_SECRET` (Vercel Cron).
 */
import { NextResponse } from "next/server";

import { runUnpaidOrdersAdminReminder } from "@/lib/admin-unpaid-remind-cron";
import { cronSecretGate } from "@/lib/cron-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = cronSecretGate(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const result = await runUnpaidOrdersAdminReminder();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    console.error("[cron/unpaid-orders-remind] failed", e);
    return NextResponse.json({ error: "unpaid_remind_failed" }, { status: 500 });
  }
}
