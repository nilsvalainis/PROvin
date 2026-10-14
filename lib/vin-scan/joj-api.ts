/**
 * JoJ Copart/IAAI: GET /search-vin/{vin}?prices_history=1 ($0.50, 1 req/s).
 * 404 = nav ierakstu (kešs). /search-lot tikai ja VIN 404 un lots ir zināms.
 * Auth: X-JoJAPI-Key (jk_). Host: https://carstat-copart-iaai.jojapi.net
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

export type FetchJojSearchVinDeps = {
  env?: JojApiEnv;
  fetchImpl?: typeof fetch;
  skipCache?: boolean;
  skipRateLimit?: boolean;
  skipDictCache?: boolean;
  skipDicts?: boolean;
  listingUrl?: string;
  knownLot?: { lot: string; domain: "copart_com" | "iaai_com" } | null;
};

export async function jojApiGet(
  url: string,
  deps: FetchJojSearchVinDeps,
): Promise<{ status: number; json: unknown }> {
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
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function resolveKnownLot(deps: FetchJojSearchVinDeps): { lot: string; domain: "copart_com" | "iaai_com" } | null {
  if (deps.knownLot?.lot && deps.knownLot.domain) return deps.knownLot;
  return knownJojLotFromUrl(deps.listingUrl ?? "");
}

function jsonHasLots(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const root = json as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? (root.data as Record<string, unknown>) : root;
  return Array.isArray(data.lots) && data.lots.length > 0;
}

export async function fetchJojSearchVin(vin: string, deps: FetchJojSearchVinDeps = {}): Promise<VinScanParse> {
  const env = deps.env ?? process.env;
  if (!jojApiConfigured(env)) return jojNotConfiguredParse();
  const clean = vin.trim().toUpperCase();
  if (!deps.skipCache) {
    const cached = await readJojVinCache(clean).catch(() => null);
    if (cached) return cached.parse;
  }
  const base = jojApiBaseUrl(env);
  const vinRes = await jojApiGet(jojSearchVinUrl(clean, base), deps);
  let status = vinRes.status;
  let json = vinRes.json;
  if (status === 404) {
    const lot = resolveKnownLot(deps);
    if (lot) {
      const lotRes = await jojApiGet(jojSearchLotUrl(lot.lot, lot.domain, base), deps);
      status = lotRes.status;
      json = lotRes.json;
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
  const cacheable =
    parsed.status === "found" || parsed.status === "none" || (parsed.status === "unknown" && status === 423);
  if (cacheable) await writeJojVinCache(clean, parsed).catch(() => undefined);
  return parsed;
}
