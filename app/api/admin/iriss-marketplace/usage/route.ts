import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { buildMarketplaceUsageSummary } from "@/lib/marketplace/auto-load";

export const runtime = "nodejs";

/** Šī mēneša tirgus tēriņi (USD), auto griesti, run skaits, pēdējā auto ielāde. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await buildMarketplaceUsageSummary();
  return NextResponse.json(summary);
}
