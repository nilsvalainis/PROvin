/**
 * JoJ API Copart and IAAI: GET /search-vin/{vin} ($0.50, 1 req/s).
 * Auth: X-JoJAPI-Key. Host: https://<slug>.jojapi.net (docs: consumers only see *.jojapi.net).
 */
import "server-only";

import { JOJ_NOT_CONFIGURED, jojSearchVinUrl, parseJojSearchVin } from "@/lib/vin-scan/parse-joj";
import { readJojVinCache, writeJojVinCache } from "@/lib/vin-scan/store";
import type { VinScanParse } from "@/lib/vin-scan/types";

export const JOJ_API_SOURCE_ID = "joj_copart_iaai" as const;
export const JOJ_API_DEFAULT_BASE = "https://copart-and-iaai-api.jojapi.net";
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
};

export async function fetchJojSearchVin(vin: string, deps: FetchJojSearchVinDeps = {}): Promise<VinScanParse> {
  const env = deps.env ?? process.env;
  if (!jojApiConfigured(env)) return jojNotConfiguredParse();
  const clean = vin.trim().toUpperCase();
  if (!deps.skipCache) {
    const cached = await readJojVinCache(clean).catch(() => null);
    if (cached) return cached.parse;
  }
  if (!deps.skipRateLimit) await waitTurn();
  const url = jojSearchVinUrl(clean, jojApiBaseUrl(env));
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
  const parsed = parseJojSearchVin({ status: res.status, json, vin: clean });
  const cacheable = parsed.status === "found" || parsed.status === "none" || (parsed.status === "unknown" && res.status === 423);
  if (cacheable) await writeJojVinCache(clean, parsed).catch(() => undefined);
  return parsed;
}
