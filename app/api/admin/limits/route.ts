import { NextResponse } from "next/server";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import { loadIrissLimitsSnapshot } from "@/lib/iriss-limits-store";
import {
  IRISS_LIMITS_ROWS,
  formatIrissLimitsPercent,
  formatIrissLimitsRefreshed,
  formatIrissLimitsSpend,
  irissLimitsIsStale,
  irissLimitsPercent,
  irissLimitsTone,
  irissLimitsWorstTone,
} from "@/lib/iriss-limits-view";

export const runtime = "nodejs";

export async function GET() {
  const actor = await getAdminOrStaffActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.kind !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const snap = await loadIrissLimitsSnapshot();
  const stale = irissLimitsIsStale(snap.updatedAt);
  const rows = IRISS_LIMITS_ROWS.map((meta) => {
    const row = snap.rows.find((item) => item.id === meta.id) ?? { id: meta.id, usedUsd: 0, capUsd: 0 };
    const percent = irissLimitsPercent(row.usedUsd, row.capUsd);
    return {
      id: meta.id,
      label: meta.label,
      href: meta.href,
      percent,
      percentLabel: formatIrissLimitsPercent(percent),
      spendLabel: formatIrissLimitsSpend(row.usedUsd, row.capUsd),
      tone: stale ? "ok" : irissLimitsTone(percent),
    };
  });
  return NextResponse.json({
    ok: true,
    updatedAt: snap.updatedAt,
    refreshedLabel: formatIrissLimitsRefreshed(snap.updatedAt),
    stale,
    worst: stale ? "ok" : irissLimitsWorstTone(rows.map((row) => row.tone)),
    rows,
  });
}
