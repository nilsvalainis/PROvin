import "server-only";

import { translateOneautoWorksOnIngest } from "@/lib/admin-ai-oneauto-translate";
import { generateSourceCommentWithAi } from "@/lib/admin-ai-source-comment";
import { aiExpertSourceCommentToRichHtml } from "@/lib/admin-rich-comment-html";
import {
  isSafeOrderDraftSessionId,
  patchOrderDraft,
  readOrderDraft,
} from "@/lib/admin-order-draft-store";
import {
  orderDraftWorkspaceToPersistBody,
  persistBodyToOrderDraftWorkspace,
} from "@/lib/admin-order-draft-workspace-merge";
import { createDefaultSourceBlocks, mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import type { OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { parseB2bWalletOrderMarks } from "@/lib/b2b-wallet";
import {
  DEALER_AUTO_PRODUCT_IDS,
  dealerAutoFetchHasTechnicalFail,
  dealerOeHistoryIsNoData,
  dealerPaidOutcomeFromResult,
  decideDealerDataRun,
  mergeDealerPaidOutcomes,
  resolveDealerCommentOutputLang,
  selectDealerAutoProductsToFetch,
  shouldAutoFetchOeVinLookup,
  type DealerAutoProductId,
  type DealerCommentOutputLang,
  type DealerDataJob,
  type DealerPaidProductOutcome,
} from "@/lib/dealer-data-job-types";
import {
  commentContradictsPowertrain,
  extractLoadedPowertrainIdentity,
  toGeneratedAgainst,
} from "@/lib/comment-powertrain-guard";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import { refundB2bWalletOrderIfNoData } from "@/lib/b2b-wallet-refund";
import { fetchOneautoProducts, getOneautoApiConfig } from "@/lib/oneauto-api";
import {
  buildOneautoDisplay,
  filledOneautoServiceEvents,
  oneautoPayloadIsNoData,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import { parseResultMap } from "@/lib/oneauto-block";
import {
  applyOneautoToAutoRecords,
  emptyOneautoIngest,
  mergeOneautoProductResults,
  type AutoRecordsOneautoIngest,
} from "@/lib/oneauto-to-auto-records";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/**
 * Dīlera datu A-Z ķēde: pēc apmaksas ielasa OE Service History Europe (€3.00).
 * Ja vēsturei ir ieraksti, vienreiz ielasa arī OE VIN Lookup (€0.36).
 * VIN Decoder (€0.18) nekad netiek ielasīts automātiski. Citi OneAuto
 * produkti paliek operatora rokās. Klientam nekas netiek nosūtīts.
 */
const AUTO_PRODUCTS: readonly OneautoProductId[] = [...DEALER_AUTO_PRODUCT_IDS];

export type DealerDataRunResult = {
  ok: boolean;
  status: DealerDataJob["status"];
  reason: string;
  serviceEventCount?: number;
};

function emptyWorkspaceBody(): OrderDraftWorkspaceBody {
  return {
    sourceBlocks: createDefaultSourceBlocks(),
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    previewConfirmed: false,
  };
}

/** Melnraksta darba zonas ierakstīšana ar coalesce uz jaunāko stāvokli. */
async function writeAutoRecords(
  sessionId: string,
  mutate: (blocks: ReturnType<typeof mergeSourceBlocksWithDefaults>) => ReturnType<typeof mergeSourceBlocksWithDefaults>,
): Promise<boolean> {
  const prev = await readOrderDraft(sessionId);
  const baseline = prev?.workspace ?? emptyWorkspaceBody();
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);
  const incoming = persistBodyToOrderDraftWorkspace(
    { ...orderDraftWorkspaceToPersistBody(baseline), sourceBlocks: mutate(blocks) },
    baseline.pdfVisibility,
    baseline.pdfBannerInclude,
    baseline.manualBanners,
  );
  const patched = await patchOrderDraft(sessionId, { workspace: incoming }, { force: true });
  if (!patched.ok) {
    console.warn("[dealer-data-job] draft write failed", { sessionId, error: patched.error });
    return false;
  }
  return true;
}

/**
 * AI melnraksts dīlera komentāram. Automātiskā API ielase ģenerē TIKAI lauku
 * „Komentāri” un tajā pašā rindkopu kopā iekļauj arī eļļas maiņas intervālu
 * matemātiku (nevis atsevišķu „Eļļas maiņas intervāli” lauku) — operators to
 * lauku var vēlāk ģenerēt manuāli, ja vēlas atsevišķu versiju.
 * Ģenerē tikai tukšu lauku, lai atkārtota palaišana nepārrakstītu operatora tekstu.
 */
async function generateDealerNotes(
  sessionId: string,
  vin: string,
  commentLang: DealerCommentOutputLang,
): Promise<boolean> {
  const draft = await readOrderDraft(sessionId);
  const baseline = draft?.workspace;
  if (!baseline) return false;
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);

  const identity = extractLoadedPowertrainIdentity(blocks, { vin });
  const existingPlain = blocks.auto_records.comments.trim()
    ? blocks.auto_records.comments
    : "";
  const mustReplace =
    Boolean(existingPlain) && commentContradictsPowertrain(existingPlain, identity);
  if (existingPlain && !mustReplace) return false;

  let generatedComments = "";
  try {
    generatedComments = (
      await generateSourceCommentWithAi({
        sessionId,
        blockKey: "auto_records",
        vin,
        listingUrl: draft?.orderEdits?.listingUrl ?? null,
        customerName: draft?.orderEdits?.customerName ?? null,
        notes: draft?.orderEdits?.notes ?? null,
        sourceBlocks: blocks,
        iriss: baseline.iriss,
        apskatesPlāns: baseline.apskatesPlāns,
        tehniskoRiskuAnalize: baseline.tehniskoRiskuAnalize,
        cenasAtbilstiba: baseline.cenasAtbilstiba,
        internalComment: draft?.orderEdits?.internalComment ?? null,
        targetField: "comments",
        includeOilIntervalSummary: true,
        isolateDealerComments: true,
        checkoutLine: "dealer",
        outputLang: commentLang,
        // Avota komentāri vienmēr ar Gemini, ne noklusējuma Claude ceļu.
        modelTier: "gemini-flash",
      })
    ).trim();
  } catch (e) {
    console.warn("[dealer-data-job] AI note failed", {
      sessionId,
      field: "comments",
      error: e instanceof Error ? e.message : "unknown",
    });
  }
  if (!generatedComments) return false;

  return writeAutoRecords(sessionId, (current) => ({
    ...current,
    auto_records: {
      ...current.auto_records,
      // Operatora teksts vienmēr uzvar: rakstām tikai, ja lauks joprojām tukšs.
      comments: mustReplace
        ? aiExpertSourceCommentToRichHtml(generatedComments)
        : current.auto_records.comments.trim() ||
          aiExpertSourceCommentToRichHtml(generatedComments),
      oneautoIngest: {
        ...(current.auto_records.oneautoIngest ?? emptyOneautoIngest()),
        generatedAgainst: toGeneratedAgainst(identity),
      },
    },
  }));
}

/**
 * Atzīmē darbu kā gaidošu uzreiz pēc apmaksas. Ja fona izpilde nenotiek
 * (funkcija apturēta, deploy vidū), cron slaucītājs to atradīs pēc indeksa.
 */
export async function enqueueDealerDataJob(args: {
  sessionId: string;
  vin: string;
}): Promise<boolean> {
  const vin = normalizeVin(args.vin ?? "");
  if (!isSafeOrderDraftSessionId(args.sessionId) || !isValidVin(vin)) return false;
  const existing = await readDealerDataJob(args.sessionId);
  if (existing && decideDealerDataRun({ job: existing, vin }).run === false) return false;
  const job = await upsertDealerDataJob(args.sessionId, {
    vin,
    status: "pending",
    trigger: "webhook",
  });
  return job !== null;
}

function outcomesFromResults(
  results: Partial<Record<OneautoProductId, { ok?: boolean; error?: string }>>,
): Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> {
  const out: Partial<Record<DealerAutoProductId, DealerPaidProductOutcome>> = {};
  for (const id of DEALER_AUTO_PRODUCT_IDS) {
    const o = dealerPaidOutcomeFromResult(results[id]);
    if (o) out[id] = o;
  }
  return out;
}

function resultsRecord(
  results: Partial<Record<OneautoProductId, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, row] of Object.entries(results)) {
    if (row != null) out[id] = row;
  }
  return out;
}

export async function runDealerDataJob(args: {
  sessionId: string;
  vin: string;
  trigger: DealerDataJob["trigger"];
  force?: boolean;
  /** Ielasa datus, bet AI melnrakstus neģenerē (ātrai atkārtotai palaišanai). */
  skipAi?: boolean;
  /** RAW produkts: OEM ieraksti paliek oriģinālvalodā, bez darbu tulkojuma uz LV. */
  skipTranslate?: boolean;
}): Promise<DealerDataRunResult> {
  const sessionId = args.sessionId;
  const vin = normalizeVin(args.vin ?? "");

  if (!isSafeOrderDraftSessionId(sessionId)) {
    return { ok: false, status: "failed", reason: "invalid_session" };
  }
  if (!isValidVin(vin)) {
    return { ok: false, status: "failed", reason: "invalid_vin" };
  }
  if (!getOneautoApiConfig()) {
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "failed",
      error: "missing_oneauto_credentials",
      trigger: args.trigger,
    });
    return { ok: false, status: "failed", reason: "missing_oneauto_credentials" };
  }

  const existing = await readDealerDataJob(sessionId);
  const decision = decideDealerDataRun({
    job: existing,
    vin,
    force: args.force,
    trigger: args.trigger,
  });
  if (!decision.run) {
    return { ok: true, status: existing?.status ?? "pending", reason: decision.reason };
  }

  const draft = await readOrderDraft(sessionId);
  const notes = draft?.orderEdits?.notes ?? "";
  const marks = parseB2bWalletOrderMarks(notes);
  const skipTranslate =
    args.skipTranslate ?? existing?.skipTranslate ?? marks?.product === "dealer_raw";
  const commentLang = resolveDealerCommentOutputLang({
    walletProduct: marks?.product,
    reportLang: marks?.reportLang,
    skipTranslate,
  });

  const previousIngest = mergeSourceBlocksWithDefaults(
    draft?.workspace?.sourceBlocks ?? emptyWorkspaceBody().sourceBlocks,
  ).auto_records.oneautoIngest;
  const storedResults = mergeOneautoProductResults(
    parseResultMap(existing?.oneautoResults),
    previousIngest?.results,
  );
  const storedOutcomes = mergeDealerPaidOutcomes(
    existing?.paidOutcomes,
    outcomesFromResults(storedResults),
  );
  const toFetch = selectDealerAutoProductsToFetch(storedOutcomes);

  const attempts = (existing?.attempts ?? 0) + 1;
  await upsertDealerDataJob(sessionId, {
    vin,
    status: "running",
    attempts,
    startedAt: new Date().toISOString(),
    trigger: args.trigger,
    skipTranslate,
    commentLang,
    paidOutcomes: storedOutcomes,
  });

  let mergedResults = storedResults;
  let lastCostEur = previousIngest?.lastCostEur ?? "";
  if (toFetch.length > 0) {
    let fetched: Awaited<ReturnType<typeof fetchOneautoProducts>>;
    try {
      fetched = await fetchOneautoProducts({ vin, products: toFetch });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 200) : "network_error";
      await upsertDealerDataJob(sessionId, { vin, status: "failed", attempts, error, trigger: args.trigger });
      return { ok: false, status: "failed", reason: error };
    }
    mergedResults = mergeOneautoProductResults(storedResults, fetched.results);
    lastCostEur = fetched.costEur || lastCostEur;
    const paidOutcomes = mergeDealerPaidOutcomes(storedOutcomes, outcomesFromResults(mergedResults));
    // Saglabā rezultātus PIRMS melnraksta rakstīšanas, lai retry neiekasētu vēlreiz.
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "running",
      attempts,
      trigger: args.trigger,
      skipTranslate,
      commentLang,
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
    });
  }

  let paidOutcomes = mergeDealerPaidOutcomes(storedOutcomes, outcomesFromResults(mergedResults));
  const oeOutcome = paidOutcomes.oe_service_history ?? null;
  const historyTechnical = dealerAutoFetchHasTechnicalFail({
    oe_service_history: paidOutcomes.oe_service_history,
  });
  if (historyTechnical) {
    const error = String(mergedResults[historyTechnical]?.error ?? `${historyTechnical}_failed`).slice(0, 200);
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "failed",
      attempts,
      error,
      trigger: args.trigger,
      skipTranslate,
      commentLang,
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
    });
    return { ok: false, status: "failed", reason: error };
  }

  const payloads: Partial<Record<OneautoProductId, unknown>> = {};
  for (const id of Object.keys(mergedResults) as OneautoProductId[]) {
    payloads[id] = mergedResults[id]?.payload;
  }
  let originalDisplay = buildOneautoDisplay(payloads);
  const historyEventCount = filledOneautoServiceEvents(originalDisplay.serviceTimeline).length;
  const oeNoData =
    dealerOeHistoryIsNoData(oeOutcome) ||
    !mergedResults.oe_service_history ||
    oneautoPayloadIsNoData(mergedResults.oe_service_history.payload) ||
    historyEventCount === 0;

  if (
    !oeNoData &&
    shouldAutoFetchOeVinLookup({
      historyHasEntries: true,
      lookupOutcome: paidOutcomes.oe_vin_lookup,
    })
  ) {
    try {
      const lookupFetched = await fetchOneautoProducts({ vin, products: ["oe_vin_lookup"] });
      mergedResults = mergeOneautoProductResults(mergedResults, lookupFetched.results);
      lastCostEur = lookupFetched.costEur || lastCostEur;
      paidOutcomes = mergeDealerPaidOutcomes(paidOutcomes, outcomesFromResults(mergedResults));
      await upsertDealerDataJob(sessionId, {
        vin,
        status: "running",
        attempts,
        trigger: args.trigger,
        skipTranslate,
        commentLang,
        paidOutcomes,
        oneautoResults: resultsRecord(mergedResults),
      });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 200) : "network_error";
      await upsertDealerDataJob(sessionId, {
        vin,
        status: "failed",
        attempts,
        error,
        trigger: args.trigger,
        skipTranslate,
        commentLang,
        paidOutcomes,
        oneautoResults: resultsRecord(mergedResults),
      });
      return { ok: false, status: "failed", reason: error };
    }
    const lookupTechnical = dealerAutoFetchHasTechnicalFail({
      oe_vin_lookup: paidOutcomes.oe_vin_lookup,
    });
    if (lookupTechnical) {
      const error = String(mergedResults[lookupTechnical]?.error ?? `${lookupTechnical}_failed`).slice(0, 200);
      await upsertDealerDataJob(sessionId, {
        vin,
        status: "failed",
        attempts,
        error,
        trigger: args.trigger,
        skipTranslate,
        commentLang,
        paidOutcomes,
        oneautoResults: resultsRecord(mergedResults),
      });
      return { ok: false, status: "failed", reason: error };
    }
    for (const id of Object.keys(mergedResults) as OneautoProductId[]) {
      payloads[id] = mergedResults[id]?.payload;
    }
    originalDisplay = buildOneautoDisplay(payloads);
  }

  if (oeNoData) {
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "no_data",
      attempts,
      serviceEventCount: 0,
      finishedAt: new Date().toISOString(),
      trigger: args.trigger,
      skipTranslate,
      commentLang,
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
    });
    await refundB2bWalletOrderIfNoData(sessionId).catch((err) => {
      console.error("[dealer-data-job] wallet refund failed", { sessionId, err });
    });
    return { ok: true, status: "no_data", reason: "no_data", serviceEventCount: 0 };
  }

  const display = skipTranslate ? originalDisplay : await translateOneautoWorksOnIngest(originalDisplay);
  const serviceEventCount = filledOneautoServiceEvents(originalDisplay.serviceTimeline).length;

  const wrote = await writeAutoRecords(sessionId, (blocks) => {
    const prevIngest = blocks.auto_records.oneautoIngest ?? emptyOneautoIngest();
    const results = mergeOneautoProductResults(prevIngest.results, mergedResults);
    const rebuiltPayloads: Partial<Record<OneautoProductId, unknown>> = {};
    for (const id of Object.keys(results) as OneautoProductId[]) {
      rebuiltPayloads[id] = results[id]?.payload;
    }
    const rebuiltOriginal = buildOneautoDisplay(rebuiltPayloads);
    const freshOriginal = filledOneautoServiceEvents(rebuiltOriginal.serviceTimeline);
    const ingest: AutoRecordsOneautoIngest = {
      ...prevIngest,
      lastFetchedVin: vin,
      fetchedAt: new Date().toISOString(),
      lastCostEur: lastCostEur || prevIngest.lastCostEur,
      selectedProducts: Array.from(new Set([...prevIngest.selectedProducts, ...AUTO_PRODUCTS])),
      results,
      serviceTimelineOriginal:
        freshOriginal.length > 0 ? freshOriginal : prevIngest.serviceTimelineOriginal,
    };
    return {
      ...blocks,
      auto_records: applyOneautoToAutoRecords(blocks.auto_records, {
        display,
        ingest,
        vehicleOverride: Boolean(mergedResults.oe_vin_lookup?.ok),
      }),
    };
  });

  if (!wrote) {
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "failed",
      attempts,
      error: "draft_write_failed",
      trigger: args.trigger,
      skipTranslate,
      commentLang,
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
    });
    return { ok: false, status: "failed", reason: "draft_write_failed" };
  }

  const wroteNotes = args.skipAi ? false : await generateDealerNotes(sessionId, vin, commentLang);
  const commentsAfter = args.skipAi
    ? ""
    : (
        await readOrderDraft(sessionId).then((d) =>
          d?.workspace
            ? mergeSourceBlocksWithDefaults(d.workspace.sourceBlocks).auto_records.comments.trim()
            : "",
        )
      );
  const aiGenerated = Boolean(wroteNotes || commentsAfter);
  if (!args.skipAi && !aiGenerated) {
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "failed",
      attempts,
      error: "ai_generation_failed",
      trigger: args.trigger,
      skipTranslate,
      commentLang,
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
      serviceEventCount,
      aiGenerated: false,
    });
    return { ok: false, status: "failed", reason: "ai_generation_failed", serviceEventCount };
  }

  await upsertDealerDataJob(sessionId, {
    vin,
    status: "done",
    attempts,
    serviceEventCount,
    aiGenerated,
    finishedAt: new Date().toISOString(),
    trigger: args.trigger,
    skipTranslate,
    commentLang,
    paidOutcomes,
    oneautoResults: resultsRecord(mergedResults),
  });

  return { ok: true, status: "done", reason: "done", serviceEventCount };
}
