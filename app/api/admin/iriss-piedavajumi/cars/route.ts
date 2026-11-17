import { NextResponse } from "next/server";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { irissPdCarPicks } from "@/lib/iriss-piedavajumi";
import { listIrissPdRows } from "@/lib/iriss-piedavajumi-store";
import { requireAdminOnlyApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Autoparka auto izvēlei (ar «jau ir piedāvājums» atzīmi). */
export async function GET() {
  const gate = await requireAdminOnlyApi();
  if (!gate.ok) return gate.response;
  try {
    const [state, rows] = await Promise.all([readAutoparksState(), listIrissPdRows()]);
    return NextResponse.json({ ok: true, cars: irissPdCarPicks(state.cars, rows) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, cars: [] }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
