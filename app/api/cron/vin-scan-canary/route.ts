/**
 * Ikdienas VIN SCAN uzraudzība: katram servera pusē palaižamam avotam zelta VIN (sk. `lib/vin-scan/canary.ts`),
 * partijas pa 2, laika budžets 270 s. Rezultāts glabājas Blob; sabrukušam avotam push vienreiz
 * (sk. `lib/vin-scan/canary-alert.ts`), rīta kopsavilkumā rinda «VIN SCAN: N/M avoti strādā».
 * Auth: `Authorization: Bearer CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { authorizeMorningSummaryCron } from "@/lib/admin-morning-summary-email";
import { runVinScanCanaryWithAlert } from "@/lib/vin-scan/canary-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const gate = authorizeMorningSummaryCron(req.headers.get("authorization"));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json(await runVinScanCanaryWithAlert());
  } catch (e) {
    console.error("[cron/vin-scan-canary] failed", e);
    return NextResponse.json({ error: "canary_failed" }, { status: 500 });
  }
}
