import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { logisticsPlaceDetails } from "@/lib/iriss-logistics-places-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Izvēlētā ieteikuma koordinātes (Place Details tajā pašā sesijā). */
export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { placeId?: unknown; sessionToken?: unknown };
  const result = await logisticsPlaceDetails(
    typeof body.placeId === "string" ? body.placeId : "",
    typeof body.sessionToken === "string" ? body.sessionToken : "",
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: result.limited ? 429 : 400, headers: irissLogisticsScopeHeader() });
  }
  return NextResponse.json(result, { headers: irissLogisticsScopeHeader() });
}
