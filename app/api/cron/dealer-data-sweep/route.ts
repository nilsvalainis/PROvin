/**
 * Slaucītājs dīlera datu ielasēm, kuras webhook fona izpilde nepabeidza
 * (funkcija apturēta, deploy vidū, OneAuto pollings pārtrūka).
 * Ik 5 min: OneAuto 202 «apstrādē» atkārto pēc ~3 min, citas kļūdas pēc 30 min (`nextRetryAt`).
 *
 * Env: `ADMIN_DEALER_DATA_CRON_SECRET`.
 */
import { NextResponse } from "next/server";

import { runDealerDataJob } from "@/lib/dealer-data-job";
import { sendDealerDataAlertIfNeeded } from "@/lib/dealer-data-alert";
import {
  DEALER_DATA_MAX_AUTO_ATTEMPTS,
  DEALER_DATA_STALE_RUNNING_MS,
  dealerDataJobRetryDue,
} from "@/lib/dealer-data-job-types";
import { listUnfinishedDealerDataJobs, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import { bearerMatchesAnySecret } from "@/lib/cron-bearer";
import { retryDealerNoVinFromPlate } from "@/lib/order-plate-vin-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Viens darbs vienā palaišanā: maksas solis nedrīkst tikt nogalināts starp OneAuto atbildi un
 * ierakstu (5 darbi × līdz 300 s neiekļāvās maxDuration). Cron ik 5 min.
 */
const MAX_JOBS_PER_RUN = 1;

function isAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  // Vercel Cron sūta Bearer CRON_SECRET; papildus atbalstām projekta ADMIN_DEALER_DATA_CRON_SECRET.
  const candidates = [
    process.env.ADMIN_DEALER_DATA_CRON_SECRET?.trim() ?? "",
    process.env.CRON_SECRET?.trim() ?? "",
  ].filter(Boolean);
  if (candidates.length === 0) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  if (!bearerMatchesAnySecret(auth, candidates)) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const gate = isAuthorized(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const unfinished = await listUnfinishedDealerDataJobs();
    if (unfinished.length === 0) return NextResponse.json({ ok: true, unfinished: 0, processed: [] });
    const now = Date.now();
    const due = unfinished
      .filter((job) => job.attempts < DEALER_DATA_MAX_AUTO_ATTEMPTS && dealerDataJobRetryDue(job, now))
      .slice(0, MAX_JOBS_PER_RUN);

    const processed: Array<{ sessionId: string; status: string; reason: string }> = [];
    for (const job of due) {
      if (job.status === "no_vin") {
        // CSDD nebija sasniedzams pasūtījuma brīdī (26.11 EB5020) - vēlreiz numurzīme → VIN.
        const r = await retryDealerNoVinFromPlate(job);
        processed.push({ sessionId: job.sessionId, ...r });
        continue;
      }
      const r = await runDealerDataJob({
        sessionId: job.sessionId,
        vin: job.vin,
        trigger: "cron",
        respectNextRetry: true,
        deadlineAt: startedAt + 270_000,
      });
      processed.push({ sessionId: job.sessionId, status: r.status, reason: r.reason });
    }

    // Neviens klients nepamanīts: gala kļūdas (arī iestrēgušas «running») -> admina paziņojums, vienreiz.
    for (const job of unfinished) {
      if (job.status === "no_vin" || job.attempts < DEALER_DATA_MAX_AUTO_ATTEMPTS) continue;
      if (job.status === "running") {
        const started = Date.parse(job.startedAt ?? job.updatedAt);
        if (Number.isFinite(started) && now - started < DEALER_DATA_STALE_RUNNING_MS) continue;
        await upsertDealerDataJob(job.sessionId, { vin: job.vin, status: "failed", error: job.error || "stalled", runId: "" });
      }
      await sendDealerDataAlertIfNeeded(job.sessionId, { trigger: "cron" });
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
