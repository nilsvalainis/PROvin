/**
 * TheCarApi EU izsoļu arhīvs. Maksas. Server-only.
 * VIN SCAN sauc tikai ja THECARAPI_API_KEY un THECARAPI_VIN_SCAN_ENABLED=true.
 * Admin sauc tikai no pogas, ja THECARAPI_ADMIN_ENABLED=true.
 * Nav reģistrēts EXTRA_AUCTION_VIN_PROVIDERS (JoJ zars to sauktu klusi).
 */
import "server-only";

import {
  mergeThecarapiDetails,
  buildThecarapiAdminRecords,
  parseThecarapiDetail,
  parseThecarapiDetailList,
  parseThecarapiHistory,
  thecarapiAbsoluteUrl,
  thecarapiPayloadPending,
  thecarapiDetailPathIsArchive,
  thecarapiRefsFromRecords,
  type ThecarapiAuctionRef,
  type ThecarapiDetailParsed,
  thecarapiAuctionBody,
} from "@/lib/vin-scan/parse-thecarapi";
import {
  THECARAPI_DISABLED_SUMMARY,
  THECARAPI_KEY_INVALID_SUMMARY,
  THECARAPI_LIMITS_SUMMARY,
  thecarapiBaseUrl,
  thecarapiCallsAllowed,
  thecarapiKey,
  thecarapiMonthlyCap,
  thecarapiUsageMonth,
  type ThecarapiEnv,
} from "@/lib/vin-scan/thecarapi-flags";
import { thecarapiJsonHasDetail, thecarapiRecordKey, type ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";
import {
  readThecarapiDetailCache,
  readThecarapiDetailCacheRaw,
  readThecarapiImageCache,
  readThecarapiImageCacheRaw,
  readThecarapiMonthlyUsage,
  readThecarapiVinCache,
  readThecarapiVinCacheRaw,
  writeThecarapiDetailCache,
  writeThecarapiImageCache,
  writeThecarapiMonthlyUsage,
  writeThecarapiVinCache,
} from "@/lib/vin-scan/store";
import type { VinScanParse } from "@/lib/vin-scan/types";

export {
  thecarapiAdminEnabled,
  thecarapiAdminFlag,
  thecarapiBaseUrl,
  thecarapiCallsAllowed,
  thecarapiConfigured,
  thecarapiKey,
  thecarapiMonthlyCap,
  thecarapiVinScanEnabled,
  thecarapiVinScanFlag,
} from "@/lib/vin-scan/thecarapi-flags";

export const THECARAPI_SOURCE_ID = "thecarapi_eu" as const;
export const THECARAPI_TIMEOUT_MS = 15_000;
export const THECARAPI_RETRY_DELAY_MS = 2_000;

export type ThecarapiDeps = {
  env?: ThecarapiEnv;
  fetch?: typeof fetch;
  skipCache?: boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  /**
   * Absolūts termiņš (epoch ms). Pēc tā jaunus TheCarApi izsaukumus nesāk un atgriež jau iegūto
   * ar `partial: true`, lai Vercel funkcija neaizietu līdz 504.
   */
  deadline?: number;
};

/**
 * TheCarApi izsaukumi (vēsture, detaļas, bilžu saraksti) iet pēc kārtas - tie ir ātri un skaitāmi;
 * laiku ņem CDN bildes un Blob ieraksti (tie paralēli, sk. thecarapi-photos). Termiņu pārbauda pirms katra.
 */
export const THECARAPI_PARALLEL = 1;
/** Rezerve pirms termiņa: jaunu izsaukumu nesāk, ja palicis mazāk. */
export const THECARAPI_DEADLINE_RESERVE_MS = 3_000;

export type ThecarapiHistoryResult = {
  parse: VinScanParse;
  httpStatus: number | null;
  fromCache: boolean;
  cachedAt: string | null;
  billable: boolean;
  refs: ThecarapiAuctionRef[];
  records: ThecarapiAdminRecord[];
  recordsComplete: boolean;
  etag: string | null;
  rawJson: unknown;
};

export type ThecarapiDetailsResult = {
  details: ThecarapiDetailParsed[];
  httpStatus: number | null;
  fromCache: boolean;
  billable: boolean;
  rawByKey: Record<string, unknown>;
  /** Termiņš pienāca - daļa lotu netika pieprasīta. */
  partial?: boolean;
  /** Lotes, kurām detaļa netika atrasta: HTTP statuss un atbildes augšējās atslēgas (bez vērtībām). */
  diag: ThecarapiDetailDiag[];
};

export type ThecarapiDetailDiag = {
  site: string;
  id: string;
  status: number | null;
  topKeys: string[];
  path: string;
  note: "detail_absent" | "not_cacheable" | "deadline";
};

type RawCall = {
  status: number;
  json: unknown;
  text: string;
  etag: string | null;
  retryAfter: string | null;
  network: "timeout" | "network" | null;
};

function envOf(deps: ThecarapiDeps): ThecarapiEnv {
  return deps.env ?? process.env;
}

function monthOf(deps: ThecarapiDeps): string {
  return thecarapiUsageMonth(deps.now ? deps.now() : new Date());
}

function nowMs(deps: ThecarapiDeps): number {
  return (deps.now ? deps.now() : new Date()).getTime();
}

/** Atlikušais laiks līdz `deps.deadline` (bez termiņa - Infinity). */
export function thecarapiRemainingMs(deps: ThecarapiDeps): number {
  if (deps.deadline == null || !Number.isFinite(deps.deadline)) return Number.POSITIVE_INFINITY;
  return deps.deadline - nowMs(deps);
}

export function thecarapiPastDeadline(deps: ThecarapiDeps, reserveMs = THECARAPI_DEADLINE_RESERVE_MS): boolean {
  return thecarapiRemainingMs(deps) <= reserveMs;
}

/** Paralēli ar limitu; rezultāti ieejas secībā. */
export async function thecarapiMapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return out;
}

async function sleepMs(ms: number, deps: ThecarapiDeps): Promise<void> {
  if (ms <= 0) return;
  if (deps.sleep) {
    await deps.sleep(ms);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function disabledResult(): ThecarapiHistoryResult {
  return {
    parse: { status: "skipped", summary: THECARAPI_DISABLED_SUMMARY },
    httpStatus: null,
    fromCache: false,
    cachedAt: null,
    billable: false,
    refs: [],
    records: [],
    recordsComplete: false,
    etag: null,
    rawJson: null,
  };
}

export async function thecarapiUsageSnapshot(deps: ThecarapiDeps = {}): Promise<{ used: number; cap: number; month: string }> {
  const month = monthOf(deps);
  const used = await readThecarapiMonthlyUsage(month).catch(() => 0);
  return { used, cap: thecarapiMonthlyCap(envOf(deps)), month };
}

let usageChain: Promise<void> = Promise.resolve();

/** Paralēliem izsaukumiem skaitītāju palielina pa vienam (lasīt+rakstīt nedrīkst pārklāties). */
function bumpUsage(deps: ThecarapiDeps): Promise<void> {
  const run = async () => {
    const month = monthOf(deps);
    const used = await readThecarapiMonthlyUsage(month).catch(() => 0);
    await writeThecarapiMonthlyUsage(month, used + 1).catch(() => undefined);
  };
  usageChain = usageChain.then(run, run);
  return usageChain;
}

export async function thecarapiGet(
  url: string,
  deps: ThecarapiDeps = {},
  etag?: string,
): Promise<RawCall> {
  const fetchImpl = deps.fetch ?? fetch;
  const headers: Record<string, string> = {
    accept: "application/json",
    "X-API-Key": thecarapiKey(envOf(deps)),
  };
  if (etag) headers["If-None-Match"] = etag;
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(
        Math.max(1_000, Math.min(THECARAPI_TIMEOUT_MS, thecarapiRemainingMs(deps) - 1_000)),
      ),
      headers,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      json = null;
    }
    return {
      status: res.status,
      json,
      text,
      etag: res.headers.get("etag"),
      retryAfter: res.headers.get("retry-after"),
      network: null,
    };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : "";
    const timeout = name === "TimeoutError" || name === "AbortError" || /timeout|aborted/i.test(msg);
    return { status: 0, json: null, text: "", etag: null, retryAfter: null, network: timeout ? "timeout" : "network" };
  }
}

function shouldRetry(raw: RawCall): boolean {
  if (raw.status === 401 || raw.status === 403 || raw.status === 429) return false;
  if (raw.network) return true;
  if (raw.status >= 500 && raw.status <= 599) return true;
  return thecarapiPayloadPending(raw.status, raw.json, raw.text);
}

function isBillable(raw: RawCall): boolean {
  if (raw.network) return false;
  if (raw.status === 304 || raw.status <= 0) return false;
  if (raw.status >= 500) return false;
  if (thecarapiPayloadPending(raw.status, raw.json, raw.text)) return false;
  return true;
}

async function thecarapiCall(
  url: string,
  deps: ThecarapiDeps,
  etag?: string,
): Promise<{ raw: RawCall; billable: boolean }> {
  let raw = await thecarapiGet(url, deps, etag);
  if (shouldRetry(raw) && thecarapiRemainingMs(deps) > THECARAPI_RETRY_DELAY_MS + THECARAPI_DEADLINE_RESERVE_MS + 2_000) {
    const pendingOnly = !raw.network && raw.status < 500 && thecarapiPayloadPending(raw.status, raw.json, raw.text);
    await sleepMs(pendingOnly ? 0 : THECARAPI_RETRY_DELAY_MS, deps);
    raw = await thecarapiGet(url, deps, etag);
  }
  const billable = isBillable(raw);
  if (billable) await bumpUsage(deps);
  return { raw, billable };
}

function historyFromRaw(raw: RawCall, base: string): { parse: VinScanParse; refs: ThecarapiAuctionRef[] } {
  if (raw.network === "timeout") {
    return { parse: { status: "timeout", summary: "Avots neatbildēja laikā" }, refs: [] };
  }
  if (raw.network) {
    return { parse: { status: "unknown", summary: "tīkls" }, refs: [] };
  }
  if (raw.status === 401 || raw.status === 403) {
    return { parse: { status: "unknown", summary: THECARAPI_KEY_INVALID_SUMMARY }, refs: [] };
  }
  if (raw.status === 429) {
    const retry = raw.retryAfter ? ` Retry-After: ${raw.retryAfter}` : "";
    return { parse: { status: "unknown", summary: THECARAPI_LIMITS_SUMMARY, detail: retry.trim() }, refs: [] };
  }
  if (thecarapiPayloadPending(raw.status, raw.json, raw.text)) {
    return { parse: { status: "unknown", summary: "detaļas vēl nav gatavas" }, refs: [] };
  }
  if (raw.status >= 500 || raw.status === 0) {
    return { parse: { status: "unknown", summary: "TheCarApi kļūda" }, refs: [] };
  }
  if (raw.json == null && raw.status !== 404) {
    return { parse: { status: "unknown", summary: "TheCarApi atbilde nav JSON" }, refs: [] };
  }
  if (raw.status === 404) {
    return { parse: { status: "none", summary: "nav ierakstu" }, refs: [] };
  }
  return parseThecarapiHistory({ json: raw.json, baseUrl: base });
}

function historyCacheable(parse: VinScanParse, status: number): boolean {
  if (parse.status !== "found" && parse.status !== "none") return false;
  if (status === 401 || status === 403 || status === 429) return false;
  if (status >= 500 || status === 0) return false;
  return status === 200 || status === 404 || parse.status === "found" || parse.status === "none";
}

export async function fetchThecarapiVinHistory(
  vin: string,
  deps: ThecarapiDeps = {},
): Promise<ThecarapiHistoryResult> {
  const env = envOf(deps);
  const clean = vin.trim().toUpperCase();
  if (!thecarapiCallsAllowed(env)) return disabledResult();
  if (!deps.skipCache) {
    const cached = await readThecarapiVinCache(clean).catch(() => null);
    if (cached) {
      return {
        parse: cached.parse,
        httpStatus: cached.httpStatus ?? (cached.parse.status === "none" ? 404 : 200),
        fromCache: true,
        cachedAt: cached.cachedAt,
        billable: false,
        refs: cached.refs ?? [],
        records: cached.records ?? [],
        recordsComplete: cached.recordsComplete === true,
        etag: cached.etag ?? null,
        rawJson: null,
      };
    }
  }
  const previous = await readThecarapiVinCacheRaw(clean).catch(() => null);
  const base = thecarapiBaseUrl(env);
  const url = `${base}/api/vin/${encodeURIComponent(clean)}/history`;
  const call = await thecarapiCall(url, deps, previous?.etag);
  if (call.raw.status === 304 && previous) {
    const cachedAt = new Date().toISOString();
    await writeThecarapiVinCache(clean, previous.parse, {
      httpStatus: previous.httpStatus,
      cachedAt,
      etag: call.raw.etag || previous.etag,
      refs: previous.refs,
      records: previous.records,
      recordsComplete: previous.recordsComplete,
    }).catch(() => undefined);
    return {
      parse: previous.parse,
      httpStatus: 304,
      fromCache: true,
      cachedAt,
      billable: false,
      refs: previous.refs ?? [],
      records: previous.records ?? [],
      recordsComplete: previous.recordsComplete === true,
      etag: call.raw.etag || previous.etag || null,
      rawJson: null,
    };
  }
  const mapped = historyFromRaw(call.raw, base);
  const records =
    mapped.parse.status === "found" ? buildThecarapiAdminRecords({ historyJson: call.raw.json }) : [];
  if (historyCacheable(mapped.parse, call.raw.status)) {
    await writeThecarapiVinCache(clean, mapped.parse, {
      httpStatus: call.raw.status,
      etag: call.raw.etag || undefined,
      refs: mapped.refs,
      records,
      recordsComplete: false,
    }).catch(() => undefined);
  }
  return {
    parse: mapped.parse,
    httpStatus: call.raw.status || null,
    fromCache: false,
    cachedAt: null,
    billable: call.billable,
    refs: mapped.refs,
    records,
    recordsComplete: false,
    etag: call.raw.etag,
    rawJson: call.raw.json,
  };
}

function detailUrl(base: string, refs: readonly ThecarapiAuctionRef[]): string {
  if (refs.length === 1) {
    const ref = refs[0]!;
    return thecarapiAbsoluteUrl(base, ref.detailPath || "", ref.site, ref.id);
  }
  const ids = refs.map((ref) => `${ref.site}:${ref.id}`).join(",");
  return `${base}/api/auction/batch?ids=${encodeURIComponent(ids)}`;
}

function detailCacheable(raw: RawCall): boolean {
  if (raw.network || raw.status === 304) return false;
  if (raw.status === 401 || raw.status === 403 || raw.status === 429) return false;
  if (raw.status >= 500 || raw.status === 0) return false;
  if (thecarapiPayloadPending(raw.status, raw.json, raw.text)) return false;
  return raw.status === 200 && raw.json != null;
}

export async function fetchThecarapiDetails(
  refs: readonly ThecarapiAuctionRef[],
  deps: ThecarapiDeps = {},
): Promise<ThecarapiDetailsResult> {
  const env = envOf(deps);
  const unique: ThecarapiAuctionRef[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const site = ref.site.trim().toLowerCase();
    const id = ref.id.trim();
    if (!site || !id) continue;
    const key = `${site}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ site, id, active: ref.active, detailPath: ref.detailPath });
    if (unique.length >= 100) break;
  }
  if (!thecarapiCallsAllowed(env) || unique.length === 0) {
    return { details: [], httpStatus: null, fromCache: false, billable: false, rawByKey: {}, diag: [] };
  }

  const fresh: ThecarapiDetailParsed[] = [];
  const rawByKey: Record<string, unknown> = {};
  const stale: ThecarapiAuctionRef[] = [];
  if (!deps.skipCache) {
    for (const ref of unique) {
      const cached = await readThecarapiDetailCache(ref.site, ref.id).catch(() => null);
      if (cached && thecarapiJsonHasDetail(cached.json)) {
        fresh.push(parseThecarapiDetail(cached.json));
        rawByKey[thecarapiRecordKey(ref.site, ref.id)] = cached.json;
      } else if (cached && thecarapiDetailAbsent(cached.json) && !absentMarkerStale(cached.json, ref)) {
        /* 200 jau pārbaudīts, šī lota atbildē nebija. Vairs nemaksājam. */
      } else stale.push(ref);
    }
  } else {
    stale.push(...unique);
  }
  if (stale.length === 0) {
    return { details: fresh, httpStatus: 200, fromCache: true, billable: false, rawByKey, diag: [] };
  }

  // Arhivētās lotes batch neatdod - katrai savs `/api/archive/auction/...` izsaukums.
  const archived = stale.filter((ref) => thecarapiDetailPathIsArchive(ref.detailPath));
  const live = stale.filter((ref) => !thecarapiDetailPathIsArchive(ref.detailPath));
  const groups = [...archived.map((ref) => [ref]), ...(live.length ? [live] : [])];
  const base = thecarapiBaseUrl(env);
  const details = [...fresh];
  const diag: ThecarapiDetailDiag[] = [];
  let httpStatus: number | null = null;
  let billable = false;
  let fromCache = true;
  let partial = false;
  const results = await thecarapiMapLimit(groups, THECARAPI_PARALLEL, async (group) => {
    if (thecarapiPastDeadline(deps)) return null;
    return fetchThecarapiDetailGroup(base, group, deps, rawByKey);
  });
  for (const [index, r] of results.entries()) {
    if (!r) {
      partial = true;
      for (const ref of groups[index] ?? []) {
        diag.push({ site: ref.site, id: ref.id, status: null, topKeys: [], path: "", note: "deadline" });
      }
      continue;
    }
    details.push(...r.details);
    diag.push(...r.diag);
    if (httpStatus == null || (r.httpStatus != null && r.httpStatus !== 200 && r.httpStatus !== 304)) httpStatus = r.httpStatus;
    billable = billable || r.billable;
    fromCache = fromCache && r.fromCache;
  }
  return { details, httpStatus, fromCache: fromCache && !partial, billable, rawByKey, diag, partial };
}

/** Tikai atslēgu nosaukumi (ne vērtības), lai redzētu nezināmu atbildes formu. */
function topKeys(json: unknown): string[] {
  if (Array.isArray(json)) return ["[array]"];
  if (!json || typeof json !== "object") return [];
  return Object.keys(json as Record<string, unknown>).slice(0, 30);
}

function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

async function fetchThecarapiDetailGroup(
  base: string,
  stale: readonly ThecarapiAuctionRef[],
  deps: ThecarapiDeps,
  rawByKey: Record<string, unknown>,
): Promise<{ details: ThecarapiDetailParsed[]; httpStatus: number | null; fromCache: boolean; billable: boolean; diag: ThecarapiDetailDiag[] }> {
  const singleRaw = stale.length === 1 ? await readThecarapiDetailCacheRaw(stale[0]!.site, stale[0]!.id).catch(() => null) : null;
  const single = singleRaw && thecarapiJsonHasDetail(singleRaw.json) ? singleRaw : null;
  const url = detailUrl(base, stale);
  const path = urlPath(url);
  const call = await thecarapiCall(url, deps, single?.etag);
  if (call.raw.status === 304 && single) {
    const cachedAt = new Date().toISOString();
    await writeThecarapiDetailCache({
      site: single.site,
      id: single.id,
      cachedAt,
      active: single.active,
      json: single.json,
      etag: call.raw.etag || single.etag,
    }).catch(() => undefined);
    rawByKey[thecarapiRecordKey(single.site, single.id)] = single.json;
    return { details: [parseThecarapiDetail(single.json)], httpStatus: 304, fromCache: true, billable: false, diag: [] };
  }
  const keys = topKeys(call.raw.json);
  if (!detailCacheable(call.raw)) {
    const diag = stale.map((ref) => ({ site: ref.site, id: ref.id, status: call.raw.status || null, topKeys: keys, path, note: "not_cacheable" as const }));
    return { details: [], httpStatus: call.raw.status || null, fromCache: false, billable: call.billable, diag };
  }
  const parsed = parseThecarapiDetailList(call.raw.json);
  const cachedAt = new Date().toISOString();
  for (const detail of parsed) {
    const ref = stale.find((item) => item.id === detail.id && (!detail.site || item.site === detail.site)) ?? stale[0];
    const site = detail.site || ref?.site || "";
    const id = detail.id || ref?.id || "";
    if (!site || !id || detail.pending) continue;
    const body = call.raw.json && stale.length === 1 ? call.raw.json : detailBody(call.raw.json, detail);
    rawByKey[thecarapiRecordKey(site, id)] = body;
    const asked = stale.find((item) => item.id === id && item.site === site);
    if (asked) rawByKey[thecarapiRecordKey(asked.site, asked.id)] = body;
    await writeThecarapiDetailCache({
      site,
      id,
      cachedAt,
      active: detail.active,
      json: body,
      etag: stale.length === 1 ? call.raw.etag || undefined : undefined,
    }).catch(() => undefined);
  }
  if (stale.length === 1 && call.raw.json != null && thecarapiJsonHasDetail(call.raw.json)) {
    const ref = stale[0]!;
    const key = thecarapiRecordKey(ref.site, ref.id);
    if (rawByKey[key] == null) {
      rawByKey[key] = call.raw.json;
      await writeThecarapiDetailCache({
        site: ref.site,
        id: ref.id,
        cachedAt,
        active: ref.active,
        json: call.raw.json,
        etag: call.raw.etag || undefined,
      }).catch(() => undefined);
    }
  }
  const diag: ThecarapiDetailDiag[] = [];
  for (const ref of stale) {
    const key = thecarapiRecordKey(ref.site, ref.id);
    if (rawByKey[key] != null) continue;
    diag.push({ site: ref.site, id: ref.id, status: call.raw.status, topKeys: keys, path, note: "detail_absent" });
    await writeThecarapiDetailCache({
      site: ref.site,
      id: ref.id,
      cachedAt,
      active: ref.active,
      json: { detail_absent: true, http_status: call.raw.status, top_keys: keys, path },
    }).catch(() => undefined);
  }
  return { details: parsed, httpStatus: call.raw.status, fromCache: false, billable: call.billable, diag };
}

/**
 * Vecs marķieris (bez `http_status`) radās, kad arhīva ceļš tika nomests un sauca `/api/auction/...`.
 * Arhivētai lotei to pārbaudām vēlreiz pa pareizo ceļu.
 */
function absentMarkerStale(raw: unknown, ref: ThecarapiAuctionRef): boolean {
  if (!thecarapiDetailPathIsArchive(ref.detailPath)) return false;
  const rec = raw as { http_status?: unknown; path?: unknown };
  return typeof rec.http_status !== "number" || rec.path !== ref.detailPath;
}

function detailBody(json: unknown, detail: ThecarapiDetailParsed): unknown {
  if (!json || typeof json !== "object") return { site_name: detail.site, auction_id: detail.id };
  const root = json as Record<string, unknown>;
  const list = root.auctions ?? root.items ?? root.results ?? root.details;
  if (!Array.isArray(list)) return json;
  const hit = list.find((item) => {
    const row = thecarapiAuctionBody(item);
    if (!row) return false;
    const id = String(row.auction_id ?? row.id ?? "");
    const site = String(row.site_name ?? row.site ?? "").toLowerCase();
    return id === detail.id && (!detail.site || !site || site === detail.site);
  });
  return hit ?? { site_name: detail.site, auction_id: detail.id, gallery: detail.photoUrls, equipment: detail.equipment };
}

function imageUrl(base: string, ref: ThecarapiAuctionRef): string {
  return `${base}/api/auction-images/${encodeURIComponent(ref.site)}/${encodeURIComponent(ref.id)}`;
}

export async function fetchThecarapiAuctionImages(
  refs: readonly ThecarapiAuctionRef[],
  deps: ThecarapiDeps = {},
): Promise<{ byKey: Record<string, unknown>; billable: boolean; partial?: boolean }> {
  const env = envOf(deps);
  const byKey: Record<string, unknown> = {};
  if (!thecarapiCallsAllowed(env) || refs.length === 0) return { byKey, billable: false };
  const base = thecarapiBaseUrl(env);
  let billable = false;
  let partial = false;
  await thecarapiMapLimit(refs, THECARAPI_PARALLEL, async (ref) => {
    const key = thecarapiRecordKey(ref.site, ref.id);
    if (!deps.skipCache) {
      const cached = await readThecarapiImageCache(ref.site, ref.id).catch(() => null);
      // TheCarApi bildes vēl lejupielādēja (`pending`) - saglabātais saraksts nepilns, prasām vēlreiz.
      if (cached && !thecarapiImagesPending(cached.json)) {
        byKey[key] = cached.json;
        return;
      }
    }
    if (thecarapiPastDeadline(deps)) {
      partial = true;
      return;
    }
    const previous = await readThecarapiImageCacheRaw(ref.site, ref.id).catch(() => null);
    const call = await thecarapiCall(imageUrl(base, ref), deps, previous?.etag);
    billable = billable || call.billable;
    if (call.raw.status === 304 && previous) {
      byKey[key] = previous.json;
      await writeThecarapiImageCache({
        site: previous.site,
        id: previous.id,
        cachedAt: new Date().toISOString(),
        active: previous.active,
        json: previous.json,
        etag: call.raw.etag || previous.etag,
      }).catch(() => undefined);
      return;
    }
    if (call.raw.status === 200 && call.raw.json != null && !thecarapiPayloadPending(call.raw.status, call.raw.json, call.raw.text)) {
      byKey[key] = call.raw.json;
      await writeThecarapiImageCache({
        site: ref.site,
        id: ref.id,
        cachedAt: new Date().toISOString(),
        active: ref.active,
        json: call.raw.json,
        etag: call.raw.etag || undefined,
      }).catch(() => undefined);
    }
  });
  return { byKey, billable, partial };
}

function thecarapiDetailAbsent(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return (raw as { detail_absent?: unknown }).detail_absent === true && !thecarapiJsonHasDetail(raw);
}

function recordHasDetail(record: ThecarapiAdminRecord): boolean {
  return thecarapiJsonHasDetail(record.rawDetail) || thecarapiJsonHasDetail(record.raw);
}

function thecarapiCacheHasDetail(
  records: readonly ThecarapiAdminRecord[],
  refs: readonly ThecarapiAuctionRef[],
): boolean {
  if (refs.length === 0 || records.length === 0) return false;
  return refs.every((ref) =>
    records.some((record) => record.site === ref.site && record.id === ref.id && recordHasDetail(record)),
  );
}

function thecarapiDetailStored(
  rawByKey: Readonly<Record<string, unknown>>,
  refs: readonly ThecarapiAuctionRef[],
): boolean {
  if (refs.length === 0) return false;
  return refs.some((ref) => rawByKey[thecarapiRecordKey(ref.site, ref.id)] != null);
}

/** TheCarApi vēl lejupielādē bildes (`pending` > 0) - saglabātais saraksts nav pilns. */
export function thecarapiImagesPending(json: unknown): boolean {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const pending = (json as { pending?: unknown }).pending;
  return typeof pending === "number" && pending > 0;
}

/**
 * Vecā kešā `refs` var būt bez `detailPath` (pirms arhīva ceļa labojuma). Tad detaļu sauca pa
 * `/api/auction/...` un arhivētai lotei saņēma 404 katrā klikšķī. Ceļu ņemam no vēstures ieraksta.
 */
export function thecarapiFillRefPaths(
  refs: readonly ThecarapiAuctionRef[],
  records: readonly ThecarapiAdminRecord[],
): ThecarapiAuctionRef[] {
  if (records.length === 0) return [...refs];
  const fromRecords = new Map(thecarapiRefsFromRecords(records).map((ref) => [`${ref.site}:${ref.id}`, ref]));
  return refs.map((ref) => {
    if (ref.detailPath) return ref;
    const hit = fromRecords.get(`${ref.site}:${ref.id}`);
    return hit?.detailPath ? { ...ref, detailPath: hit.detailPath } : ref;
  });
}

function recordImagesPending(records: readonly ThecarapiAdminRecord[]): boolean {
  return records.some((record) => thecarapiImagesPending(record.rawImages));
}

export async function fetchThecarapiVinWithDetails(
  vin: string,
  deps: ThecarapiDeps = {},
): Promise<ThecarapiHistoryResult & { detailsBillable: boolean; detailDiag?: ThecarapiDetailDiag[]; partial?: boolean }> {
  let history = await fetchThecarapiVinHistory(vin, deps);
  if (history.refs.length === 0 && history.records.length > 0) {
    history = { ...history, refs: thecarapiRefsFromRecords(history.records) };
  } else if (history.records.length > 0) {
    history = { ...history, refs: thecarapiFillRefPaths(history.refs, history.records) };
  }
  if (history.parse.status !== "found" || history.refs.length === 0) {
    return { ...history, detailsBillable: false };
  }
  if (
    !deps.skipCache &&
    history.recordsComplete &&
    thecarapiCacheHasDetail(history.records, history.refs) &&
    !recordImagesPending(history.records)
  ) {
    return { ...history, detailsBillable: false };
  }
  if (history.fromCache && !history.rawJson && history.records.length === 0) {
    history = await fetchThecarapiVinHistory(vin, { ...deps, skipCache: true });
    if (history.parse.status !== "found" || history.refs.length === 0) {
      return { ...history, detailsBillable: false };
    }
  }
  const details = await fetchThecarapiDetails(history.refs, deps);
  const images = await fetchThecarapiAuctionImages(history.refs, deps);
  const partial = details.partial === true || images.partial === true;
  const recordsComplete = !partial && thecarapiDetailStored(details.rawByKey, history.refs);
  const historyJson =
    history.rawJson ??
    ({
      auctions: history.records.map((record) => record.rawHistory).filter((row) => row && typeof row === "object"),
    } as unknown);
  const records = buildThecarapiAdminRecords({
    historyJson,
    detailJson: { auctions: Object.values(details.rawByKey) },
    imagesByKey: images.byKey,
  });
  const clean = vin.trim().toUpperCase();
  const previous = await readThecarapiVinCacheRaw(clean).catch(() => null);
  if (history.parse.status === "found") {
    await writeThecarapiVinCache(clean, mergeThecarapiDetails(history.parse, details.details), {
      httpStatus: history.httpStatus ?? previous?.httpStatus,
      etag: history.etag || previous?.etag,
      refs: history.refs,
      records,
      recordsComplete,
    }).catch(() => undefined);
  }
  return {
    ...history,
    parse: mergeThecarapiDetails(history.parse, details.details),
    records,
    recordsComplete,
    partial,
    billable: history.billable || details.billable || images.billable,
    detailsBillable: details.billable || images.billable,
    detailDiag: details.diag,
  };
}
