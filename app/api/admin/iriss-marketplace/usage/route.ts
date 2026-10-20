import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { buildMarketplaceUsageSummary } from "@/lib/marketplace/auto-load";

export const runtime = "nodejs";

/** Šī mēneša tirgus tēriņi (USD), auto griesti, run skaits, pēdējā auto ielāde. */
export async function GET() {
  const gate = await requireIrissSectionApi("radars");
  if (!gate.ok) return gate.response;
  const summary = await buildMarketplaceUsageSummary();
  return NextResponse.json(summary);
}
