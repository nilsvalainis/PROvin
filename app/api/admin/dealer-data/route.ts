/**
 * Dīlera datu automātiskās ielases statuss un manuāla pārstartēšana (admin).
 *
 * GET  ?sessionId=cs_…  - statuss dīlera avota blokam.
 * POST { sessionId, vin?, force? } - palaiž ielasi vēlreiz.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { runDealerDataJob } from "@/lib/dealer-data-job";
import { readDealerDataJob } from "@/lib/dealer-data-job-store";
import {
  dealerDataJobSuggestsRefund,
  describeDealerDataJob,
} from "@/lib/dealer-data-job-types";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  const job = await readDealerDataJob(sessionId);
  return NextResponse.json({
    ok: true,
    job,
    label: describeDealerDataJob(job),
    suggestsRefund: dealerDataJobSuggestsRefund(job),
  });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = String(o.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const existing = await readDealerDataJob(sessionId);
  const vin = normalizeVin(String(o.vin ?? existing?.vin ?? ""));
  if (!isValidVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }

  const result = await runDealerDataJob({
    sessionId,
    vin,
    trigger: "manual",
    // Operators redz cenu brīdinājumu UI pusē, tāpēc šeit `force` ir apzināts.
    force: o.force === true,
    skipAi: o.skipAi === true,
  });
  const job = await readDealerDataJob(sessionId);

  return NextResponse.json(
    {
      ...result,
      job,
      label: describeDealerDataJob(job),
      suggestsRefund: dealerDataJobSuggestsRefund(job),
    },
    { status: result.ok ? 200 : 502 },
  );
}
