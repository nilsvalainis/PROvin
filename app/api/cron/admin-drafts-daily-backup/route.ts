import { NextResponse } from "next/server";
import { runDailyAdminDraftBackup } from "@/lib/admin-drafts-daily-backup";
import { cronSecretGate } from "@/lib/cron-bearer";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel Cron sūta `CRON_SECRET`; manuāli/ārējie izsaukumi var lietot `ADMIN_DRAFT_BACKUP_CRON_SECRET`. */
function isAuthorized(req: Request) {
  return cronSecretGate(req.headers.get("authorization"), [
    process.env.CRON_SECRET,
    process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET,
  ]);
}

export async function GET(req: Request) {
  const gate = isAuthorized(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const result = await runDailyAdminDraftBackup();
    const status = result.ok ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (e) {
    console.error("[cron/admin-drafts-daily-backup] failed", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "backup_failed", detail: msg }, { status: 500 });
  }
}
