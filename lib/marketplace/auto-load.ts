/**
 * Automātiskā mobile.de / AutoScout24 ielāde IRISS pasūtījumiem.
 * Izsoļu (Auto1 / Openlane / Autobid / eCarsTrade) sync šeit nesauc.
 * Radara (SCAN) ieraksti šeit NAV: radarā Apify ir tikai manuāla poga, bez cron.
 */
import { marketplaceActorId, readApifyToken } from "@/lib/marketplace/apify-client";
import {
  decideMarketplaceBudget,
  MARKETPLACE_AUTO_DISABLED_REASON,
  MARKETPLACE_LOADS_DISABLED_REASON,
  marketplaceAutoEnabled,
  marketplaceAutoIntervalDays,
  marketplaceAutoMaxItemsPerProvider,
  marketplaceAutoMonthlyUsdCap,
  marketplaceLoadsEnabled,
  marketplaceMonthKey,
  marketplaceMonthlyUsdCap,
  marketplacePerRunUsdCap,
  usageSpentUsd,
  usageSpentUsdByTrigger,
} from "@/lib/marketplace/cost-caps";
import { estimateMarketplaceLoad, loadMarketplaceForOrder, type MarketplaceLoadInput } from "@/lib/marketplace/load";
import {
  readMarketplaceAutoCronState,
  readMarketplaceListingsState,
  readMarketplaceUsageMonth,
  writeMarketplaceAutoCronState,
} from "@/lib/marketplace/store";
import type {
  ListingProvider,
  MarketplaceAutoCronState,
  MarketplaceAutoCronStatus,
  MarketplaceAutoSkip,
  MarketplaceCostEstimate,
  MarketplaceLoadResult,
  MarketplaceRunRecord,
  MarketplaceUsageMonth,
} from "@/lib/marketplace/types";
import { emptyMarketplaceAutoCronState } from "@/lib/marketplace/types";
import {
  marketplaceOrderHasFetchBounds,
  marketplaceTooBroadSkipReason,
  type MarketplaceOrderCriteria,
} from "@/lib/marketplace/query-from-order";
import {
  isIrissPasutijumsWorkingStatus,
  type IrissPasutijumsListStatus,
} from "@/lib/iriss-pasutijumi-types";

export const MARKETPLACE_AUTO_CRON_HOUR_UTC = 6;
export const MARKETPLACE_AUTO_TIME_BUDGET_MS = 250_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type MarketplaceAutoOrderBrief = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt?: string;
  listStatus: IrissPasutijumsListStatus;
};

export type MarketplaceAutoReady = {
  ok: boolean;
  reason: string;
};

export type MarketplaceAutoSweepResult = {
  ok: boolean;
  status: MarketplaceAutoCronStatus;
  reason: string;
  loadedCount: number;
  skippedCount: number;
  loadedOrderIds: string[];
  skipped: MarketplaceAutoSkip[];
  estimatedUsd: number;
  chargedUsd: number;
  autoSpentUsd: number;
  autoCapUsd: number;
  monthlySpentUsd: number;
  monthlyCapUsd: number;
};

export type MarketplaceAutoSweepDeps = {
  now: Date;
  listActiveOrders: () => Promise<MarketplaceAutoOrderBrief[]>;
  readOrder: (id: string) => Promise<MarketplaceOrderCriteria | null>;
  readListingsRuns: () => Promise<readonly MarketplaceRunRecord[]>;
  readUsage: () => Promise<MarketplaceUsageMonth>;
  providersReady: () => MarketplaceAutoReady;
  loadForOrder: (input: MarketplaceLoadInput) => Promise<MarketplaceLoadResult>;
  estimateForOrder: (input: {
    order: MarketplaceOrderCriteria;
    maxItems: number;
    providers?: ListingProvider[];
  }) => { estimates: MarketplaceCostEstimate[] };
  writeAutoState?: (state: MarketplaceAutoCronState) => Promise<void>;
  timeBudgetMs?: number;
  providers?: ListingProvider[];
};

export function marketplaceAutoProvidersReady(): MarketplaceAutoReady {
  if (!readApifyToken()) return { ok: false, reason: "Nav APIFY_TOKEN." };
  const mobile = marketplaceActorId("MARKETPLACE_APIFY_MOBILEDE_ACTOR");
  const autoscout = marketplaceActorId("MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR");
  if (!mobile && !autoscout) {
    return { ok: false, reason: "Nav actor ID (MARKETPLACE_APIFY_MOBILEDE_ACTOR / MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR)." };
  }
  return { ok: true, reason: "" };
}

export function isMarketplaceAutoOrderActive(row: MarketplaceAutoOrderBrief): boolean {
  return isIrissPasutijumsWorkingStatus(row.listStatus);
}

/** Jaunākie / aktīvākie vispirms: meklēšana pirms rezervēta, piespraustie, tad updatedAt. */
export function sortMarketplaceAutoOrders(rows: readonly MarketplaceAutoOrderBrief[]): MarketplaceAutoOrderBrief[] {
  const rank = (s: IrissPasutijumsListStatus) => (s === "reserved" ? 1 : 0);
  return [...rows].sort((a, b) => {
    const ar = rank(a.listStatus);
    const br = rank(b.listStatus);
    if (ar !== br) return ar - br;
    const ap = a.pinnedAt?.trim() ? 1 : 0;
    const bp = b.pinnedAt?.trim() ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const au = Date.parse(a.updatedAt) || 0;
    const bu = Date.parse(b.updatedAt) || 0;
    if (au !== bu) return bu - au;
    return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
  });
}

/** Auto grafiku griež tikai veiksmīgas ielādes ar sludinājumiem, vai jebkura auto ielāde. */
export function marketplaceRunCountsForAutoSchedule(run: MarketplaceRunRecord): boolean {
  if (run.status === "blocked") return false;
  if (run.trigger === "auto") return true;
  return (run.status === "ok" || run.status === "partial") && run.itemCount > 0;
}

export function lastMarketplaceLoadAt(
  runs: readonly MarketplaceRunRecord[],
  orderId: string,
): string | null {
  let latest = "";
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const run of runs) {
    if (run.orderId !== orderId) continue;
    if (!marketplaceRunCountsForAutoSchedule(run)) continue;
    const at = run.finishedAt || run.startedAt;
    const ms = Date.parse(at);
    if (!Number.isFinite(ms)) continue;
    if (ms >= latestMs) {
      latestMs = ms;
      latest = at;
    }
  }
  return latest || null;
}

export function lastMarketplaceAutoLoadAt(
  runs: readonly MarketplaceRunRecord[],
  orderId: string,
): string | null {
  let latest = "";
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const run of runs) {
    if (run.orderId !== orderId || run.trigger !== "auto") continue;
    if (run.status === "blocked") continue;
    const at = run.finishedAt || run.startedAt;
    const ms = Date.parse(at);
    if (!Number.isFinite(ms)) continue;
    if (ms >= latestMs) {
      latestMs = ms;
      latest = at;
    }
  }
  return latest || null;
}

export function hasPriorMarketplaceLoad(runs: readonly MarketplaceRunRecord[], orderId: string): boolean {
  return runs.some((run) => run.orderId === orderId && marketplaceRunCountsForAutoSchedule(run));
}

export function orderDueForMarketplaceAuto(
  lastLoadAt: string | null,
  now: Date,
  intervalDays = marketplaceAutoIntervalDays(),
): boolean {
  if (!lastLoadAt) return true;
  const t = Date.parse(lastLoadAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t >= intervalDays * DAY_MS;
}

export function nextDailyCronUtc(now: Date, hourUtc = MARKETPLACE_AUTO_CRON_HOUR_UTC): string {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0);
  if (now.getTime() <= today) return new Date(today).toISOString();
  return new Date(today + DAY_MS).toISOString();
}

export function nextMarketplaceAutoAt(
  lastLoadAt: string | null,
  now: Date,
  intervalDays = marketplaceAutoIntervalDays(),
): string {
  if (orderDueForMarketplaceAuto(lastLoadAt, now, intervalDays)) {
    return nextDailyCronUtc(now);
  }
  const t = Date.parse(lastLoadAt ?? "");
  return new Date(t + intervalDays * DAY_MS).toISOString();
}

export function marketplaceAutoItemsForRun(hasPriorLoad: boolean): { maxItems: number; sortNewest: boolean } {
  const cap = marketplaceAutoMaxItemsPerProvider();
  if (!hasPriorLoad) return { maxItems: cap, sortNewest: false };
  return { maxItems: cap, sortNewest: true };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function wouldExceedMarketplaceAutoBudget(input: {
  estimates: readonly MarketplaceCostEstimate[];
  usage: MarketplaceUsageMonth | null;
}): { allowed: boolean; reason: string; estimatedUsd: number; remainingAutoUsd: number } {
  const overall = decideMarketplaceBudget({
    estimates: input.estimates,
    usage: input.usage,
    perRunCapUsd: marketplacePerRunUsdCap(),
    monthlyCapUsd: marketplaceMonthlyUsdCap(),
  });
  const estimatedUsd = overall.estimatedUsd;
  if (!overall.allowed) {
    const monthly = /Mēneša griests|budžets sasniegts/.test(overall.reason);
    return {
      allowed: false,
      reason: monthly ? "budžets sasniegts" : overall.reason || "budžets sasniegts",
      estimatedUsd,
      remainingAutoUsd: overall.remainingMonthlyUsd,
    };
  }
  const autoCap = marketplaceAutoMonthlyUsdCap();
  const autoUsed = usageSpentUsdByTrigger(input.usage, "auto");
  const remainingAutoUsd = round3(autoCap - autoUsed);
  if (estimatedUsd > remainingAutoUsd + 1e-9) {
    return { allowed: false, reason: "budžets sasniegts", estimatedUsd, remainingAutoUsd };
  }
  return { allowed: true, reason: "", estimatedUsd, remainingAutoUsd };
}

function finishState(
  startedAt: string,
  nowIso: string,
  status: MarketplaceAutoCronStatus,
  reason: string,
  loadedOrderIds: string[],
  skipped: MarketplaceAutoSkip[],
  estimatedUsd: number,
  chargedUsd: number,
): MarketplaceAutoCronState {
  return {
    version: 1,
    updatedAt: nowIso,
    lastStartedAt: startedAt,
    lastFinishedAt: nowIso,
    status,
    reason,
    loadedOrderIds,
    skipped,
    loadedCount: loadedOrderIds.length,
    skippedCount: skipped.length,
    estimatedUsd: round3(estimatedUsd),
    chargedUsd: round3(chargedUsd),
  };
}

export async function runMarketplaceAutoSweep(deps: MarketplaceAutoSweepDeps): Promise<MarketplaceAutoSweepResult> {
  const startedAt = deps.now.toISOString();
  const timeBudgetMs = deps.timeBudgetMs ?? MARKETPLACE_AUTO_TIME_BUDGET_MS;
  const deadline = Date.now() + timeBudgetMs;
  const persist = async (state: MarketplaceAutoCronState) => {
    if (deps.writeAutoState) await deps.writeAutoState(state);
  };

  const ready = deps.providersReady();
  if (!ready.ok) {
    const state = finishState(startedAt, startedAt, "skipped", ready.reason, [], [], 0, 0);
    await persist(state);
    const usage = await deps.readUsage().catch(() => null);
    return {
      ok: true,
      status: "skipped",
      reason: ready.reason,
      loadedCount: 0,
      skippedCount: 0,
      loadedOrderIds: [],
      skipped: [],
      estimatedUsd: 0,
      chargedUsd: 0,
      autoSpentUsd: usageSpentUsdByTrigger(usage, "auto"),
      autoCapUsd: marketplaceAutoMonthlyUsdCap(),
      monthlySpentUsd: usageSpentUsd(usage),
      monthlyCapUsd: marketplaceMonthlyUsdCap(),
    };
  }

  const [rows, runs] = await Promise.all([deps.listActiveOrders(), deps.readListingsRuns()]);
  const due = sortMarketplaceAutoOrders(rows.filter(isMarketplaceAutoOrderActive)).filter((row) =>
    orderDueForMarketplaceAuto(lastMarketplaceLoadAt(runs, row.id), deps.now),
  );

  const loadedOrderIds: string[] = [];
  const skipped: MarketplaceAutoSkip[] = [];
  let estimatedUsd = 0;
  let chargedUsd = 0;
  let status: MarketplaceAutoCronStatus = "ok";
  let reason = "";

  for (const row of due) {
    if (Date.now() >= deadline) {
      skipped.push({ orderId: row.id, reason: "cron_time_budget" });
      continue;
    }
    const usage = await deps.readUsage();
    const order = await deps.readOrder(row.id);
    if (!order || !marketplaceOrderHasFetchBounds(order)) {
      skipped.push({ orderId: row.id, reason: marketplaceTooBroadSkipReason(order) });
      continue;
    }
    const prior = hasPriorMarketplaceLoad(runs, row.id);
    const items = marketplaceAutoItemsForRun(prior);
    const est = deps.estimateForOrder({
      order,
      maxItems: items.maxItems,
      ...(deps.providers ? { providers: deps.providers } : {}),
    });
    const estimates = est.estimates.filter((e) => e.configured);
    if (estimates.length === 0) {
      skipped.push({ orderId: row.id, reason: est.estimates[0]?.reason || "Nav APIFY_TOKEN." });
      continue;
    }
    const budget = wouldExceedMarketplaceAutoBudget({ estimates, usage });
    if (!budget.allowed) {
      skipped.push({ orderId: row.id, reason: budget.reason });
      if (budget.reason === "budžets sasniegts") {
        status = "budžets sasniegts";
        reason = "budžets sasniegts";
        for (const rest of due.slice(due.indexOf(row) + 1)) {
          skipped.push({ orderId: rest.id, reason: "budžets sasniegts" });
        }
        break;
      }
      continue;
    }
    const loaded = await deps.loadForOrder({
      orderId: row.id,
      order,
      trigger: "auto",
      maxItems: items.maxItems,
      sortNewest: items.sortNewest,
      now: new Date().toISOString(),
      ...(deps.providers ? { providers: deps.providers } : {}),
    });
    estimatedUsd = round3(estimatedUsd + (loaded.estimatedUsd || budget.estimatedUsd));
    if (loaded.ok) {
      chargedUsd = round3(chargedUsd + (loaded.run?.chargedUsd ?? loaded.estimatedUsd));
      loadedOrderIds.push(row.id);
    } else if (loaded.error === "budžets sasniegts") {
      status = "budžets sasniegts";
      reason = "budžets sasniegts";
      skipped.push({ orderId: row.id, reason: "budžets sasniegts" });
      for (const rest of due.slice(due.indexOf(row) + 1)) {
        skipped.push({ orderId: rest.id, reason: "budžets sasniegts" });
      }
      break;
    } else {
      skipped.push({ orderId: row.id, reason: loaded.error || "failed" });
    }
  }

  if (!reason && loadedOrderIds.length === 0 && skipped.length === 0) {
    reason = "nav pasūtījumu intervālā";
  }
  const nowIso = new Date().toISOString();
  const state = finishState(startedAt, nowIso, status, reason, loadedOrderIds, skipped, estimatedUsd, chargedUsd);
  await persist(state);
  const usage = await deps.readUsage().catch(() => null);
  return {
    ok: true,
    status,
    reason,
    loadedCount: loadedOrderIds.length,
    skippedCount: skipped.length,
    loadedOrderIds,
    skipped,
    estimatedUsd: round3(estimatedUsd),
    chargedUsd: round3(chargedUsd),
    autoSpentUsd: usageSpentUsdByTrigger(usage, "auto"),
    autoCapUsd: marketplaceAutoMonthlyUsdCap(),
    monthlySpentUsd: usageSpentUsd(usage),
    monthlyCapUsd: marketplaceMonthlyUsdCap(),
  };
}

export async function runMarketplaceAutoLoadNow(now = new Date()): Promise<MarketplaceAutoSweepResult> {
  const skipReason = !marketplaceAutoEnabled()
    ? MARKETPLACE_AUTO_DISABLED_REASON
    : !marketplaceLoadsEnabled()
      ? MARKETPLACE_LOADS_DISABLED_REASON
      : "";
  if (skipReason) {
    const startedAt = now.toISOString();
    const state = finishState(startedAt, startedAt, "skipped", skipReason, [], [], 0, 0);
    await writeMarketplaceAutoCronState(state);
    const usage = await readMarketplaceUsageMonth().catch(() => null);
    return {
      ok: true,
      status: "skipped",
      reason: skipReason,
      loadedCount: 0,
      skippedCount: 0,
      loadedOrderIds: [],
      skipped: [],
      estimatedUsd: 0,
      chargedUsd: 0,
      autoSpentUsd: usageSpentUsdByTrigger(usage, "auto"),
      autoCapUsd: marketplaceAutoMonthlyUsdCap(),
      monthlySpentUsd: usageSpentUsd(usage),
      monthlyCapUsd: marketplaceMonthlyUsdCap(),
    };
  }
  const { listIrissPasutijumi, readIrissPasutijums } = await import("@/lib/iriss-pasutijumi-store");
  return runMarketplaceAutoSweep({
    now,
    async listActiveOrders() {
      const rows = await listIrissPasutijumi();
      return rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        pinnedAt: row.pinnedAt,
        listStatus: row.listStatus,
      }));
    },
    async readOrder(id) {
      return readIrissPasutijums(id);
    },
    async readListingsRuns() {
      const state = await readMarketplaceListingsState();
      return state.runs;
    },
    readUsage: () => readMarketplaceUsageMonth(),
    providersReady: marketplaceAutoProvidersReady,
    loadForOrder: loadMarketplaceForOrder,
    estimateForOrder: (input) => estimateMarketplaceLoad(input),
    writeAutoState: async (state) => {
      await writeMarketplaceAutoCronState(state);
    },
  });
}

export type MarketplaceUsageSummary = {
  ok: true;
  month: string;
  spentUsd: number;
  autoSpentUsd: number;
  monthlyCapUsd: number;
  autoMonthlyCapUsd: number;
  remainingMonthlyUsd: number;
  remainingAutoUsd: number;
  lastChargedUsd: number;
  lastMonthUsd: number;
  runCount: number;
  autoRunCount: number;
  lastAutoAt: string;
  lastAutoStatus: MarketplaceAutoCronStatus | "";
  intervalDays: number;
  autoMaxItemsPerProvider: number;
  loadsEnabled: boolean;
  autoEnabled: boolean;
};

export async function buildMarketplaceUsageSummary(now = new Date()): Promise<MarketplaceUsageSummary> {
  const month = marketplaceMonthKey(now);
  const [usage, listings, auto] = await Promise.all([
    readMarketplaceUsageMonth(month),
    readMarketplaceListingsState(),
    readMarketplaceAutoCronState().catch(() => emptyMarketplaceAutoCronState()),
  ]);
  const spentUsd = usageSpentUsd(usage);
  const autoSpentUsd = usageSpentUsdByTrigger(usage, "auto");
  const monthlyCapUsd = marketplaceMonthlyUsdCap();
  const autoMonthlyCapUsd = marketplaceAutoMonthlyUsdCap();
  const autoRuns = listings.runs.filter((r) => r.trigger === "auto");
  let lastAutoAt = auto.lastFinishedAt;
  if (!lastAutoAt) {
    let latestMs = Number.NEGATIVE_INFINITY;
    for (const run of autoRuns) {
      const ms = Date.parse(run.finishedAt || run.startedAt);
      if (Number.isFinite(ms) && ms >= latestMs) {
        latestMs = ms;
        lastAutoAt = run.finishedAt || run.startedAt;
      }
    }
  }
  const runIds = new Set(usage.entries.map((e) => e.runId));
  const autoRunIds = new Set(usage.entries.filter((e) => e.trigger === "auto").map((e) => e.runId));
  const lastRun = listings.runs.length ? listings.runs[listings.runs.length - 1] : null;
  const lastEntry = usage.entries.length ? usage.entries[usage.entries.length - 1] : null;
  return {
    ok: true,
    month,
    spentUsd,
    autoSpentUsd,
    monthlyCapUsd,
    autoMonthlyCapUsd,
    remainingMonthlyUsd: monthlyCapUsd - spentUsd,
    remainingAutoUsd: autoMonthlyCapUsd - autoSpentUsd,
    lastChargedUsd: lastRun?.chargedUsd ?? 0,
    lastMonthUsd: lastRun?.monthUsd ?? lastEntry?.monthUsd ?? spentUsd,
    runCount: runIds.size,
    autoRunCount: autoRunIds.size,
    lastAutoAt,
    lastAutoStatus: auto.status || "",
    intervalDays: marketplaceAutoIntervalDays(),
    autoMaxItemsPerProvider: marketplaceAutoMaxItemsPerProvider(),
    loadsEnabled: marketplaceLoadsEnabled(),
    autoEnabled: marketplaceAutoEnabled(),
  };
}
