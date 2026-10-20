import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { consumeLogisticsMapsQuota, googleMapsBrowserKey } from "@/lib/iriss-logistics-store";
import { logisticsMapsUsageSummary } from "@/lib/iriss-logistics-maps-quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Izsniedz Maps JS atslēgu tikai adminam un skaita 1 kartes ielādi. */
export async function POST() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const key = googleMapsBrowserKey();
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        notice: "GOOGLE_MAPS_API_KEY nav iestatīta. Karte šobrīd nav pieejama.",
      },
      { headers: irissLogisticsScopeHeader() },
    );
  }
  const quota = await consumeLogisticsMapsQuota("maps_js");
  if (!quota.ok) {
    return NextResponse.json(
      { ok: false, configured: true, limited: true, notice: quota.notice, usage: logisticsMapsUsageSummary(quota.usage) },
      { status: 429, headers: irissLogisticsScopeHeader() },
    );
  }
  return NextResponse.json(
    { ok: true, configured: true, key, usage: logisticsMapsUsageSummary(quota.usage) },
    { headers: irissLogisticsScopeHeader() },
  );
}
