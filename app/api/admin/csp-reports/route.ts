import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readCspReportDays } from "@/lib/csp-report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin: CSP pārkāpumu apkopojums pa dienām (pirms piespiedu CSP). `?days=7` (max 14). */
export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = Number(new URL(req.url).searchParams.get("days") ?? "7");
  const result = await readCspReportDays(Number.isFinite(days) ? days : 7);
  if (!result) {
    return NextResponse.json({ error: "storage_not_configured" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({ days: result }, { headers: { "Cache-Control": "private, no-store" } });
}
