/**
 * Aktīvo PRO pasūtījumu skaits sānjoslas žetonam (noklusētais >10 € filtrs kā sarakstā).
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { loadAdminBadgeCounts } from "@/lib/admin-badge-counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { activeCount, overdueCount, urgentCount } = await loadAdminBadgeCounts();
    return NextResponse.json(
      { ok: true, activeCount, overdueCount, urgentCount },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (e) {
    console.error("[admin/orders/active-count]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
