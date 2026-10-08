import { NextResponse } from "next/server";
import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import { irissListingsAutomaticSlot } from "@/lib/iriss-listings-schedule";
import { runIrissListingsDailySync } from "@/lib/iriss-listings-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 300 s ir Vercel griesti. 92 avoti ar 4 s virknes pauzi ir 364 s, tāpēc sync lasa paralēli (3) un partijās. */
export const maxDuration = 300;

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  // Vercel Cron sūta Bearer CRON_SECRET; papildus atbalstām projekta ADMIN_IRISS_LISTINGS_CRON_SECRET.
  const candidates = [
    process.env.ADMIN_IRISS_LISTINGS_CRON_SECRET?.trim() ?? "",
    process.env.CRON_SECRET?.trim() ?? "",
  ].filter(Boolean);
  if (candidates.length === 0) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (!candidates.some((s) => auth === `Bearer ${s}`)) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true };
}

export async function GET(req: Request) {
  const gate = isAuthorized(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const slot = irissListingsAutomaticSlot(new Date());
  if (!slot) {
    return NextResponse.json({ ok: true, skipped: "not_target_hour" });
  }
  try {
    const out = await runIrissListingsDailySync({ automaticSlot: slot });
    return NextResponse.json(
      { ok: out.ok, skipped: out.skipped, warnings: out.warnings, summary: out.summary, slot },
      { status: out.ok ? 200 : 500 },
    );
  } catch (e) {
    console.error("[cron/iriss-listings-daily-sync] failed", e);
    return NextResponse.json(
      { error: "sync_failed", detail: formatFetchError(e, "sync_failed") },
      { status: 500 },
    );
  }
}
