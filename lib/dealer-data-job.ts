import "server-only";

import { randomUUID } from "crypto";

import { translateOneautoWorksOnIngest } from "@/lib/admin-ai-oneauto-translate";
import { generateSourceCommentWithAi } from "@/lib/admin-ai-source-comment";
import { adminRichHtmlToPlainText, aiExpertSourceCommentToRichHtml } from "@/lib/admin-rich-comment-html";
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
  dealerDecodeResultGaveData,
  dealerOeHistoryIsNoData,
  dealerPaidOutcomeFromResult,
  decideDealerDataRun,
  mergeDealerPaidOutcomes,
  planDealerVinDecodeStep,
  resolveDealerCommentOutputLang,
  selectDealerAutoProductsToFetch,
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
import {
  claimDealerDataJobRun,
  dealerDataRunLeaseHeld,
  readDealerDataJob,
  upsertDealerDataJob,
} from "@/lib/dealer-data-job-store";
import { sendDealerDataAlertIfNeeded } from "@/lib/dealer-data-alert";
import { reviewDealerCommentsWithOpus } from "@/lib/dealer-comments-review";
import {
  dealerCommentPlainCleanup,
  dropDealerCommentsDuplicatingOil,
  highlightMajorAssembliesInRichHtml,
  type DealerReviewField,
} from "@/lib/dealer-comments-review-core";
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
 * Ja vēsturei ir ieraksti - obligāti viens VIN dekodēšanas avots: OE VIN Lookup (€0.36),
 * ja tas datus nedod - VIN Decoder (€0.18). Katrs maksas produkts ne vairāk kā vienreiz.
 * Tad divi AI komentāri (eļļas intervāli + „Komentāri”) un Claude Opus noslēguma pārbaude.
 * Citi OneAuto produkti paliek operatora rokās. Klientam nekas netiek nosūtīts.
 */

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

type DealerNoteField = "oilChangeIntervalNotes" | "comments";

const DEALER_NOTE_LABEL: Record<DealerNoteField, string> = {
  oilChangeIntervalNotes: "Oficiālā dīlera dati - Eļļas maiņas intervāli",
  comments: "Oficiālā dīlera dati - Komentāri",
};

function richIsEmpty(html: string | null | undefined): boolean {
  return !adminRichHtmlToPlainText(html ?? "").trim();
}

/**
 * Divi AI melnraksti (Nils 20.11.2026): (a) „Eļļas maiņas intervāli” un (b) „Komentāri” bloka
 * apakšā. Līdz šim (kopš b4467c4d, 25.09.2026) ielase ģenerēja TIKAI „Komentāri” ar iekļautu eļļas
 * lomu, tāpēc atsevišķais komentārs vairs neradās. Abi ar Gemini (kā līdz šim), tad viens Claude
 * Opus noslēguma pārbaudes izsaukums pret dīlera datiem (FLASH MAX mehānisms), ieteikumi
 * piemēroti automātiski; lielie mezgli treknrakstā.
 * Ģenerē tikai tukšus laukus - operatora teksts vienmēr uzvar; atkārtota palaišana neko nepārraksta.
 */
async function generateDealerNotes(
  sessionId: string,
  vin: string,
  commentLang: DealerCommentOutputLang,
): Promise<Set<DealerNoteField>> {
  const none = new Set<DealerNoteField>();
  const draft = await readOrderDraft(sessionId);
  const baseline = draft?.workspace;
  if (!baseline) return none;
  const blocks = mergeSourceBlocksWithDefaults(baseline.sourceBlocks);

  const identity = extractLoadedPowertrainIdentity(blocks, { vin });
  const existingComments = richIsEmpty(blocks.auto_records.comments) ? "" : blocks.auto_records.comments;
  const replaceComments =
    Boolean(existingComments) && commentContradictsPowertrain(existingComments, identity);
  const targets: DealerNoteField[] = [];
  if (richIsEmpty(blocks.auto_records.oilChangeIntervalNotes)) targets.push("oilChangeIntervalNotes");
  if (!existingComments || replaceComments) targets.push("comments");
  if (targets.length === 0) return none;

  const generateOne = async (field: DealerNoteField): Promise<string> => {
    try {
      return dealerCommentPlainCleanup(
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
          targetField: field,
          isolateDealerComments: true,
          checkoutLine: "dealer",
          outputLang: commentLang,
          highlightMajorAssemblies: true,
          // Avota komentāri vienmēr ar Gemini, ne noklusējuma Claude ceļu.
          modelTier: "gemini-flash",
        }),
      );
    } catch (e) {
      console.warn("[dealer-data-job] AI note failed", {
        sessionId,
        field,
        error: e instanceof Error ? e.message : "unknown",
      });
      return "";
    }
  };

  const generatedList = await Promise.all(targets.map((field) => generateOne(field)));
  const fields: DealerReviewField[] = [];
  targets.forEach((field, i) => {
    const text = generatedList[i] ?? "";
    if (text) fields.push({ id: field, label: DEALER_NOTE_LABEL[field], text });
  });
  if (fields.length === 0) return none;

  // Opus pārbaude: ieteikumi latviski, tāpēc tikai LV komentāriem (PRO EN/DE/RU un RAW - bez tās).
  let texts: Record<string, string> = Object.fromEntries(fields.map((f) => [f.id, f.text]));
  if (commentLang === "lv") {
    try {
      const review = await reviewDealerCommentsWithOpus({ vin, sourceBlocks: blocks, fields });
      texts = review.texts;
      if (review.applied > 0) {
        console.info("[dealer-data-job] Opus review applied", { sessionId, applied: review.applied });
      }
    } catch (e) {
      console.warn("[dealer-data-job] Opus review failed", {
        sessionId,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }
  // Deterministisks drošības tīkls (Nils 22.11): „Komentāri” nedrīkst atkārtot eļļas lauku vai runāt
  // par eļļas maiņām - arī ja Opus nav izsaukts (PRO EN/DE/RU) vai to palaida garām.
  if (texts.comments) {
    const oilForDedup = texts.oilChangeIntervalNotes ?? adminRichHtmlToPlainText(blocks.auto_records.oilChangeIntervalNotes ?? "");
    const deduped = dropDealerCommentsDuplicatingOil(texts.comments, oilForDedup);
    if (deduped.trim()) texts = { ...texts, comments: deduped };
  }
  const toHtml = (text: string | undefined): string =>
    text?.trim() ? highlightMajorAssembliesInRichHtml(aiExpertSourceCommentToRichHtml(dealerCommentPlainCleanup(text))) : "";
  const oilHtml = toHtml(texts.oilChangeIntervalNotes);
  const commentsHtml = toHtml(texts.comments);

  const wrote = await writeAutoRecords(sessionId, (current) => {
    const ar = current.auto_records;
    // Operatora teksts vienmēr uzvar: rakstām tikai, ja lauks joprojām tukšs (vai pretrunīgs komentārs).
    const nextOil = richIsEmpty(ar.oilChangeIntervalNotes) && oilHtml ? oilHtml : ar.oilChangeIntervalNotes;
    const nextComments =
      commentsHtml && (replaceComments || richIsEmpty(ar.comments)) ? commentsHtml : ar.comments;
    return {
      ...current,
      auto_records: {
        ...ar,
        oilChangeIntervalNotes: nextOil,
        comments: nextComments,
        oneautoIngest: {
          ...(ar.oneautoIngest ?? emptyOneautoIngest()),
          generatedAgainst: toGeneratedAgainst(identity),
        },
      },
    };
  });
  if (!wrote) return none;
  const out = new Set<DealerNoteField>();
  if (oilHtml) out.add("oilChangeIntervalNotes");
  if (commentsHtml) out.add("comments");
  return out;
}

/**
 * Atzīmē darbu kā gaidošu uzreiz pēc apmaksas. Ja fona izpilde nenotiek
 * (funkcija apturēta, deploy vidū), cron slaucītājs to atradīs pēc indeksa.
 */
export async function enqueueDealerDataJob(args: {
  sessionId: string;
  vin: string;
  /**
   * Kad cron drīkst pārņemt. Noklusējums 5 min (webhook fona darbs sāk uzreiz, bez sacensības);
   * 0 - tikai cron (numurzīmes ceļš: atsevišķa funkcija ar savu laika budžetu).
   */
  cronAfterMs?: number;
}): Promise<boolean> {
  const vin = normalizeVin(args.vin ?? "");
  if (!isSafeOrderDraftSessionId(args.sessionId) || !isValidVin(vin)) return false;
  const existing = await readDealerDataJob(args.sessionId);
  if (existing && decideDealerDataRun({ job: existing, vin }).run === false) return false;
  const job = await upsertDealerDataJob(args.sessionId, {
    vin,
    status: "pending",
    trigger: "webhook",
    nextRetryAt: new Date(Date.now() + (args.cronAfterMs ?? 5 * 60 * 1000)).toISOString(),
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

function centsFromEur(raw: string | null | undefined): number {
  const n = Number.parseFloat(String(raw ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Ielases izmaksas summa (vēsture + VIN dekodēšana), formātā „3.36”. */
function addCostEur(prev: string, add: string): string {
  const cents = centsFromEur(prev) + centsFromEur(add);
  return cents > 0 ? (cents / 100).toFixed(2) : prev || add;
}

/** OneAuto 202 «In Progress»: ātrs atkārtojums (cron ik 5 min), mēģinājumu neskaita līdz griestiem. */
export const DEALER_PENDING_RETRY_MS = 3 * 60 * 1000;
export const DEALER_PENDING_MAX_RETRIES = 6;
/** Citas kļūdas: nākamais automātiskais mēģinājums pēc 30 min (kā līdz šim). */
export const DEALER_FAILED_RETRY_MS = 30 * 60 * 1000;

export async function runDealerDataJob(args: RunArgs): Promise<DealerDataRunResult> {
  const result = await runDealerDataJobInner(args);
  if (!result.ok || result.status === "failed" || (result.status === "no_data" && result.reason === "no_data")) {
    // Neviens klients nedrīkst palikt nepamanīts: push + e-pasts, ja problēma prasa operatoru.
    // «Datu nav»: paziņojums tikai, ja atmaksa vēl nav veikta (B2B maka atmaksa notiek pirms tam).
    await sendDealerDataAlertIfNeeded(args.sessionId, { trigger: args.trigger });
  }
  return result;
}

/** Pirms maksas soļa jābūt vismaz tik daudz laika (OneAuto polls līdz ~80 s + ieraksts). */
export const DEALER_PAID_STEP_MIN_REMAINING_MS = 110_000;
/** Noklusējuma laika budžets vienai palaišanai (funkcijas maxDuration 300 s). */
export const DEALER_RUN_DEFAULT_BUDGET_MS = 250_000;

type RunArgs = {
  sessionId: string;
  vin: string;
  trigger: DealerDataJob["trigger"];
  force?: boolean;
  /** Ielasa datus, bet AI melnrakstus neģenerē (ātrai atkārtotai palaišanai). */
  skipAi?: boolean;
  /** RAW produkts: OEM ieraksti paliek oriģinālvalodā, bez darbu tulkojuma uz LV. */
  skipTranslate?: boolean;
  /** Absolūts termiņš (ms); pēc tā maksas soļi netiek sākti - darbs atgriežas rindā. */
  deadlineAt?: number;
  /** Cron: respektē nextRetryAt svaigā ierakstā. */
  respectNextRetry?: boolean;
};

async function runDealerDataJobInner(args: RunArgs): Promise<DealerDataRunResult> {
  const sessionId = args.sessionId;
  const vin = normalizeVin(args.vin ?? "");
  const deadlineAt = args.deadlineAt ?? Date.now() + DEALER_RUN_DEFAULT_BUDGET_MS;

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

  const draft = await readOrderDraft(sessionId);
  const notes = draft?.orderEdits?.notes ?? "";
  const marks = parseB2bWalletOrderMarks(notes);

  // Atomiska noma (CAS): svaigā ierakstā decideDealerDataRun + nextRetryAt; paralēla palaišana nevar sākt.
  const runId = `run_${randomUUID()}`;
  const claim = await claimDealerDataJobRun({
    sessionId,
    vin,
    runId,
    trigger: args.trigger,
    force: args.force,
    respectNextRetry: args.respectNextRetry,
  });
  if (!claim.ok) {
    return { ok: true, status: claim.job?.status ?? "pending", reason: claim.reason };
  }
  const existing = claim.previous && normalizeVin(claim.previous.vin) === vin ? claim.previous : null;
  const attempts = claim.job.attempts;
  const firstDraftWrite = !claim.job.draftWrittenAt;

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
  // Melnraksta rezultāti der tikai tam pašam VIN (VIN maiņa - vecie dati netiek izmantoti).
  const ingestSameVin =
    previousIngest && normalizeVin(previousIngest.lastFetchedVin ?? "") === vin ? previousIngest : null;
  const storedResults = mergeOneautoProductResults(
    parseResultMap(claim.job.oneautoResults),
    ingestSameVin?.results,
  );
  const storedOutcomes = mergeDealerPaidOutcomes(
    claim.job.paidOutcomes,
    outcomesFromResults(storedResults),
  );
  const toFetch = selectDealerAutoProductsToFetch(storedOutcomes);

  /** Darba ieraksts tikai, kamēr šī palaišana tur nomu. */
  const save = (patch: Omit<Parameters<typeof upsertDealerDataJob>[1], "vin">) =>
    upsertDealerDataJob(
      sessionId,
      { vin, attempts, trigger: args.trigger, skipTranslate, commentLang, ...patch },
      { expectRunId: runId },
    );

  /** Laiks beidzas pirms maksas soļa: atgriežam darbu rindā (bez mēģinājuma skaitīšanas). */
  const requeueForTime = async (): Promise<DealerDataRunResult> => {
    await save({
      status: "pending",
      attempts: Math.max(0, attempts - 1),
      runId: "",
      nextRetryAt: new Date(Date.now() + 60_000).toISOString(),
    });
    return { ok: true, status: "pending", reason: "time_budget" };
  };
  /** Pirms katra maksas soļa: laiks + noma (svaigs nolasījums). */
  const canPay = async (): Promise<"ok" | "time" | "lease"> => {
    if (Date.now() > deadlineAt - DEALER_PAID_STEP_MIN_REMAINING_MS) return "time";
    return (await dealerDataRunLeaseHeld(sessionId, runId)) ? "ok" : "lease";
  };
  const leaseLost: DealerDataRunResult = { ok: true, status: "running", reason: "lease_lost" };

  await save({ status: "running", paidOutcomes: storedOutcomes, startedAt: new Date().toISOString() });

  let mergedResults = storedResults;
  let lastCostEur = ingestSameVin?.lastCostEur ?? "";
  let pendingRequestIds: Partial<Record<OneautoProductId, string>> = {};
  if (toFetch.length > 0) {
    const gate = await canPay();
    if (gate === "time") return requeueForTime();
    if (gate === "lease") return leaseLost;
    let fetched: Awaited<ReturnType<typeof fetchOneautoProducts>>;
    try {
      fetched = await fetchOneautoProducts({
        vin,
        products: toFetch,
        requestIds: claim.job.pendingRequestId ? { oe_service_history: claim.job.pendingRequestId } : undefined,
        // Samaksātais rezultāts darba ierakstā UZREIZ pēc atbildes (pirms izmaksu ieraksta).
        onResults: async (results) => {
          const merged = mergeOneautoProductResults(storedResults, results);
          await save({
            status: "running",
            paidOutcomes: mergeDealerPaidOutcomes(storedOutcomes, outcomesFromResults(merged)),
            oneautoResults: resultsRecord(merged),
          });
        },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 200) : "network_error";
      await save({
        status: "failed",
        error,
        runId: "",
        nextRetryAt: new Date(Date.now() + DEALER_FAILED_RETRY_MS).toISOString(),
      });
      return { ok: false, status: "failed", reason: error };
    }
    mergedResults = mergeOneautoProductResults(storedResults, fetched.results);
    lastCostEur = fetched.costEur || lastCostEur;
    pendingRequestIds = fetched.pendingRequestIds ?? {};
  }

  let paidOutcomes = mergeDealerPaidOutcomes(storedOutcomes, outcomesFromResults(mergedResults));
  const oeOutcome = paidOutcomes.oe_service_history ?? null;
  const historyTechnical = dealerAutoFetchHasTechnicalFail({
    oe_service_history: paidOutcomes.oe_service_history,
  });
  if (historyTechnical) {
    const error = String(mergedResults[historyTechnical]?.error ?? `${historyTechnical}_failed`).slice(0, 200);
    const pending = paidOutcomes.oe_service_history === "pending";
    const pendingRetries = (claim.job.pendingRetries ?? 0) + (pending ? 1 : 0);
    const fastRetry = pending && pendingRetries <= DEALER_PENDING_MAX_RETRIES;
    await save({
      status: "failed",
      // 202 «apstrādē» nav kļūda: ātrs atkārtojums, mēģinājumu skaits nepieaug.
      attempts: fastRetry ? attempts - 1 : attempts,
      pendingRetries,
      pendingRequestId: pending ? pendingRequestIds.oe_service_history ?? claim.job.pendingRequestId ?? "" : "",
      nextRetryAt: new Date(Date.now() + (fastRetry ? DEALER_PENDING_RETRY_MS : DEALER_FAILED_RETRY_MS)).toISOString(),
      error,
      runId: "",
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

  // VIN dekodēšana (Nils 20.11): OE VIN Lookup, ja tas datus nedod - VIN Decoder. Ne vairāk kā 2 soļi.
  let newDecodeData = false;
  let decodeDeferred = false;
  for (let step = 0; step < 2; step++) {
    const next = planDealerVinDecodeStep({
      historyHasEntries: !oeNoData,
      lookupOutcome: paidOutcomes.oe_vin_lookup,
      lookupGaveData: dealerDecodeResultGaveData(mergedResults.oe_vin_lookup),
      decoderOutcome: paidOutcomes.vin_decoder,
      decoderGaveData: dealerDecodeResultGaveData(mergedResults.vin_decoder),
    });
    if (!next) break;
    const gate = await canPay();
    if (gate === "lease") return leaseLost;
    if (gate === "time") {
      // Vēsture jau samaksāta - to ierakstām tagad, dekodēšana nākamajā palaišanā.
      decodeDeferred = true;
      break;
    }
    let decodeFetched: Awaited<ReturnType<typeof fetchOneautoProducts>> | null = null;
    try {
      decodeFetched = await fetchOneautoProducts({
        vin,
        products: [next],
        onResults: async (results) => {
          const merged = mergeOneautoProductResults(mergedResults, results);
          await save({
            status: "running",
            paidOutcomes: mergeDealerPaidOutcomes(paidOutcomes, outcomesFromResults(merged)),
            oneautoResults: resultsRecord(merged),
          });
        },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message.slice(0, 200) : "network_error";
      console.warn("[dealer-data-job] decode fetch failed", { sessionId, product: next, error });
      // Tīkla kļūda: atzīmējam kā mēģinātu (Lookup otrreiz nepērkam), Decoder - atkārtojams.
      mergedResults = mergeOneautoProductResults(mergedResults, {
        [next]: { ok: false, error, payload: null },
      });
    }
    if (decodeFetched) {
      mergedResults = mergeOneautoProductResults(mergedResults, decodeFetched.results);
      lastCostEur = addCostEur(lastCostEur, decodeFetched.costEur);
      if (dealerDecodeResultGaveData(decodeFetched.results[next])) newDecodeData = true;
    }
    paidOutcomes = mergeDealerPaidOutcomes(paidOutcomes, outcomesFromResults(mergedResults));
    if (!paidOutcomes[next]) paidOutcomes = { ...paidOutcomes, [next]: "failed" };
    await save({ status: "running", paidOutcomes, oneautoResults: resultsRecord(mergedResults) });
  }

  let decodeError = decodeDeferred ? "time_budget" : "";
  if (!oeNoData) {
    const lookupData = dealerDecodeResultGaveData(mergedResults.oe_vin_lookup);
    const decoderData = dealerDecodeResultGaveData(mergedResults.vin_decoder);
    const decoderTechnical = dealerAutoFetchHasTechnicalFail({ vin_decoder: paidOutcomes.vin_decoder });
    // Tehniska VIN dekodēšanas kļūda NEbloķē jau samaksātās vēstures ierakstu melnrakstā:
    // vēsture + komentāri tiek ierakstīti, dekodēšana atkārtojas atsevišķi (cron).
    if (!lookupData && !decoderData && decoderTechnical) {
      decodeError = String(mergedResults.vin_decoder?.error ?? "vin_decoder_failed").slice(0, 200);
    }
    for (const id of Object.keys(mergedResults) as OneautoProductId[]) {
      payloads[id] = mergedResults[id]?.payload;
    }
    originalDisplay = buildOneautoDisplay(payloads);
  }

  if (oeNoData) {
    await save({
      status: "no_data",
      serviceEventCount: 0,
      finishedAt: new Date().toISOString(),
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
    });
    await refundB2bWalletOrderIfNoData(sessionId).catch((err) => {
      console.error("[dealer-data-job] wallet refund failed", { sessionId, err });
    });
    return { ok: true, status: "no_data", reason: "no_data", serviceEventCount: 0 };
  }

  const serviceEventCount = filledOneautoServiceEvents(originalDisplay.serviceTimeline).length;

  // Pirmais ieraksts: pilna vēsture (tulkota), VIN dekodēšana pārraksta auto laukus.
  // Atkārtojumi (ai_generation_failed, vin_decode:, Atkārtot): vēsturi netulko un nepārraksta;
  // jauni VIN dekodēšanas dati aizpilda tikai tukšos auto laukus.
  const writeMode: "full" | "vehicle_only" | "none" = firstDraftWrite
    ? "full"
    : newDecodeData
      ? "vehicle_only"
      : args.force
        ? "full"
        : "none";
  let wrote = true;
  if (writeMode !== "none") {
    const display =
      writeMode === "full"
        ? skipTranslate || (!firstDraftWrite && !args.force)
          ? originalDisplay
          : await translateOneautoWorksOnIngest(originalDisplay)
        : { ...originalDisplay, serviceTimeline: [] };
    wrote = await writeAutoRecords(sessionId, (blocks) => {
      const prevIngest = blocks.auto_records.oneautoIngest ?? emptyOneautoIngest();
      const prevSameVin = normalizeVin(prevIngest.lastFetchedVin ?? "") === vin;
      const results = mergeOneautoProductResults(prevSameVin ? prevIngest.results : {}, mergedResults);
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
        selectedProducts: Array.from(
          new Set([
            ...(prevSameVin ? prevIngest.selectedProducts : []),
            ...DEALER_AUTO_PRODUCT_IDS.filter((id) => results[id] != null),
          ]),
        ),
        results,
        serviceTimelineOriginal:
          freshOriginal.length > 0 ? freshOriginal : prevIngest.serviceTimelineOriginal,
      };
      return {
        ...blocks,
        auto_records: applyOneautoToAutoRecords(blocks.auto_records, {
          display,
          ingest,
          vehicleOverride:
            firstDraftWrite &&
            (dealerDecodeResultGaveData(mergedResults.oe_vin_lookup) ||
              dealerDecodeResultGaveData(mergedResults.vin_decoder)),
        }),
      };
    });
  }

  if (!wrote) {
    await save({
      status: "failed",
      error: "draft_write_failed",
      runId: "",
      nextRetryAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
    });
    return { ok: false, status: "failed", reason: "draft_write_failed" };
  }
  if (firstDraftWrite) await save({ status: "running", draftWrittenAt: new Date().toISOString() });

  const wroteNotes = args.skipAi
    ? new Set<DealerNoteField>()
    : await generateDealerNotes(sessionId, vin, commentLang);
  const arAfter = args.skipAi
    ? null
    : await readOrderDraft(sessionId).then((d) =>
        d?.workspace ? mergeSourceBlocksWithDefaults(d.workspace.sourceBlocks).auto_records : null,
      );
  const hasNote = (field: DealerNoteField) =>
    wroteNotes.has(field) || !richIsEmpty(arAfter?.[field] ?? "");
  // Abiem komentāriem jābūt (eļļas intervāli + „Komentāri”); trūkstošo ģenerē nākamais mēģinājums.
  const aiGenerated = hasNote("oilChangeIntervalNotes") && hasNote("comments");
  if (!args.skipAi && !aiGenerated) {
    await save({
      status: "failed",
      error: "ai_generation_failed",
      runId: "",
      nextRetryAt: new Date(Date.now() + DEALER_FAILED_RETRY_MS).toISOString(),
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
      serviceEventCount,
      aiGenerated: false,
    });
    return { ok: false, status: "failed", reason: "ai_generation_failed", serviceEventCount };
  }

  if (decodeError) {
    // Vēsture un komentāri ir melnrakstā; atkārtojas tikai VIN dekodēšana.
    await save({
      status: "failed",
      // Laika budžets nav kļūda - mēģinājumu neskaitām.
      ...(decodeDeferred ? { attempts: Math.max(0, attempts - 1) } : {}),
      error: `vin_decode:${decodeError}`.slice(0, 200),
      runId: "",
      nextRetryAt: new Date(Date.now() + (decodeDeferred ? 60_000 : DEALER_FAILED_RETRY_MS)).toISOString(),
      paidOutcomes,
      oneautoResults: resultsRecord(mergedResults),
      serviceEventCount,
      aiGenerated,
    });
    return { ok: false, status: "failed", reason: "vin_decode_failed", serviceEventCount };
  }

  await save({
    status: "done",
    serviceEventCount,
    aiGenerated,
    finishedAt: new Date().toISOString(),
    paidOutcomes,
    oneautoResults: resultsRecord(mergedResults),
  });

  return { ok: true, status: "done", reason: "done", serviceEventCount };
}
