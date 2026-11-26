import "server-only";

/**
 * «Ātrie vērtējumi» automātika pēc pieteikuma (Nils 26.11). Tīrā loģika: `lib/quick-eval-auto-core.ts`.
 *
 * Secība: numurzīme -> VIN (CSDD ar atkārtojumiem, kā #1248) -> bezmaksas avoti + VIN SCAN (kešs 24 h)
 * -> izsoles blokā + TheCarApi (pakete apmaksāta) -> AutoDNA / CARFAX priekšskatījumi (VIN SCAN rindas)
 * -> e.csdd / LTAB tikai, ja servera Smart-ID sesija jau aktīva (citādi «Smart-ID gaida», Nilu nespiež)
 * -> pretrunu un sarkano karogu analīze -> «Ieteicams piedāvāt».
 *
 * Idempotents: viena palaišana pieteikumam + VIN/numuram (Blob dedupe atslēga, kā #1225 order-auto-intake).
 * Maksas avotus NEPALAIŽ, klientam neko nesūta.
 */
import { checkSourceConsistency } from "@/lib/source-consistency";
import { computeProvinAlertBannersFromWorkspace } from "@/lib/provin-alert-banners";
import { mergeSourceBlocksWithDefaults, type CsddFormFields, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { buildAtraPreviews } from "@/lib/atra-prieksskatijums";
import { isCsddTransientFailure, type CsddTechDataResult } from "@/lib/csdd-tech-data";
import { fetchCsddTechDataCounted } from "@/lib/csdd-tech-data-counted";
import { fetchEcsddRelaySession, readEcsddRelayConfig, startEcsddLookup } from "@/lib/ecsdd-auto";
import { readEcsddAutoStatus } from "@/lib/ecsdd-auto-store";
import { isEcsddAutoActive } from "@/lib/ecsdd-auto-types";
import { getListingPeekById, listListingPeeks, type ListingPeekEntry } from "@/lib/listing-peek-store";
import { readLtabRelayConfig, startLtabLookup } from "@/lib/ltab-auto";
import { readLtabAutoStatus } from "@/lib/ltab-auto-store";
import { isLtabAutoActive } from "@/lib/ltab-auto-types";
import { applyVinScanImportsToBlocks } from "@/lib/order-auto-intake-core";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { PLATE_VIN_RETRY_DELAYS_MS, usableResolvedVin } from "@/lib/order-plate-vin-resolve";
import { classifyOrderVinOrPlateInput } from "@/lib/order-vin-plate-resolution";
import {
  buildQuickEvalRecommendations,
  buildQuickEvalRedFlags,
  quickEvalAutoInFlight,
  quickEvalAutoLockKey,
  quickEvalAutoRetryBucket,
  quickEvalRelayRef,
  quickEvalScanCacheUsable,
  QUICK_EVAL_SMARTID_MAX_AGE_MS,
  type QuickEvalAutoStatus,
  type QuickEvalAutoStep,
} from "@/lib/quick-eval-auto-core";
import { seedQuickEval } from "@/lib/quick-eval-service";
import { readQuickEval, updateQuickEval, type QuickEvalDoc } from "@/lib/quick-eval-store";
import { completeStripeEvent, releaseStripeEvent, tryBeginStripeEvent } from "@/lib/stripe-webhook-dedupe-store";
import { fetchThecarapiCcVinMerge } from "@/lib/thecarapi-cc-vin";
import { defaultVinScanSourceIds } from "@/lib/vin-scan/catalog";
import { readVinScanSnapshot } from "@/lib/vin-scan/store";
import { thecarapiAdminFlag, thecarapiConfigured } from "@/lib/vin-scan/thecarapi-flags";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

const LOG = "[quick-eval-auto]";
/** Vercel `maxDuration = 300` (listing-peek / quick-evals maršruti) mīnus rezerve saglabāšanai. */
export const QUICK_EVAL_AUTO_BUDGET_MS = 270_000;
const THECARAPI_MIN_LEFT_MS = 40_000;

export type QuickEvalAutoDeps = {
  fetchCsdd: (nr1: string) => Promise<CsddTechDataResult>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  retryDelaysMs: readonly number[];
};

const defaultDeps: QuickEvalAutoDeps = {
  fetchCsdd: (nr1) => fetchCsddTechDataCounted(nr1, "admin"),
  sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
  now: Date.now,
  retryDelaysMs: PLATE_VIN_RETRY_DELAYS_MS,
};

export type QuickEvalAutoRunResult = {
  ok: boolean;
  reason?: string;
  vin?: string;
  cacheHit?: boolean;
  flags?: number;
  recommendations?: number;
};

/** Numurzīme -> VIN: pārejošai CSDD kļūdai (VPN pārslēgšanās, 502) atkārtojumi tajā pašā izsaukumā. */
export async function resolveQuickEvalPlateVin(
  plate: string,
  deps: Pick<QuickEvalAutoDeps, "fetchCsdd" | "sleep" | "retryDelaysMs">,
): Promise<{ vin: string; attempts: number; failKind?: "unreachable" | "not_found"; message?: string }> {
  let csdd: CsddTechDataResult = { found: false, message: "CSDD netika vaicāts" };
  let attempts = 0;
  const delays = deps.retryDelaysMs.length ? deps.retryDelaysMs : [0];
  for (let i = 0; i < delays.length; i++) {
    if (i > 0 && (delays[i] ?? 0) > 0) await deps.sleep(delays[i]!);
    try {
      csdd = await deps.fetchCsdd(plate);
    } catch {
      csdd = { found: false, message: "Neizdevās sasniegt CSDD releju" };
    }
    attempts += 1;
    if (csdd.found || !isCsddTransientFailure(csdd)) break;
  }
  const vin = csdd.found ? usableResolvedVin(csdd.data.vin) : "";
  if (vin) return { vin, attempts };
  return {
    vin: "",
    attempts,
    failKind: !csdd.found && isCsddTransientFailure(csdd) ? "unreachable" : "not_found",
    message: csdd.found ? "CSDD atbildē nav derīga VIN" : csdd.message,
  };
}

function auctionCount(indicators: readonly VinScanIndicator[], blocks: WorkspaceSourceBlocks, sales: number): number {
  const fromScan = indicators.filter((r) => r.status === "found").reduce((n, r) => n + (r.auctions?.length ?? 0), 0);
  return Math.max(sales, fromScan, blocks.cc_vin.thecarapiRecords?.length ?? 0);
}

// ── Smart-ID soļi (e.csdd / LTAB) ─────────────────────────────────────

async function ltabSessionActive(): Promise<boolean> {
  const config = readLtabRelayConfig();
  if (!config) return false;
  try {
    // LTAB relejam sesijas stāvokļa vēl nav (tikai e.csdd ir `/session`); 404 = nezināms = gaidām.
    const res = await fetch(`${config.baseUrl}/session`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const j = (await res.json().catch(() => ({}))) as { session?: { state?: string } };
    return j.session?.state === "active";
  } catch {
    return false;
  }
}

type SmartIdOutcome = { step: QuickEvalAutoStep; rawText?: string; ltabMark?: "clean" | "claims" };

async function ecsddStep(ref: string, vin: string, csdd: CsddFormFields, startIfActive: boolean): Promise<SmartIdOutcome> {
  const config = readEcsddRelayConfig();
  if (!config) return { step: { state: "skipped", note: "e.csdd relejs nav pieslēgts" } };
  const prev = await readEcsddAutoStatus(ref).catch(() => null);
  if (prev?.state === "found") return { step: { state: "ok", note: "Dati ielasīti" }, rawText: prev.rawText };
  if (prev?.state === "not_found") return { step: { state: "none", note: "Ieraksta nav" } };
  if (prev && isEcsddAutoActive(prev)) {
    return prev.state === "awaiting_login" || prev.state === "awaiting_smartid"
      ? { step: { state: "smartid_wait", note: "Smart-ID gaida" } }
      : { step: { state: "running", note: prev.message || "Rindā" } };
  }
  if (!config.autoEnabled) return { step: { state: "skipped", note: "Automātika izslēgta" } };
  if (!startIfActive) return { step: { state: "smartid_wait", note: "Smart-ID gaida" } };
  const session = await fetchEcsddRelaySession();
  if (session?.state !== "active") return { step: { state: "smartid_wait", note: "Smart-ID gaida" } };
  const retry = prev?.state === "error";
  const r = await startEcsddLookup(ref, { trigger: retry ? "manual" : "auto", orderVin: vin, csdd, force: retry });
  if (r.started) return { step: { state: "running", note: "Rindā" } };
  return { step: { state: r.status?.state === "error" ? "error" : "skipped", note: r.status?.message || "Nav ko meklēt" } };
}

async function ltabStep(ref: string, vin: string, csdd: CsddFormFields, startIfActive: boolean): Promise<SmartIdOutcome> {
  const config = readLtabRelayConfig();
  if (!config) return { step: { state: "skipped", note: "LTAB relejs nav pieslēgts" } };
  const prev = await readLtabAutoStatus(ref).catch(() => null);
  if (prev?.state === "claims") return { step: { state: "ok", note: prev.message || "Ir negadījumi" }, ltabMark: "claims" };
  if (prev?.state === "no_claims") return { step: { state: "ok", note: "Negadījumi nav reģistrēti" }, ltabMark: "clean" };
  if (prev && isLtabAutoActive(prev)) {
    return prev.state === "awaiting_smartid"
      ? { step: { state: "smartid_wait", note: "Smart-ID gaida" } }
      : { step: { state: "running", note: prev.message || "Rindā" } };
  }
  if (!config.autoEnabled) return { step: { state: "skipped", note: "Automātika izslēgta" } };
  if (!String(csdd.registrationNumber ?? "").trim()) return { step: { state: "skipped", note: "Nav LV numura" } };
  if (!startIfActive || !(await ltabSessionActive())) return { step: { state: "smartid_wait", note: "Smart-ID gaida" } };
  const retry = prev?.state === "error";
  const r = await startLtabLookup(ref, { trigger: retry ? "manual" : "auto", orderVin: vin, csdd, force: retry });
  if (r.started) return { step: { state: "running", note: "Rindā" } };
  return { step: { state: r.status.state === "error" ? "error" : "skipped", note: r.status.message || "Nav ko meklēt" } };
}

// ── Analīze ────────────────────────────────────────────────────────────

function analyze(
  doc: QuickEvalDoc,
  peek: ListingPeekEntry,
  blocks: WorkspaceSourceBlocks,
  indicators: readonly VinScanIndicator[],
  ecsddState: QuickEvalAutoStep["state"] | undefined,
  sales: number,
  nowMs: number,
) {
  const vin = doc.vin;
  const issues = checkSourceConsistency({ vin, sourceBlocks: blocks, listingUrl: peek.listingUrl, nowMs });
  const banners = computeProvinAlertBannersFromWorkspace(blocks, new Date(nowMs));
  const flags = buildQuickEvalRedFlags({ issues, banners, indicators });
  const recommendations = buildQuickEvalRecommendations({
    vin,
    indicators,
    issues,
    banners,
    blocks,
    ecsddState,
    auctionSales: auctionCount(indicators, blocks, sales),
    nowMs,
  });
  return { flags, recommendations };
}

/** e.csdd teksts -> CSDD bloka RAW (tikai tukšam), LTAB rezultāts -> LTAB atzīme (tikai, ja nav). */
function applySmartIdResults(doc: QuickEvalDoc, blocks: WorkspaceSourceBlocks, e: SmartIdOutcome, l: SmartIdOutcome, nowIso: string) {
  let next = blocks;
  if (e.rawText && !String(blocks.csdd.rawUnprocessedData ?? "").trim()) {
    next = { ...next, csdd: { ...next.csdd, rawUnprocessedData: e.rawText } };
  }
  const ltab = !doc.ltab && l.ltabMark ? { at: nowIso, mark: l.ltabMark } : doc.ltab;
  return { blocks: next, ltab };
}

// ── Pilnā palaišana ───────────────────────────────────────────────────

export async function runQuickEvalAuto(
  peekId: string,
  opts: { retry?: boolean; deps?: Partial<QuickEvalAutoDeps> } = {},
): Promise<QuickEvalAutoRunResult> {
  const deps = { ...defaultDeps, ...opts.deps };
  const peek = await getListingPeekById(peekId);
  if (!peek) return { ok: false, reason: "not_found" };
  const before = await readQuickEval(peek.id).catch(() => null);
  const startMs = deps.now();
  if (quickEvalAutoInFlight(before?.auto, startMs)) return { ok: true, reason: "in_progress" };

  const intake = classifyOrderVinOrPlateInput(peek.vin ?? "");
  const knownVin = intake.kind === "vin" ? intake.vin : isValidVin(normalizeVin(before?.vin ?? "")) ? normalizeVin(before!.vin) : "";
  const key = knownVin || (intake.kind === "plate" ? intake.plate : "") || "NAV";
  const lockKey = quickEvalAutoLockKey(peek.id, key, opts.retry ? quickEvalAutoRetryBucket(startMs) : undefined);
  if (!(await tryBeginStripeEvent(lockKey))) return { ok: true, reason: "already_ran" };

  const startedAt = new Date(startMs).toISOString();
  const running: QuickEvalAutoStatus = { state: "running", key, startedAt, steps: {}, flags: [], recommendations: [] };
  try {
    await updateQuickEval(peek.id, (d) => ({ ...d, auto: running }));
    const result = await runLocked(peek, intake, knownVin, running, deps);
    await completeStripeEvent(lockKey);
    return result;
  } catch (err) {
    await releaseStripeEvent(lockKey).catch(() => undefined);
    const msg = err instanceof Error ? err.message.slice(0, 200) : "Nezināma kļūda";
    console.error(LOG, "failed", { peekId: peek.id.slice(0, 8), msg });
    await updateQuickEval(peek.id, (d) => ({
      ...d,
      auto: { ...(d.auto ?? running), state: "error", error: msg, finishedAt: new Date(deps.now()).toISOString() },
    })).catch(() => null);
    return { ok: false, reason: "error" };
  }
}

async function runLocked(
  peek: ListingPeekEntry,
  intake: ReturnType<typeof classifyOrderVinOrPlateInput>,
  knownVin: string,
  status: QuickEvalAutoStatus,
  deps: QuickEvalAutoDeps,
): Promise<QuickEvalAutoRunResult> {
  const startMs = deps.now();
  const deadlineAt = startMs + QUICK_EVAL_AUTO_BUDGET_MS;
  const steps: QuickEvalAutoStatus["steps"] = {};
  let fatal = "";

  // 1) Numurzīme -> VIN (CSDD ar atkārtojumiem).
  let vin = knownVin;
  if (!vin && intake.kind === "plate") {
    const r = await resolveQuickEvalPlateVin(intake.plate, deps);
    if (r.vin) {
      vin = r.vin;
      steps.plate_vin = { state: "ok", note: `${intake.plate} -> VIN` };
    } else {
      steps.plate_vin = { state: "error", note: r.message?.slice(0, 160) || "VIN nav atrasts" };
      if (r.failKind === "unreachable") fatal = "CSDD nav sasniedzams - VIN pēc numura nav atrasts";
    }
  } else if (!vin) {
    steps.plate_vin = { state: "skipped", note: "Nav VIN vai numura" };
  }

  // 2) Kešs: tas pats VIN pēdējās 24 h jau skenēts ar visiem avotiem -> VIN SCAN nepalaiž.
  const snapshot = vin ? await readVinScanSnapshot(vin).catch(() => null) : null;
  const cacheHit = quickEvalScanCacheUsable(snapshot, defaultVinScanSourceIds(), deps.now());

  // 3) Bezmaksas avoti (CSDD, sludinājums - nekad mobile.de, DK/EE/SE) + VIN SCAN (ja nav keša).
  const seeded = await seedQuickEval(peek.id, { vin, skipVinScan: cacheHit });
  const parts = seeded?.seed?.parts ?? {};
  const filled = Object.values(parts).filter((p) => p === "filled" || p === "paste").length;
  steps.free_sources = filled > 0 ? { state: "ok", note: `${filled} bloki aizpildīti` } : { state: "none", note: "Jaunu datu nav" };
  vin = seeded?.vin || vin;

  const doc0 = (await readQuickEval(peek.id)) ?? seeded;
  if (!doc0) throw new Error("quick_eval_doc_missing");
  let indicators: VinScanIndicator[] = [];
  if (cacheHit && snapshot) {
    indicators = snapshot.indicators;
    steps.vin_scan = { state: "ok", note: "No keša (< 24 h)" };
  } else if (doc0.vinScan?.indicators.length) {
    indicators = doc0.vinScan.indicators;
    steps.vin_scan = { state: "ok", note: `${indicators.filter((r) => r.status === "found").length} ar datiem` };
  } else {
    steps.vin_scan = vin ? { state: "error", note: "VIN SCAN neatbildēja" } : { state: "skipped", note: "Nav VIN" };
  }

  // 4) Izsoles blokā (tas pats, ko pasūtījumā dara «Importēt») + TheCarApi pilnie ieraksti.
  let blocks = mergeSourceBlocksWithDefaults(doc0.sourceBlocks);
  const imported = applyVinScanImportsToBlocks(blocks, indicators);
  blocks = imported.blocks;
  let tcAuctions = 0;
  const tcStatus = indicators.find((r) => r.id === "thecarapi_eu")?.status;
  if (vin && thecarapiConfigured() && thecarapiAdminFlag() && tcStatus !== "none" && deadlineAt - deps.now() > THECARAPI_MIN_LEFT_MS) {
    const res = await fetchThecarapiCcVinMerge({ vin, prev: blocks.cc_vin, deadline: deadlineAt - 20_000 }).catch((err) => {
      console.warn(LOG, "thecarapi failed", err instanceof Error ? err.message : "unknown");
      return null;
    });
    if (res && !res.error && (res.parse.status === "found" || res.records.length > 0)) {
      blocks = { ...blocks, cc_vin: res.block };
      tcAuctions = (res.parse.auctions ?? []).length;
    }
  }
  const sales = auctionCount(indicators, blocks, imported.sales + tcAuctions);
  steps.auctions = sales > 0 ? { state: "ok", note: `${sales} ieraksti` } : { state: "none", note: "Izsoļu ierakstu nav" };

  // 5) Priekšskatījumi (VIN SCAN rindas, nekas netiek pirkts).
  const previews = vin
    ? buildAtraPreviews(
        vin,
        indicators
          .filter((r) => r.id === "autodna_precheck" || r.id === "carfax_eu")
          .map((r) => ({ id: r.id, status: r.status, summary: r.summary, detail: r.detail, openUrl: r.openUrl ?? "" })),
      )
    : [];
  steps.previews = previews.length
    ? { state: previews.some((p) => p.tone === "ok") ? "ok" : "none", note: previews.map((p) => `${p.label}: ${p.headline}`).join("; ") }
    : { state: "skipped", note: "Nav VIN" };

  // 6) e.csdd / LTAB tikai ar jau aktīvu Smart-ID sesiju.
  const ref = quickEvalRelayRef(peek.id);
  const [e, l] = vin
    ? await Promise.all([
        ecsddStep(ref, vin, blocks.csdd, true).catch(() => ({ step: { state: "error", note: "e.csdd kļūda" } }) as SmartIdOutcome),
        ltabStep(ref, vin, blocks.csdd, true).catch(() => ({ step: { state: "error", note: "LTAB kļūda" } }) as SmartIdOutcome),
      ])
    : [
        { step: { state: "skipped", note: "Nav VIN" } } as SmartIdOutcome,
        { step: { state: "skipped", note: "Nav VIN" } } as SmartIdOutcome,
      ];
  steps.ecsdd = e.step;
  steps.ltab = l.step;
  const nowIso = new Date(deps.now()).toISOString();
  const smart = applySmartIdResults(doc0, blocks, e, l, nowIso);
  blocks = smart.blocks;

  // 7) Pretrunas, sarkanie karogi, «Ieteicams piedāvāt».
  const docForAnalysis: QuickEvalDoc = { ...doc0, vin: vin || doc0.vin };
  const { flags, recommendations } = analyze(docForAnalysis, peek, blocks, indicators, e.step.state, sales, deps.now());
  steps.analysis = { state: "ok", note: `${flags.length} karogi` };

  const finished: QuickEvalAutoStatus = {
    ...status,
    state: fatal ? "error" : "ready",
    ...(vin ? { vin } : {}),
    ...(fatal ? { error: fatal } : {}),
    ...(cacheHit ? { cacheHit: true } : {}),
    finishedAt: new Date(deps.now()).toISOString(),
    steps,
    flags,
    recommendations,
  };
  await updateQuickEval(peek.id, (d) => ({
    ...d,
    vin: vin || d.vin,
    sourceBlocks: blocks,
    ...(smart.ltab ? { ltab: smart.ltab } : {}),
    ...(cacheHit && snapshot ? { vinScan: { at: snapshot.scannedAt, indicators: snapshot.indicators } } : {}),
    auto: finished,
  }));
  return { ok: !fatal, ...(fatal ? { reason: "csdd_unreachable" } : {}), vin, cacheHit, flags: flags.length, recommendations: recommendations.length };
}

// ── Smart-ID pēcapstrāde (e.csdd / LTAB rezultāti vēlāk) ────────────────

/**
 * Pēc tam, kad e.csdd / LTAB atbildēja (atzvans) vai Smart-ID sesija kļuva aktīva: atjauno soļus,
 * ievieto rezultātu blokā un pārrēķina analīzi. `startIfActive=false` (kartītes atvēršana) releju nesauc.
 */
export async function refreshQuickEvalSmartId(peekId: string, opts: { startIfActive: boolean; nowMs?: number }): Promise<boolean> {
  const peek = await getListingPeekById(peekId);
  if (!peek) return false;
  const doc = await readQuickEval(peek.id).catch(() => null);
  const nowMs = opts.nowMs ?? Date.now();
  if (!doc?.auto || doc.auto.state !== "ready" || !isValidVin(doc.vin)) return false;
  const steps = doc.auto.steps;
  const pending = (s: QuickEvalAutoStep | undefined) => s?.state === "running" || s?.state === "smartid_wait";
  if (!pending(steps.ecsdd) && !pending(steps.ltab)) return false;
  const ref = quickEvalRelayRef(peek.id);
  const blocks0 = mergeSourceBlocksWithDefaults(doc.sourceBlocks);
  const keep = (s: QuickEvalAutoStep | undefined): SmartIdOutcome => ({ step: s ?? { state: "skipped" } });
  const [e, l] = await Promise.all([
    pending(steps.ecsdd) ? ecsddStep(ref, doc.vin, blocks0.csdd, opts.startIfActive).catch(() => keep(steps.ecsdd)) : keep(steps.ecsdd),
    pending(steps.ltab) ? ltabStep(ref, doc.vin, blocks0.csdd, opts.startIfActive).catch(() => keep(steps.ltab)) : keep(steps.ltab),
  ]);
  const same = JSON.stringify([e.step, l.step]) === JSON.stringify([steps.ecsdd, steps.ltab]) && !e.rawText && !l.ltabMark;
  if (same) return false;
  const smart = applySmartIdResults(doc, blocks0, e, l, new Date(nowMs).toISOString());
  const indicators = doc.vinScan?.indicators ?? [];
  const { flags, recommendations } = analyze(doc, peek, smart.blocks, indicators, e.step.state, 0, nowMs);
  await updateQuickEval(peek.id, (d) => ({
    ...d,
    sourceBlocks: smart.blocks,
    ...(smart.ltab ? { ltab: smart.ltab } : {}),
    auto: d.auto ? { ...d.auto, steps: { ...d.auto.steps, ecsdd: e.step, ltab: l.step }, flags, recommendations } : d.auto,
  }));
  return true;
}

/**
 * Cron (dealer-data-sweep, ik 5 min): ja Smart-ID sesija ir aktīva, palaiž gaidošos e.csdd / LTAB
 * jaunākajiem atvērtajiem pieteikumiem. Nav aktīvas sesijas - viens releja vaicājums un viss.
 */
export async function sweepQuickEvalSmartId(nowMs = Date.now()): Promise<{ checked: number; updated: number }> {
  const ecsddCfg = readEcsddRelayConfig();
  const ltabCfg = readLtabRelayConfig();
  if (!ecsddCfg?.autoEnabled && !ltabCfg?.autoEnabled) return { checked: 0, updated: 0 };
  const [ecsddActive, ltabActive] = await Promise.all([
    ecsddCfg?.autoEnabled ? fetchEcsddRelaySession().then((s) => s?.state === "active").catch(() => false) : false,
    ltabCfg?.autoEnabled ? ltabSessionActive() : false,
  ]);
  if (!ecsddActive && !ltabActive) return { checked: 0, updated: 0 };
  const peeks = (await listListingPeeks(200).catch(() => []))
    .filter((p) => p.status === "new" || p.status === "in_progress")
    .filter((p) => nowMs - Date.parse(p.createdAt) < QUICK_EVAL_SMARTID_MAX_AGE_MS)
    .slice(0, 20);
  let checked = 0;
  let updated = 0;
  for (const p of peeks) {
    checked += 1;
    if (await refreshQuickEvalSmartId(p.id, { startIfActive: true, nowMs }).catch(() => false)) updated += 1;
  }
  return { checked, updated };
}
