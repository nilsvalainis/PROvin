/**
 * Slaucītājs dīlera datu ielasēm, kuras webhook fona izpilde nepabeidza
 * (funkcija apturēta, deploy vidū, OneAuto pollings pārtrūka).
 * Ik 5 min: OneAuto 202 «apstrādē» atkārto pēc ~3 min, OneAuto 5xx / taimauts («retry_wait») pēc
 * 10 min, 30 min, 2 h, citas kļūdas pēc 30 min (`nextRetryAt`).
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
import { sweepQuickEvalSmartId } from "@/lib/quick-eval-auto";
import { sweepThecarapiPhotoWait } from "@/lib/thecarapi-photo-wait-index";

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
    // Ātrie vērtējumi: gaidošie e.csdd / LTAB, tiklīdz Smart-ID sesija aktīva (citādi viens releja vaicājums).
    const quickEvalSmartId = await sweepQuickEvalSmartId().catch((err) => {
      console.warn("[cron/dealer-data-sweep] quick-eval smart-id", err instanceof Error ? err.message : "unknown");
      return null;
    });
    // TheCarApi bildes, kuras avots vēl gatavoja: atkārto pēc 1/3/12/24 h (tikai bilžu saraksts). Max 1 pasūtījums, ≤60 s.
    const thecarapiPhotos = await sweepThecarapiPhotoWait({ deadlineAt: Date.now() + 60_000, maxOrders: 1 }).catch((err) => {
      console.warn("[cron/dealer-data-sweep] thecarapi photos", err instanceof Error ? err.message : "unknown");
      return null;
    });
    const unfinished = await listUnfinishedDealerDataJobs();
    if (unfinished.length === 0) {
      return NextResponse.json({ ok: true, unfinished: 0, processed: [], quickEvalSmartId, thecarapiPhotos });
    }
    const now = Date.now();
    const due = unfinished
      .filter(
        (job) =>
          // «retry_wait» savus griestus tur pats (upstreamRetries ≤ 3), mēģinājumu skaitu nepalielina.
          (job.status === "retry_wait" || job.attempts < DEALER_DATA_MAX_AUTO_ATTEMPTS) &&
          dealerDataJobRetryDue(job, now),
      )
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
      if (job.status === "no_vin" || job.status === "retry_wait" || job.attempts < DEALER_DATA_MAX_AUTO_ATTEMPTS) continue;
      if (job.status === "running") {
        const started = Date.parse(job.startedAt ?? job.updatedAt);
        if (Number.isFinite(started) && now - started < DEALER_DATA_STALE_RUNNING_MS) continue;
        await upsertDealerDataJob(job.sessionId, { vin: job.vin, status: "failed", error: job.error || "stalled", runId: "" });
      }
      await sendDealerDataAlertIfNeeded(job.sessionId, { trigger: "cron" });
    }

    return NextResponse.json({
      ok: true,
      quickEvalSmartId,
      thecarapiPhotos,
      unfinished: unfinished.length,
      processed,
      /** Operatoram: šie gaida manuālu lēmumu (atmaksa vai atkārtots mēģinājums). */
      needsOperator: unfinished
        .filter((job) => job.status !== "retry_wait" && job.attempts >= DEALER_DATA_MAX_AUTO_ATTEMPTS)
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
