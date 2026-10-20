import { NextResponse } from "next/server";
import { requireIrissLogisticsApi, irissLogisticsScopeHeader } from "@/lib/iriss-logistics-access";
import { logisticsMapsUsageSummary } from "@/lib/iriss-logistics-maps-quota";
import { googleMapsBrowserKey, googleMapsServerKey, readLogisticsMapsUsage } from "@/lib/iriss-logistics-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pārvaldība / izmaksu sadaļa: Google Maps skaitītāji. */
export async function GET() {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const usage = await readLogisticsMapsUsage();
  return NextResponse.json(
    {
      ok: true,
      configured: Boolean(googleMapsBrowserKey()),
      geocodingConfigured: Boolean(googleMapsServerKey()),
      ...logisticsMapsUsageSummary(usage),
    },
    { headers: irissLogisticsScopeHeader() },
  );
}
