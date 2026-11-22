/**
 * Ēnu režīms: admina atsauksme par kvalitātes pārbaudes spriedumu (sūtīšanas formā).
 * POST { sessionId, correct: boolean, note? } - glabā darba ierakstā `shadowFeedback`.
 */
import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { readDealerDataJob, writeDealerShadowFeedback } from "@/lib/dealer-data-job-store";
import { DEALER_SHADOW_NOTE_MAX } from "@/lib/dealer-shadow-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const o = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const sessionId = String(o.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  if (typeof o.correct !== "boolean") return NextResponse.json({ error: "invalid_correct" }, { status: 400 });
  const job = await readDealerDataJob(sessionId);
  if (!job?.shadowGate) return NextResponse.json({ error: "no_gate" }, { status: 404 });
  const note = typeof o.note === "string" ? o.note.replace(/\s+/g, " ").trim().slice(0, DEALER_SHADOW_NOTE_MAX) : "";
  const next = await writeDealerShadowFeedback(sessionId, job.vin, {
    correct: o.correct,
    note: o.correct ? "" : note,
    at: new Date().toISOString(),
    verdict: job.shadowGate.verdict,
    gateAt: job.shadowGate.at,
  });
  if (!next) return NextResponse.json({ error: "write_failed" }, { status: 409 });
  return NextResponse.json({ ok: true, job: next });
}
