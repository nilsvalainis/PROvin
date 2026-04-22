import { NextResponse } from "next/server";
import { runDailyAdminDraftBackup } from "@/lib/admin-drafts-daily-backup";

export const runtime = "nodejs";
export const maxDuration = 120;

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET?.trim() ?? "";
  if (!expected) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (auth !== `Bearer ${expected}`) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true };
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
