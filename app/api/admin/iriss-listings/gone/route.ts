import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { loadIrissSludinajumiPageData, splitGoneListingVehicles } from "@/lib/iriss-sludinajumi-page-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Cilnes „Pazuduši” auto: lapa tos nesūta, lai sākotnējā ielāde būtu maza. */
export async function GET() {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  const { view, initialOrderOv, matchOrderIds } = await loadIrissSludinajumiPageData();
  const { gone } = splitGoneListingVehicles(view?.vehicles ?? [], { orderOv: initialOrderOv, matchOrderIds });
  return NextResponse.json({ vehicles: gone }, { headers: { "Cache-Control": "no-store" } });
}
