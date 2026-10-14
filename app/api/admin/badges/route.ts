/**
 * Sānjoslas žetoni vienā pieprasījumā (agrāk 3 atsevišķi pollingi + 3 maršruti).
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
    const counts = await loadAdminBadgeCounts();
    return NextResponse.json(
      { ok: true, ...counts },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (e) {
    console.error("[admin/badges]", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
