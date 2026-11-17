import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { listPartnerFulfilledPogaOrders } from "@/lib/business-poga-partner-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Partnera kabinets: izpildītās atskaites pēc PROVIN pogas klikšķa partnera vietnē. */
export async function GET() {
  const partner = await resolveActiveB2bPartner();
  if (!partner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!partner.businessEmbed.enabled) return NextResponse.json({ enabled: false, rows: [] });
  try {
    return NextResponse.json({ enabled: true, rows: await listPartnerFulfilledPogaOrders(partner.id) });
  } catch (e) {
    console.error("[partner/business-poga]", e);
    return NextResponse.json({ enabled: true, rows: [], error: "load_failed" });
  }
}
