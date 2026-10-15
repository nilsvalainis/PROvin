/**
 * Ikdienas VIN SCAN kanārijputns: 2-3 zināmi VIN, tikai bezmaksas avoti (vin_decode + stat.vin).
 * Auth: `Authorization: Bearer CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { authorizeMorningSummaryCron } from "@/lib/admin-morning-summary-email";
import { VIN_SCAN_CANARY_VINS, vinScanCanarySourceIds } from "@/lib/vin-scan/canary";
import { runVinScan } from "@/lib/vin-scan/run";
import { isPaidVinScanSourceId } from "@/lib/vin-scan/free-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const gate = authorizeMorningSummaryCron(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const sourceIds = vinScanCanarySourceIds().filter((id) => !isPaidVinScanSourceId(id));
  const results: { vin: string; statVinRecord: boolean; status: string; ms: number }[] = [];
  for (const row of VIN_SCAN_CANARY_VINS) {
    const started = Date.now();
    try {
      const indicators = await runVinScan({ vin: row.vin, sourceIds });
      const stat = indicators.find((item) => item.id === "stat_vin");
      results.push({
        vin: row.vin,
        statVinRecord: row.statVinRecord,
        status: stat?.status || "missing",
        ms: Date.now() - started,
      });
      console.info(
        JSON.stringify({
          canary: true,
          vin: row.vin,
          id: "stat_vin",
          status: stat?.status || "missing",
          reason: stat?.summary || "",
          ms: Date.now() - started,
        }),
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : "canary_failed";
      results.push({ vin: row.vin, statVinRecord: row.statVinRecord, status: "error", ms: Date.now() - started });
      console.info(JSON.stringify({ canary: true, vin: row.vin, id: "stat_vin", status: "error", reason, ms: Date.now() - started }));
    }
  }

  return NextResponse.json({ ok: true, sources: sourceIds, results });
}
