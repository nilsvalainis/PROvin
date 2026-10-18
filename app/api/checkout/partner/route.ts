import { NextResponse } from "next/server";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";

export const runtime = "nodejs";

/**
 * Veco kredītu paku pirkšana ir slēgta: partneri maksā no maka (`/api/checkout/partner/topup`).
 * Jau apmaksātās paku sesijas joprojām apstrādā Stripe webhook (`fulfillment: "b2b_pack"`),
 * un esošie kredīti, to atmaksas un izlietošana strādā kā līdz šim.
 */
export async function GET() {
  return NextResponse.json({ error: "legacy_packs_closed" }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST() {
  const partner = await resolveActiveB2bPartner();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ error: "legacy_packs_closed" }, { status: 410 });
}
