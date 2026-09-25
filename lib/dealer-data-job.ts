import "server-only";

import { translateOneautoWorksOnIngest } from "@/lib/admin-ai-oneauto-translate";
import { generateSourceCommentWithAi } from "@/lib/admin-ai-source-comment";
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
import {
  decideDealerDataRun,
  type DealerDataJob,
} from "@/lib/dealer-data-job-types";
import { readDealerDataJob, upsertDealerDataJob } from "@/lib/dealer-data-job-store";
import { fetchOneautoProducts, getOneautoApiConfig } from "@/lib/oneauto-api";
import {
  buildOneautoDisplay,
  filledOneautoServiceEvents,
  oneautoDisplayHasRows,
  oneautoPayloadIsNoData,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import {
  applyOneautoToAutoRecords,
  emptyOneautoIngest,
  mergeOneautoProductResults,
  type AutoRecordsOneautoIngest,
} from "@/lib/oneauto-to-auto-records";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/**
 * Dīlera datu A-Z ķēde: pēc apmaksas ielasa OE servisa vēsturi, ieliek to
 * OFICIĀLĀ DĪLERA DATI avotā un sagatavo eļļas intervālu un komentāru melnrakstus.
 *
 * Automātika iekasē tikai vienu produktu. Pārējie OneAuto produkti paliek
 * operatora rokās, jo tie nav dīlera produkta cenā.
 */
const AUTO_PRODUCTS: readonly OneautoProductId[] = ["oe_service_history"];

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
async function generateDealerNotes(sessionId: string, vin: string): Promise<boolean> {
  const draft = await readOrderDraft(sessionId);
  const baseline = draft?.workspace;
  if (!baseline) return false;
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);

  if (blocks.auto_records.comments.trim()) return false;

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
      comments: current.auto_records.comments.trim() || generatedComments,
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

export async function runDealerDataJob(args: {
  sessionId: string;
  vin: string;
  trigger: DealerDataJob["trigger"];
  force?: boolean;
  /** Ielasa datus, bet AI melnrakstus neģenerē (ātrai atkārtotai palaišanai). */
  skipAi?: boolean;
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
  const decision = decideDealerDataRun({ job: existing, vin, force: args.force });
  if (!decision.run) {
    return { ok: true, status: existing?.status ?? "pending", reason: decision.reason };
  }

  const attempts = (existing?.attempts ?? 0) + 1;
  await upsertDealerDataJob(sessionId, {
    vin,
    status: "running",
    attempts,
    startedAt: new Date().toISOString(),
    trigger: args.trigger,
  });

  let fetched: Awaited<ReturnType<typeof fetchOneautoProducts>>;
  try {
    fetched = await fetchOneautoProducts({ vin, products: AUTO_PRODUCTS });
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 200) : "network_error";
    await upsertDealerDataJob(sessionId, { vin, status: "failed", attempts, error, trigger: args.trigger });
    return { ok: false, status: "failed", reason: error };
  }

  const result = fetched.results.oe_service_history;
  if (result && result.ok === false) {
    // `insufficient_balance` un `api_unavailable` ir mūsu puses problēma, ne klienta:
    // atmaksu nepiedāvājam, operators mēģina vēlreiz.
    const error = String(result.error ?? "upstream_error").slice(0, 200);
    await upsertDealerDataJob(sessionId, { vin, status: "failed", attempts, error, trigger: args.trigger });
    return { ok: false, status: "failed", reason: error };
  }

  const noData =
    !result ||
    oneautoPayloadIsNoData(result.payload) ||
    !oneautoDisplayHasRows(fetched.display);

  if (noData) {
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "no_data",
      attempts,
      serviceEventCount: 0,
      finishedAt: new Date().toISOString(),
      trigger: args.trigger,
    });
    return { ok: true, status: "no_data", reason: "no_data", serviceEventCount: 0 };
  }

  const display = await translateOneautoWorksOnIngest(fetched.display);
  const serviceEventCount = filledOneautoServiceEvents(fetched.display.serviceTimeline).length;

  const wrote = await writeAutoRecords(sessionId, (blocks) => {
    const previousIngest = blocks.auto_records.oneautoIngest ?? emptyOneautoIngest();
    const results = mergeOneautoProductResults(previousIngest.results, fetched.results);
    const payloads: Partial<Record<OneautoProductId, unknown>> = {};
    for (const id of Object.keys(results) as OneautoProductId[]) {
      payloads[id] = results[id]?.payload;
    }
    const rebuiltOriginal = buildOneautoDisplay(payloads);
    const freshOriginal = filledOneautoServiceEvents(rebuiltOriginal.serviceTimeline);
    const ingest: AutoRecordsOneautoIngest = {
      ...previousIngest,
      lastFetchedVin: vin,
      fetchedAt: new Date().toISOString(),
      lastCostEur: fetched.costEur,
      selectedProducts: Array.from(new Set([...previousIngest.selectedProducts, ...AUTO_PRODUCTS])),
      results,
      serviceTimelineOriginal:
        freshOriginal.length > 0 ? freshOriginal : previousIngest.serviceTimelineOriginal,
    };
    return {
      ...blocks,
      auto_records: applyOneautoToAutoRecords(blocks.auto_records, { display, ingest }),
    };
  });

  if (!wrote) {
    await upsertDealerDataJob(sessionId, {
      vin,
      status: "failed",
      attempts,
      error: "draft_write_failed",
      trigger: args.trigger,
    });
    return { ok: false, status: "failed", reason: "draft_write_failed" };
  }

  const aiGenerated = args.skipAi ? false : await generateDealerNotes(sessionId, vin);

  await upsertDealerDataJob(sessionId, {
    vin,
    status: "done",
    attempts,
    serviceEventCount,
    aiGenerated,
    finishedAt: new Date().toISOString(),
    trigger: args.trigger,
  });

  return { ok: true, status: "done", reason: "done", serviceEventCount };
}
