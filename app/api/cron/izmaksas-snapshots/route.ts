/**
 * Izmaksu momentuzņēmumi ~06:00 Europe/Riga (Stripe, Vercel, Anthropic Admin, Apify limits).
 * Auth: Vercel Cron `Authorization: Bearer CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { resolveCostMonth } from "@/lib/admin-costs";
import {
  authorizeCostSnapshotCron,
  isCostSnapshotRefreshSlot,
  refreshCostSnapshots,
} from "@/lib/admin-costs-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const gate = authorizeCostSnapshotCron(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const nowMs = Date.now();
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !isCostSnapshotRefreshSlot(nowMs)) {
    return NextResponse.json({ ok: true, skipped: "not_riga_refresh_hour" });
  }

  try {
    const month = resolveCostMonth(null, nowMs);
    const results = await refreshCostSnapshots(month);
    return NextResponse.json({ ok: true, month, results });
  } catch (err) {
    console.error("[cron/izmaksas-snapshots] failed", err);
    return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
  }
}
