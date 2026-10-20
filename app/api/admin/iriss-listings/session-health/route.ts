import { NextResponse } from "next/server";
import { requireIrissSectionApi } from "@/lib/staff-auth";
import { getIrissPlatformHealthReport } from "@/lib/iriss-listings-session-health";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireIrissSectionApi("sludinajumi");
  if (!gate.ok) return gate.response;
  try {
    const report = await getIrissPlatformHealthReport();
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: "session_health_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
