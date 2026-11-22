/**
 * Ēnu režīma statistika (admin): GET ?days=N (neobligāts) - kopsavilkums + saraksts.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { listDealerShadowJobs } from "@/lib/dealer-data-job-store";
import { buildDealerShadowStats, dealerShadowStatsLine } from "@/lib/dealer-shadow-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const daysRaw = Number(new URL(req.url).searchParams.get("days") ?? "");
  const sinceMs = Number.isFinite(daysRaw) && daysRaw > 0 ? Date.now() - Math.min(daysRaw, 365) * 86_400_000 : undefined;
  const stats = buildDealerShadowStats(await listDealerShadowJobs(), { sinceMs });
  return NextResponse.json({ ok: true, line: dealerShadowStatsLine(stats), ...stats });
}
