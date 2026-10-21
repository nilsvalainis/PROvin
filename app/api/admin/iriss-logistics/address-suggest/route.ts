import { NextResponse } from "next/server";
import { irissLogisticsScopeHeader, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";
import { suggestLogisticsAddresses } from "@/lib/iriss-logistics-places-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Adreses ieteikumi rakstot (Google Places Autocomplete, rezervē ģeokodēšana). */
export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { input?: unknown; sessionToken?: unknown };
  const result = await suggestLogisticsAddresses(
    typeof body.input === "string" ? body.input : "",
    typeof body.sessionToken === "string" ? body.sessionToken : "",
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: result.limited ? 429 : 400, headers: irissLogisticsScopeHeader() });
  }
  return NextResponse.json(result, { headers: irissLogisticsScopeHeader() });
}
