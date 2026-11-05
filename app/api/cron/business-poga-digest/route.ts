/**
 * PROVIN Business pogas dienas kopsavilkums uz info@provin.lv (vakardiena, Europe/Riga).
 * Auth: `Authorization: Bearer` = `CRON_SECRET` vai `ADMIN_DRAFT_BACKUP_CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { runBusinessPogaDigest } from "@/lib/business-poga-digest-run";
import { bearerMatchesAnySecret } from "@/lib/cron-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secrets = [process.env.CRON_SECRET, process.env.ADMIN_DRAFT_BACKUP_CRON_SECRET]
    .map((s) => s?.trim() ?? "")
    .filter(Boolean);
  if (secrets.length === 0) return NextResponse.json({ error: "missing_cron_secret" }, { status: 503 });
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return NextResponse.json({ error: "missing_authorization" }, { status: 401 });
  if (!bearerMatchesAnySecret(auth, secrets)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await runBusinessPogaDigest());
  } catch (e) {
    console.error("[cron/business-poga-digest] failed", e);
    return NextResponse.json({ error: "digest_failed" }, { status: 500 });
  }
}
