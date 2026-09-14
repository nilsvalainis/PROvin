/**
 * Slaucītājs dīlera datu ielasēm, kuras webhook fona izpilde nepabeidza
 * (funkcija apturēta, deploy vidū, OneAuto pollings pārtrūka).
 *
 * Env: `ADMIN_DEALER_DATA_CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { runDealerDataJob } from "@/lib/dealer-data-job";
import { DEALER_DATA_MAX_AUTO_ATTEMPTS } from "@/lib/dealer-data-job-types";
import { listUnfinishedDealerDataJobs } from "@/lib/dealer-data-job-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vienā palaišanā, lai neizsistu funkcijas laika limitu. */
const MAX_JOBS_PER_RUN = 5;

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  // Vercel Cron sūta Bearer CRON_SECRET; papildus atbalstām projekta ADMIN_DEALER_DATA_CRON_SECRET.
  const candidates = [
    process.env.ADMIN_DEALER_DATA_CRON_SECRET?.trim() ?? "",
    process.env.CRON_SECRET?.trim() ?? "",
  ].filter(Boolean);
  if (candidates.length === 0) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (!candidates.some((s) => auth === `Bearer ${s}`)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}

export async function GET(req: Request) {
  const gate = isAuthorized(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const unfinished = await listUnfinishedDealerDataJobs();
    const due = unfinished
      .filter((job) => job.attempts < DEALER_DATA_MAX_AUTO_ATTEMPTS)
      .slice(0, MAX_JOBS_PER_RUN);

    const processed: Array<{ sessionId: string; status: string; reason: string }> = [];
    for (const job of due) {
      const r = await runDealerDataJob({
        sessionId: job.sessionId,
        vin: job.vin,
        trigger: "cron",
      });
      processed.push({ sessionId: job.sessionId, status: r.status, reason: r.reason });
    }

    return NextResponse.json({
      ok: true,
      unfinished: unfinished.length,
      processed,
      /** Operatoram: šie gaida manuālu lēmumu (atmaksa vai atkārtots mēģinājums). */
      needsOperator: unfinished
        .filter((job) => job.attempts >= DEALER_DATA_MAX_AUTO_ATTEMPTS)
        .map((job) => ({ sessionId: job.sessionId, error: job.error ?? "" })),
    });
  } catch (e) {
    console.error("[cron/dealer-data-sweep] failed", e);
    return NextResponse.json(
      { error: "sweep_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
