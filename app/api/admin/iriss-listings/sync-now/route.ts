import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { runIrissListingsDailySyncWithOptions } from "@/lib/iriss-listings-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const out = await runIrissListingsDailySyncWithOptions({ ensureSessionsBeforeScrape: true });
    return NextResponse.json(out, { status: out.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json(
      { error: "sync_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
