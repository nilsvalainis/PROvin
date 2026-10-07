import { NextResponse } from "next/server";
import { runIrissListingsDailySync } from "@/lib/iriss-listings-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
  try {
    const out = await runIrissListingsDailySync();
    return NextResponse.json({ ok: out.ok, warnings: out.warnings, summary: out.summary }, { status: out.ok ? 200 : 500 });
  } catch (e) {
    console.error("[cron/iriss-listings-daily-sync] failed", e);
    return NextResponse.json(
      { error: "sync_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
