/**
 * Manuālā OneAuto josla adminā (izmeklēšana 20.11.2026): automātika jau nopirktos datus josla
 * neredzēja un pirka vēlreiz (~19 € lieki 3 nedēļās). Šeit:
 * - jau nopirktie produkti (darba ierakstā vai melnrakstā, tam pašam VIN) netiek pirkti vēlreiz,
 *   ja vien operators skaidri neapstiprina «Pirkt vēlreiz» (`force`);
 * - pēc manuāla pirkuma rezultāti uzreiz tiek saglabāti serverī (dīlera darba ierakstā), lai
 *   tie nepazūd, ja lapu aizver pirms melnraksta saglabāšanas, un «Atkārtot» tos izmanto bez maksas;
 * - ja vēsture ar ierakstiem ir nopirkta, darba statuss kļūst «Ielasīts».
 */
import "server-only";

import { readOrderDraft, isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import {
  DEALER_AUTO_PRODUCT_IDS,
  dealerPaidOutcomeFromResult,
  type DealerAutoProductId,
  type DealerPaidProductOutcome,
} from "@/lib/dealer-data-job-types";
import { parseResultMap, type OneautoProductResult } from "@/lib/oneauto-block";
import {
  buildOneautoDisplay,
  filledOneautoServiceEvents,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import { splitOneautoAlreadyPurchased } from "@/lib/oneauto-manual-purchase-core";
import { mergeOneautoProductResults } from "@/lib/oneauto-to-auto-records";
import { normalizeVin } from "@/lib/order-field-validation";

type ResultMap = Partial<Record<OneautoProductId, OneautoProductResult>>;

/** Šim pasūtījumam un VIN jau saglabātie OneAuto rezultāti (darba ieraksts + melnraksts). */
export async function readStoredOneautoResults(sessionId: string, vin: string): Promise<ResultMap> {
  if (!isSafeOrderDraftSessionId(sessionId)) return {};
  const v = normalizeVin(vin);
  const [job, draft] = await Promise.all([
    readDealerDataJob(sessionId).catch(() => null),
    readOrderDraft(sessionId).catch(() => null),
  ]);
  const fromJob = job && normalizeVin(job.vin) === v ? parseResultMap(job.oneautoResults) : {};
  const ingest = draft?.workspace
    ? mergeSourceBlocksWithDefaults(draft.workspace.sourceBlocks).auto_records.oneautoIngest
    : null;
  const fromDraft = ingest && normalizeVin(ingest.lastFetchedVin) === v ? ingest.results : {};
  return mergeOneautoProductResults(fromJob, fromDraft);
}

export { splitOneautoAlreadyPurchased };

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
    await upsertDealerDataJob(args.sessionId, {
      vin,
      ...(historyOk && existing?.status !== "running"
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
