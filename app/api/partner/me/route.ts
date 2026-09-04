import { NextResponse } from "next/server";
import { resolveActiveB2bPartnerProfile } from "@/lib/b2b-partner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const partner = await resolveActiveB2bPartnerProfile();
  if (!partner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ partner });
}
