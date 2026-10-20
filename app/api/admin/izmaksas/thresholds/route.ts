import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { resolveCostMonth } from "@/lib/admin-costs";
import { loadCostAlerts } from "@/lib/admin-costs-load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 80 % / 100 % sliekšņi rīta kopsavilkumam. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const month = resolveCostMonth(url.searchParams.get("m") ?? url.searchParams.get("month"));
  const alerts = await loadCostAlerts(month);
  return NextResponse.json({
    ok: true,
    month,
    alerts,
    warning80: alerts.some((a) => a.level === 80),
    hard100: alerts.some((a) => a.level === 100),
  });
}
