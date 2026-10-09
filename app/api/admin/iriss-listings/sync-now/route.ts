import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { formatFetchError } from "@/lib/iriss-listings-fetch-error";
import { runIrissListingsDailySync } from "@/lib/iriss-listings-sync";

export const runtime = "nodejs";
/** 300 s ir Vercel griesti. 92 avoti ar 4 s virknes pauzi ir 364 s, tāpēc sync lasa paralēli (3) un partijās. */
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let restart = true;
  try {
    const body = (await req.json()) as { restart?: unknown };
    if (body && body.restart === false) restart = false;
  } catch {
    restart = true;
  }
  try {
    const out = await runIrissListingsDailySync({ restart });
    return NextResponse.json(
      { ok: out.ok, skipped: out.skipped, warnings: out.warnings, summary: out.summary, progress: out.progress },
      { status: out.ok ? 200 : 500 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "sync_failed", detail: formatFetchError(e, "sync_failed") },
      { status: 500 },
    );
  }
}
