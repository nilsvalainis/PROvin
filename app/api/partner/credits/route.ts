import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { resolvePartnerCreditRemaining } from "@/lib/b2b-partner-credit-seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Real lots store lands with pack Stripe fulfillment; seed covers preview UI for now.
  return NextResponse.json({ remaining: resolvePartnerCreditRemaining([]) });
}
