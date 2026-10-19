/** Apify klients. Bez APIFY_TOKEN un bez MARKETPLACE_LOADS_ENABLED=true nedrīkst veikt tīkla izsaukumu. */

import {
  MARKETPLACE_APIFY_START_USD,
  marketplaceLoadsEnabled,
  marketplacePerRunUsdCap,
} from "@/lib/marketplace/cost-caps";
import type { MarketplaceLimits } from "@/lib/marketplace/types";

export const MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT = "blackfalcondata~mobile-de-scraper";
export const MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR_DEFAULT = "blackfalcondata~autoscout24-scraper";
export { MARKETPLACE_APIFY_START_USD };
export const MARKETPLACE_DEFAULT_APIFY_WAIT_SECONDS = 90;
export const APIFY_API_BASE = "https://api.apify.com/v2";

const FORBIDDEN_INPUT_KEY = /webhook|telegram|slack|discord|notify|notification/i;
const TERMINAL_RUN = /^(SUCCEEDED|FAILED|ABORTED|TIMED-OUT)$/;

export function readApifyToken(): string | null {
  const token = process.env.APIFY_TOKEN?.trim() ?? "";
  return token || null;
}

export function marketplaceUseFixtures(): boolean {
  return /^(1|true|yes)$/i.test(process.env.MARKETPLACE_USE_FIXTURES ?? "");
}

export function marketplaceActorId(envName: string): string {
  const fromEnv = process.env[envName]?.trim() ?? "";
  if (fromEnv) return fromEnv;
  if (envName === "MARKETPLACE_APIFY_MOBILEDE_ACTOR") return MARKETPLACE_APIFY_MOBILEDE_ACTOR_DEFAULT;
  if (envName === "MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR") return MARKETPLACE_APIFY_AUTOSCOUT24_ACTOR_DEFAULT;
  return "";
}

export function marketplaceApifyWaitSeconds(): number {
  const raw = process.env.MARKETPLACE_APIFY_WAIT_SECONDS?.trim() ?? "";
  const n = raw ? Number.parseFloat(raw) : MARKETPLACE_DEFAULT_APIFY_WAIT_SECONDS;
  if (!Number.isFinite(n)) return MARKETPLACE_DEFAULT_APIFY_WAIT_SECONDS;
  return Math.min(240, Math.max(10, Math.round(n)));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function sanitizeActorInput(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_INPUT_KEY.test(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Actor input paliek kā ir. maxItems / maxTotalChargeUsd ir run query, ne body. */
export function marketplaceApifySearchPayload(
  queryPayload: Record<string, unknown>,
  limits: MarketplaceLimits,
): Record<string, unknown> {
  void limits;
  return sanitizeActorInput(queryPayload);
}

export function marketplaceApifyRunUrl(
  actorId: string,
  maxItems: number,
  maxTotalChargeUsd: number,
  waitForFinishSec: number,
): string {
  const url = new URL(`${APIFY_API_BASE}/acts/${encodeURIComponent(actorId.trim())}/runs`);
  url.searchParams.set("maxItems", String(Math.max(1, Math.floor(maxItems))));
  url.searchParams.set("maxTotalChargeUsd", String(round3(Math.max(0.05, maxTotalChargeUsd))));
  url.searchParams.set("waitForFinish", String(Math.max(0, Math.min(60, Math.floor(waitForFinishSec)))));
  return url.toString();
}

export type ApifyRunResult = {
  ok: boolean;
  items: unknown[];
  chargedUsd: number;
  error?: string;
  apifyRunId?: string;
};

export type ApifyActorRunner = (input: {
  actorId: string;
  token: string;
  payload: Record<string, unknown>;
  maxItems: number;
  maxUsd: number;
  usdPerThousand?: number;
  usdPerResult?: number;
}) => Promise<ApifyRunResult>;

export type ApifyHttpHooks = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  nowMs?: () => number;
};

let runnerOverride: ApifyActorRunner | null = null;
let httpHooks: ApifyHttpHooks = {};

export function setMarketplaceApifyRunner(runner: ApifyActorRunner | null): void {
  runnerOverride = runner;
}

export function setMarketplaceApifyHttpHooks(hooks: ApifyHttpHooks | null): void {
  httpHooks = hooks ?? {};
}

function sleepMs(ms: number): Promise<void> {
  if (httpHooks.sleep) return httpHooks.sleep(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs(): number {
  return httpHooks.nowMs ? httpHooks.nowMs() : Date.now();
}

function doFetch(input: string, init: RequestInit): Promise<Response> {
  const impl = httpHooks.fetchImpl ?? globalThis.fetch;
  return impl(input, init);
}

function unwrapData(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const row = json as Record<string, unknown>;
  if (row.data && typeof row.data === "object") return row.data as Record<string, unknown>;
  return row;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function finitePositiveUsd(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function marketplaceUsdPerResult(usdPerResult?: number, usdPerThousand?: number): number {
  if (usdPerResult != null && Number.isFinite(usdPerResult) && usdPerResult >= 0) return usdPerResult;
  if (usdPerThousand != null && Number.isFinite(usdPerThousand) && usdPerThousand >= 0) return usdPerThousand / 1000;
  return 0;
}

function chargedEventStartAndItems(run: Record<string, unknown>): { starts: number; items: number } {
  const counts = run.chargedEventCounts;
  if (!counts || typeof counts !== "object") return { starts: 0, items: 0 };
  let items = 0;
  let starts = 0;
  for (const [key, value] of Object.entries(counts as Record<string, unknown>)) {
    const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
    if (/checked/i.test(key)) continue;
    if (/start/i.test(key)) starts += n;
    else if (/result|item|dataset|listing/i.test(key)) items += n;
  }
  return { starts, items };
}

/** Pay-per-event: start 0.005 $ + result items × per-result price. */
export function apifyChargedEventsUsd(run: Record<string, unknown>, usdPerResult = 0): number | null {
  const named =
    finitePositiveUsd(run.chargedEventUsd) ??
    finitePositiveUsd(run.eventChargeUsd) ??
    finitePositiveUsd(run.usageChargedUsd) ??
    finitePositiveUsd(run.chargedEventTotalUsd);
  if (named != null) return named;
  const { starts, items } = chargedEventStartAndItems(run);
  if (starts === 0 && items === 0) return null;
  return starts * MARKETPLACE_APIFY_START_USD + items * usdPerResult;
}

export function apifyRunChargedUsd(
  run: Record<string, unknown>,
  fallbackUsd: number,
  usdPerResult = 0,
  datasetItemCount = 0,
): number {
  const fromEvents = apifyChargedEventsUsd(run, usdPerResult);
  const usage = finitePositiveUsd(run.usageTotalUsd);
  let statsCost: number | null = null;
  const stats = run.stats;
  if (stats && typeof stats === "object") {
    const row = stats as { costUsd?: unknown; usd?: unknown; chargedEventUsd?: unknown };
    statsCost =
      finitePositiveUsd(row.chargedEventUsd) ?? finitePositiveUsd(row.costUsd) ?? finitePositiveUsd(row.usd);
  }
  const { starts } = chargedEventStartAndItems(run);
  const startCount = starts > 0 ? starts : datasetItemCount > 0 || fallbackUsd > 0 ? 1 : 0;
  const fromDataset = startCount * MARKETPLACE_APIFY_START_USD + Math.max(0, datasetItemCount) * usdPerResult;
  const reported = Math.max(usage ?? 0, statsCost ?? 0, fromEvents ?? 0);
  return Math.max(reported, fromDataset, Math.max(0, fallbackUsd));
}

export function marketplaceApifyErrorLv(error?: string): string {
  const code = (error ?? "").trim();
  if (!code) return "nezināma kļūda";
  if (code === "token_missing") return "nav APIFY_TOKEN";
  if (code === "actor_not_configured") return "nav aktora identifikatora";
  if (code === "loads_disabled") return "ielāde izslēgta (izmaksu kontrole)";
  if (code === "apify_timeout" || code === "apify_timed-out") return "Apify taimauts";
  if (code.startsWith("apify_http_")) return `Apify HTTP ${code.slice("apify_http_".length)}`;
  if (code.startsWith("apify_")) return `Apify ${code.slice(6)}`;
  return code;
}

export function marketplaceSourceErrorNote(label: string, error?: string): string {
  return `Avota kļūda: ${label}: ${marketplaceApifyErrorLv(error)}`;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function pollRun(input: {
  runId: string;
  token: string;
  deadlineMs: number;
}): Promise<Record<string, unknown>> {
  let last: Record<string, unknown> = { id: input.runId, status: "RUNNING" };
  while (nowMs() < input.deadlineMs) {
    const res = await doFetch(`${APIFY_API_BASE}/actor-runs/${encodeURIComponent(input.runId)}`, {
      method: "GET",
      headers: authHeaders(input.token),
    });
    const json = unwrapData(await readJson(res));
    if (json.id || json.status) last = json;
    const status = String(json.status ?? "");
    if (TERMINAL_RUN.test(status)) return last;
    await sleepMs(2000);
  }
  return last;
}

async function readDatasetItems(datasetId: string, token: string, maxItems: number): Promise<unknown[]> {
  if (!datasetId) return [];
  const url = new URL(`${APIFY_API_BASE}/datasets/${encodeURIComponent(datasetId)}/items`);
  url.searchParams.set("limit", String(Math.max(1, Math.floor(maxItems))));
  url.searchParams.set("clean", "true");
  const res = await doFetch(url.toString(), { method: "GET", headers: authHeaders(token) });
  if (!res.ok) return [];
  const json = await readJson(res);
  return Array.isArray(json) ? json : [];
}

export async function defaultMarketplaceApifyRunner(input: {
  actorId: string;
  token: string;
  payload: Record<string, unknown>;
  maxItems: number;
  maxUsd: number;
  usdPerThousand?: number;
  usdPerResult?: number;
}): Promise<ApifyRunResult> {
  const waitSec = marketplaceApifyWaitSeconds();
  const deadlineMs = nowMs() + waitSec * 1000;
  const capUsd = Math.min(input.maxUsd, marketplacePerRunUsdCap());
  const runUrl = marketplaceApifyRunUrl(input.actorId, input.maxItems, capUsd, Math.min(60, waitSec));
  const body = JSON.stringify(sanitizeActorInput(input.payload));
  let res: Response;
  try {
    res = await doFetch(runUrl, { method: "POST", headers: authHeaders(input.token), body });
  } catch (e) {
    return { ok: false, items: [], chargedUsd: 0, error: e instanceof Error ? e.message : "apify_network" };
  }
  const usdPerResult = marketplaceUsdPerResult(input.usdPerResult, input.usdPerThousand);
  const started = unwrapData(await readJson(res));
  const startedId = String(started.id ?? "");
  if (!res.ok) {
    return {
      ok: false,
      items: [],
      chargedUsd: apifyRunChargedUsd(started, 0, usdPerResult),
      error: `apify_http_${res.status}`,
      ...(startedId ? { apifyRunId: startedId } : {}),
    };
  }
  let run = started;
  const status = String(run.status ?? "");
  const runId = startedId;
  if (runId && !TERMINAL_RUN.test(status) && nowMs() < deadlineMs) {
    run = await pollRun({ runId, token: input.token, deadlineMs });
  }
  const finalStatus = String(run.status ?? "");
  const apifyRunId = String(run.id ?? runId);
  const idField = apifyRunId ? { apifyRunId } : {};
  if (!TERMINAL_RUN.test(finalStatus) && finalStatus !== "SUCCEEDED") {
    const chargedUsd = apifyRunChargedUsd(run, 0, usdPerResult);
    return {
      ok: false,
      items: [],
      chargedUsd,
      error: finalStatus ? `apify_${finalStatus.toLowerCase()}` : "apify_timeout",
      ...idField,
    };
  }
  if (finalStatus !== "SUCCEEDED") {
    const chargedUsd = apifyRunChargedUsd(run, 0, usdPerResult);
    return { ok: false, items: [], chargedUsd, error: `apify_${finalStatus.toLowerCase()}`, ...idField };
  }
  if (runId) {
    await sleepMs(2000);
    const refreshRes = await doFetch(`${APIFY_API_BASE}/actor-runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      headers: authHeaders(input.token),
    });
    const refreshed = unwrapData(await readJson(refreshRes));
    if (refreshed.id || refreshed.status || refreshed.chargedEventCounts) run = refreshed;
  }
  const datasetId = String(run.defaultDatasetId ?? "");
  const items = await readDatasetItems(datasetId, input.token, input.maxItems);
  const fallbackUsd = MARKETPLACE_APIFY_START_USD + items.length * usdPerResult;
  const chargedUsd = apifyRunChargedUsd(run, fallbackUsd, usdPerResult, items.length);
  return { ok: true, items, chargedUsd, ...idField };
}

export async function runMarketplaceApifyActor(input: {
  actorId: string;
  payload: Record<string, unknown>;
  maxItems: number;
  maxUsd: number;
  usdPerThousand?: number;
  usdPerResult?: number;
}): Promise<ApifyRunResult> {
  if (!marketplaceLoadsEnabled()) {
    return { ok: false, items: [], chargedUsd: 0, error: "loads_disabled" };
  }
  const token = readApifyToken();
  if (!token) return { ok: false, items: [], chargedUsd: 0, error: "token_missing" };
  if (!input.actorId.trim()) return { ok: false, items: [], chargedUsd: 0, error: "actor_not_configured" };
  const args = {
    actorId: input.actorId,
    token,
    payload: sanitizeActorInput(input.payload),
    maxItems: input.maxItems,
    maxUsd: input.maxUsd,
    ...(input.usdPerThousand != null ? { usdPerThousand: input.usdPerThousand } : {}),
    ...(input.usdPerResult != null ? { usdPerResult: input.usdPerResult } : {}),
  };
  const result = runnerOverride ? await runnerOverride(args) : await defaultMarketplaceApifyRunner(args);
  console.info("[marketplace]", {
    provider: input.actorId,
    apifyRunId: result.apifyRunId ?? "",
    status: result.ok ? "SUCCEEDED" : result.error ?? "failed",
    items: result.items.length,
    chargedUsd: result.chargedUsd,
  });
  return result;
}
