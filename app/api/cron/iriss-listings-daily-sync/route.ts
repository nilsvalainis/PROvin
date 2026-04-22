import { NextResponse } from "next/server";
import { runIrissListingsDailySyncWithOptions } from "@/lib/iriss-listings-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.ADMIN_IRISS_LISTINGS_CRON_SECRET?.trim() ?? "";
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
    const out = await runIrissListingsDailySyncWithOptions({ ensureSessionsBeforeScrape: true });
    return NextResponse.json(out, { status: out.ok ? 200 : 500 });
  } catch (e) {
    console.error("[cron/iriss-listings-daily-sync] failed", e);
    return NextResponse.json(
      { error: "sync_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
