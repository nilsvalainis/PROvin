import { NextResponse } from "next/server";
import { listPartnerArchiveRows } from "@/lib/b2b-partner-archive";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const email = partner.email;
  try {
    const orders = await listPartnerArchiveRows(email);
    return NextResponse.json({ orders });
  } catch (e) {
    console.error("[api/partner/archive]", e);
    return NextResponse.json({ error: "archive_failed" }, { status: 500 });
  }
}
