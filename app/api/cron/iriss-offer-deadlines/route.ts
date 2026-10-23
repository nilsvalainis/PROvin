/**
 * Reizi 15 min: push Nilam par IRISS piedāvājumiem, kuru termiņš beidzies bez klienta atbildes.
 * Auth: `Authorization: Bearer` = `CRON_SECRET` vai `ADMIN_DRAFT_BACKUP_CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { bearerMatchesAnySecret } from "@/lib/cron-bearer";
import { runIrissOfferExpiryNotices } from "@/lib/iriss-offer-expiry-run";

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
    return NextResponse.json(await runIrissOfferExpiryNotices());
  } catch (e) {
    console.error("[cron/iriss-offer-deadlines] failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "offer_deadlines_failed" }, { status: 500 });
  }
}
