/**
 * 3 h pirms 48 h audita sagatavošanas SLA.
 * Nav IRISS LIST izsoļu atgādinājums (tos Nils noraidīja).
 *
 * Auth: `Authorization: Bearer` = `CRON_SECRET` vai `ADMIN_DRAFT_BACKUP_CRON_SECRET`.
 * Paziņojumi: esošais admin e-pasts (ADMIN_NOTIFY_EMAIL / SMTP) un Telegram.
 * Nav jaunu ārējo API atslēgu. Ja Blob/FS nav rakstāms, nesūta (lai nespaidītu).
 */
import { NextResponse } from "next/server";

import { runAdminAuditSlaWarnings } from "@/lib/admin-audit-sla-warning-run";
import { bearerMatchesAnySecret } from "@/lib/cron-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secrets = [process.env.CRON_SECRET, process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET]
    .map((s) => s?.trim() ?? "")
    .filter(Boolean);
  if (secrets.length === 0) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (!bearerMatchesAnySecret(auth, secrets)) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true };
}

export async function GET(req: Request) {
  const gate = isAuthorized(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const result = await runAdminAuditSlaWarnings();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[cron/admin-audit-sla-warning] failed", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "sla_warning_failed", detail: msg }, { status: 500 });
  }
}
