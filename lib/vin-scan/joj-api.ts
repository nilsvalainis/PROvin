/**
 * JoJ Copart/IAAI: GET /search-vin/{vin}?prices_history=1 ($0.50, 1 req/s).
 * Auth: X-JoJAPI-Key (keys start with jk_). Bearer also accepted.
 * 404 / empty lots are charged: cache as nav ierakstu (7d). Found cache 30d.
 * 5xx / gateway errors are free: do not cache. Bill only real HTTP 200/404, never cache hits.
 * /search-lot when VIN is 404 and a lot number is known (listing URL or operator field).
 * Host: https://carstat-copart-iaai.jojapi.net
 */
import "server-only";

import { loadJojNameDict } from "@/lib/vin-scan/joj-dicts";
import { EMPTY_JOJ_NAME_DICT } from "@/lib/vin-scan/joj-labels";
import {
  JOJ_NOT_CONFIGURED,
  jojSearchLotUrl,
  jojSearchVinUrl,
  knownJojLotFromUrl,
  parseJojSearchVinFull,
  type JojKnownLot,
} from "@/lib/vin-scan/parse-joj";
import { readJojVinCache, writeJojVinCache } from "@/lib/vin-scan/store";
import type { VinScanParse } from "@/lib/vin-scan/types";

export const JOJ_API_SOURCE_ID = "joj_copart_iaai" as const;
export const JOJ_API_DEFAULT_BASE = "https://carstat-copart-iaai.jojapi.net";
const MIN_INTERVAL_MS = 1100;
const FETCH_TIMEOUT_MS = 20_000;

export type JojApiEnv = Record<string, string | undefined>;

export function jojApiKey(env: JojApiEnv = process.env): string {
  return String(env.JOJ_API_KEY ?? "").trim();
}

export function jojApiConfigured(env: JojApiEnv = process.env): boolean {
  return Boolean(jojApiKey(env));
}

export function jojApiBaseUrl(env: JojApiEnv = process.env): string {
  const raw = String(env.JOJ_API_BASE_URL ?? "").trim();
  return raw.replace(/\/+$/, "") || JOJ_API_DEFAULT_BASE;
}

let lastCallAt = 0;
let chain: Promise<void> = Promise.resolve();

function waitTurn(): Promise<void> {
  const next = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  chain = next.catch(() => undefined);
  return next;
}

export function jojNotConfiguredParse(): VinScanParse {
  return { status: "skipped", summary: JOJ_NOT_CONFIGURED };
}

/** 404/empty (charged) and 423 (restricted record) are cacheable. 5xx/401/429/gateway are free: retry next scan. */
export function jojParseIsCacheable(parsed: VinScanParse, httpStatus: number): boolean {
  if (parsed.status === "found" || parsed.status === "none") return true;
  return parsed.status === "unknown" && httpStatus === 423;
}

export type FetchJojSearchVinDeps = {
  env?: JojApiEnv;
  fetchImpl?: typeof fetch;
  skipCache?: boolean;
  skipRateLimit?: boolean;
  skipDictCache?: boolean;
  skipDicts?: boolean;
  listingUrl?: string;
  knownLot?: JojKnownLot | null;
};

export type JojSearchVinResult = {
  parse: VinScanParse;
  fromCache: boolean;
  cachedAt: string | null;
  httpStatus: number | null;
  endpoint: string;
  requestId: string | null;
  lotsLength: number;
};

export async function jojApiGet(
  url: string,
  deps: FetchJojSearchVinDeps,
): Promise<{ status: number; json: unknown; requestId: string | null }> {
  const env = deps.env ?? process.env;
  if (!deps.skipRateLimit) await waitTurn();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      accept: "application/json",
      "X-JoJAPI-Key": jojApiKey(env),
      Authorization: `Bearer ${jojApiKey(env)}`,
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, requestId: jojResponseRequestId(res) };
}

function jojResponseRequestId(res: Response): string | null {
  return res.headers.get("x-request-id") || res.headers.get("x-joj-request-id") || null;
}

function jojEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function resolveKnownLot(deps: FetchJojSearchVinDeps): JojKnownLot | null {
  if (deps.knownLot?.lot && deps.knownLot.domain) return deps.knownLot;
  return knownJojLotFromUrl(deps.listingUrl ?? "");
}

function jsonLots(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  return Array.isArray(data.lots) ? data.lots : [];
}

function jsonHasLots(json: unknown): boolean {
  return jsonLots(json).length > 0;
}

function cachedHttpStatus(cached: { parse: VinScanParse; httpStatus?: number }): number | null {
  if (typeof cached.httpStatus === "number") return cached.httpStatus;
  if (cached.parse.status === "none") return 404;
  if (cached.parse.status === "found") return 200;
  return null;
}

export function logJojSearch(info: {
  vin: string;
  endpoint: string;
  httpStatus: number | null;
  lotsLength: number;
  fromCache: boolean;
  requestId: string | null;
}): void {
  console.info("[joj]", {
    vin: info.vin,
    endpoint: info.endpoint,
    httpStatus: info.httpStatus,
    lotsLength: info.lotsLength,
    fromCache: info.fromCache,
    requestId: info.requestId,
  });
}

function finishJojSearch(vin: string, result: JojSearchVinResult): JojSearchVinResult {
  logJojSearch({
    vin,
    endpoint: result.endpoint,
    httpStatus: result.httpStatus,
    lotsLength: result.lotsLength,
    fromCache: result.fromCache,
    requestId: result.requestId,
  });
  return result;
}

export async function fetchJojSearchVin(
  vin: string,
  deps: FetchJojSearchVinDeps = {},
): Promise<JojSearchVinResult> {
  const env = deps.env ?? process.env;
  const clean = vin.trim().toUpperCase();
  const vinEndpoint = jojEndpointLabel(jojSearchVinUrl(clean, jojApiBaseUrl(env)));
  if (!jojApiConfigured(env)) {
    return finishJojSearch(clean, {
      parse: jojNotConfiguredParse(),
      fromCache: false,
      cachedAt: null,
      httpStatus: null,
      endpoint: vinEndpoint,
      requestId: null,
      lotsLength: 0,
    });
  }
  if (!deps.skipCache) {
    const cached = await readJojVinCache(clean).catch(() => null);
    if (cached) {
      return finishJojSearch(clean, {
        parse: cached.parse,
        fromCache: true,
        cachedAt: cached.cachedAt,
        httpStatus: cachedHttpStatus(cached),
        endpoint: vinEndpoint,
        requestId: null,
        lotsLength: cached.parse.auctions?.length ?? 0,
      });
    }
  }
  const base = jojApiBaseUrl(env);
  const vinUrl = jojSearchVinUrl(clean, base);
  const vinRes = await jojApiGet(vinUrl, deps);
  let status = vinRes.status;
  let json = vinRes.json;
  let requestId = vinRes.requestId;
  let endpoint = jojEndpointLabel(vinUrl);
  if (status === 404) {
    const lot = resolveKnownLot(deps);
    if (lot) {
      const lotUrl = jojSearchLotUrl(lot.lot, lot.domain, base);
      const lotRes = await jojApiGet(lotUrl, deps);
      status = lotRes.status;
      json = lotRes.json;
      requestId = lotRes.requestId;
      endpoint = jojEndpointLabel(lotUrl);
    }
  }
  let dict = EMPTY_JOJ_NAME_DICT;
  if (status < 400 && jsonHasLots(json) && !deps.skipDicts) {
    dict = await loadJojNameDict({
      baseUrl: base,
      getJson: (url) => jojApiGet(url, deps),
      skipCache: deps.skipDictCache,
    }).catch(() => EMPTY_JOJ_NAME_DICT);
  }
  const parsed = parseJojSearchVinFull({ status, json, vin: clean, dict }).parse;
  if (jojParseIsCacheable(parsed, status)) {
    await writeJojVinCache(clean, parsed, { httpStatus: status }).catch(() => undefined);
  }
  return finishJojSearch(clean, {
    parse: parsed,
    fromCache: false,
    cachedAt: null,
    httpStatus: status,
    endpoint,
    requestId,
    lotsLength: jsonLots(json).length || parsed.auctions?.length || 0,
  });
}
