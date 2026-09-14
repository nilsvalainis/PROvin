import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { remainingB2bCredits } from "@/lib/b2b-partner-credits";
import { resolvePartnerCreditRemaining } from "@/lib/b2b-partner-credit-seed";
import { readB2bCreditWallet } from "@/lib/b2b-partner-credit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wallet = await readB2bCreditWallet(partner.id);
  const remaining =
    wallet.lots.length > 0
      ? remainingB2bCredits(wallet.lots, new Date())
      : resolvePartnerCreditRemaining([]);
  return NextResponse.json({ remaining });
}
