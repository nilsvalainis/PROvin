/**
 * Dīlera datu pārklājuma prognoze (27.11.2026).
 * GET - dinamiskais agregāts (marka|gadu grupa|avots -> [ar_datiem, kopā]); UI to saskaita ar statisko bāzi.
 * POST { sessionId, source, hasData } - pieskaita ārēja avota iznākumu (CheckThisReg / auto-records
 * ievade); OneAuto ielase ieskaitās pati (lib/dealer-data-job.ts). Bez VIN un personas datiem.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { DEALER_FORECAST_SOURCES, type DealerForecastSource } from "@/lib/dealer-coverage-forecast";
import { readDealerCoverageAggregate, recordDealerCoverageForSession } from "@/lib/dealer-coverage-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const agg = await readDealerCoverageAggregate();
  return NextResponse.json({ ok: true, counts: agg.counts, updatedAt: agg.updatedAt });
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
  const sessionId = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  const source = o.source as DealerForecastSource;
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  if (!DEALER_FORECAST_SOURCES.includes(source)) return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  if (typeof o.hasData !== "boolean") return NextResponse.json({ error: "invalid_has_data" }, { status: 400 });
  const recorded = await recordDealerCoverageForSession({ sessionId, source, hasData: o.hasData });
  return NextResponse.json({ ok: true, recorded });
}
