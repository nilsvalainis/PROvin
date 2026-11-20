import { NextResponse } from "next/server";
import { readAutoparksEffectiveCars } from "@/lib/iriss-autoparks-v2-store";
import { irissPdCarPicks } from "@/lib/iriss-piedavajumi";
import { listIrissPdRows } from "@/lib/iriss-piedavajumi-store";
import { irissPdViewerCanUseStock, irissPdViewerFromActor } from "@/lib/iriss-piedavajumi-staff";
import { requireIrissSectionApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Autoparka auto izvēlei (ar «jau ir piedāvājums» atzīmi). Darbiniekam tikai ar Autoparka pamatdatu tiesību. */
export async function GET() {
  const gate = await requireIrissSectionApi("pasutijumi");
  if (!gate.ok) return gate.response;
  if (!irissPdViewerCanUseStock(irissPdViewerFromActor(gate.actor), "autoparks")) {
    return NextResponse.json({ ok: false, cars: [] }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    // Efektīvie Pamatdati (v2 labotais VIN/numurs/marka) - izvēlei un dublikātu pārbaudei.
    const [cars, rows] = await Promise.all([readAutoparksEffectiveCars(), listIrissPdRows()]);
    return NextResponse.json({ ok: true, cars: irissPdCarPicks(cars, rows) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, cars: [] }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
