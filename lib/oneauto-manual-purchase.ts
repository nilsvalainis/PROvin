/**
 * Manuālā OneAuto josla adminā. Nila lēmums 20.11.2026: poga vienmēr ielasa no OneAuto
 * (atkārtota tā paša VIN OE vēsture netiek iekasēta), bloķēšanas nav. Šeit:
 * - pēc manuāla pirkuma rezultāti uzreiz tiek saglabāti serverī (dīlera darba ierakstā), lai
 *   tie nepazūd, ja lapu aizver pirms melnraksta saglabāšanas, un «Atkārtot» tos izmanto bez maksas;
 * - ja vēsture ar ierakstiem ir nopirkta, darba statuss kļūst «Ielasīts».
 * - BF 27.11 (S6): ja automātiskā ielase iepriekš krita (piem. OneAuto «insufficient_balance») un vēsture
 *   tagad nopirkta manuāli, darbs NEDRĪKST beigties «Ielasīts» bez AI komentāriem. Tas atgriežas rindā
 *   («pending», bez maksas soļiem - viss jau nopirkts) un cron no jau esošā RAW ieraksta vēsturi melnrakstā,
 *   ģenerē abus AI komentārus un tikai tad atzīmē «Ielasīts».
 */
import "server-only";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import {
  DEALER_AUTO_PRODUCT_IDS,
  dealerPaidOutcomeFromResult,
  type DealerAutoProductId,
  type DealerDataJob,
  type DealerPaidProductOutcome,
} from "@/lib/dealer-data-job-types";
import { parseResultMap, type OneautoProductResult } from "@/lib/oneauto-block";
import {
  buildOneautoDisplay,
  filledOneautoServiceEvents,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import { mergeOneautoProductResults } from "@/lib/oneauto-to-auto-records";
import { normalizeVin } from "@/lib/order-field-validation";

type ResultMap = Partial<Record<OneautoProductId, OneautoProductResult>>;

/**
 * Vai pēc manuāla vēstures pirkuma dīlera darbs jāpabeidz automātikai (AI komentāri no RAW), nevis
 * jāatzīmē «Ielasīts» uzreiz. Darbs, ko izveidoja automātika (webhook / cron) vai kas nav pabeigts, un
 * kuram AI komentāri vēl nav ģenerēti. Tikai manuāla pirkuma ieraksts (audits, bez dīlera produkta) - nē.
 */
export function manualPurchaseNeedsDealerAiRun(
  existing: Pick<DealerDataJob, "status" | "trigger" | "aiGenerated"> | null,
): boolean {
  if (!existing || existing.aiGenerated === true) return false;
  if (existing.status === "running") return false;
  return existing.status !== "done" || existing.trigger !== "manual";
}

/** Saglabā manuāli nopirkto serverī uzreiz (dīlera darba ierakstā). Kļūda pirkumu neaptur. */
export async function recordManualOneautoPurchase(args: {
  sessionId: string;
  vin: string;
  results: ResultMap;
}): Promise<void> {
  if (!isSafeOrderDraftSessionId(args.sessionId)) return;
  const vin = normalizeVin(args.vin);
  try {
    const existing = await readDealerDataJob(args.sessionId);
    const sameVin = existing ? normalizeVin(existing.vin) === vin : true;
    const merged = mergeOneautoProductResults(
      sameVin ? parseResultMap(existing?.oneautoResults) : {},
      args.results,
    );
    const outcomes: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> = {};
    for (const id of DEALER_AUTO_PRODUCT_IDS) {
      const o = dealerPaidOutcomeFromResult(merged[id]);
      if (o) outcomes[id] = o;
    }
    const payloads: Partial<Record<OneautoProductId, unknown>> = {};
    for (const id of Object.keys(merged) as OneautoProductId[]) payloads[id] = merged[id]?.payload;
    const events = filledOneautoServiceEvents(buildOneautoDisplay(payloads).serviceTimeline).length;
    const historyOk = outcomes.oe_service_history === "ok" && events > 0;
    if (!existing && !historyOk) return; // bez dīlera darba un bez vēstures - nekādu jaunu ierakstu
    const record: Record<string, unknown> = {};
    for (const [id, row] of Object.entries(merged)) if (row) record[id] = row;
    const requeueForAi = historyOk && sameVin && manualPurchaseNeedsDealerAiRun(existing);
    await upsertDealerDataJob(args.sessionId, {
      vin,
      ...(requeueForAi
        ? {
            // Bez AI komentāriem «Ielasīts» nav: cron pabeidz no jau nopirktā RAW (bez jauna maksas soļa).
            status: "pending" as const,
            serviceEventCount: events,
            nextRetryAt: new Date().toISOString(),
            runId: "",
          }
        : historyOk && existing?.status !== "running"
        ? {
            status: "done" as const,
            serviceEventCount: events,
            finishedAt: new Date().toISOString(),
            ...(existing ? {} : { trigger: "manual" as const }),
          }
        : {}),
      paidOutcomes: outcomes,
      oneautoResults: record,
    });
  } catch (err) {
    console.error("[oneauto-manual-purchase] record failed", { sessionId: args.sessionId, err });
  }
}
