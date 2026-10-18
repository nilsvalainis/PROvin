import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { readB2bWallet } from "@/lib/b2b-wallet-store";
import { buildB2bWalletView } from "@/lib/b2b-wallet-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const partner = await resolveActiveB2bPartner();
  if (!partner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const wallet = await readB2bWallet(partner.id);
  return NextResponse.json({ wallet: buildB2bWalletView(wallet, partner.walletPrices) });
}
