import { NextResponse } from "next/server";
import { isAutoparksOwner } from "@/lib/iriss-autoparks";
import { listAcceptedForTradeVehicles } from "@/lib/iriss-autoparks-accepted";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { requireIrissSectionApi, requireLogisticsApi } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/**
 * Auto, kas PAŠLAIK ir pieņemti tirdzniecībā (CSDD reģistrs -> Autoparks). Tikai droši lauki, bez cenām.
 * Piekļuve: Pavadzīmes vai Loģistika/Autoparks. `?owner=IRISS|DZA` - tikai vienas firmas auto.
 */
export async function GET(req: Request) {
  const gate = (await requireIrissSectionApi("pavadzimes")).ok ? { ok: true as const } : await requireLogisticsApi();
  if (!gate.ok) return gate.response;
  const owner = new URL(req.url).searchParams.get("owner")?.toUpperCase();
  try {
    const vehicles = listAcceptedForTradeVehicles((await readAutoparksState()).cars, isAutoparksOwner(owner) ? { owner } : {});
    return NextResponse.json({ ok: true, vehicles }, NO_STORE);
  } catch (err) {
    console.error("[autoparks] accepted_for_trade_failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "read_failed" }, { status: 500, ...NO_STORE });
  }
}
