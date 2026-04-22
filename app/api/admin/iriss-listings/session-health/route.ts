import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getIrissSessionHealthReport } from "@/lib/iriss-listings-session-health";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const report = await getIrissSessionHealthReport();
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: "session_health_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
