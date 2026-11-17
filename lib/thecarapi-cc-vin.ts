/**
 * Admin TheCarApi ielāde Izsoļu portālu arhīva (cc_vin) tabulās un foto grupās.
 * Izsaukums tikai no pogas. Bez THECARAPI_ADMIN_ENABLED klients neiet tīklā.
 */
import "server-only";

import { applyCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import { emptyCcVinBlock, normalizeCcVinBlock, type CcVinBlockState } from "@/lib/cc-vin-report";
import { syncCcVinPhotoGroupsAndFlat } from "@/lib/cc-vin-photo-types";
import { vinScanAuctionsToCcVinParsed } from "@/lib/order-vin-scan";
import { storeThecarapiGallery, type ThecarapiGalleryFetch, type ThecarapiGalleryWrite } from "@/lib/thecarapi-photos";
import { readThecarapiVinCache, readThecarapiVinCacheRaw, writeThecarapiVinCache } from "@/lib/vin-scan/store";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";
import {
  fetchThecarapiVinWithDetails,
  THECARAPI_SOURCE_ID,
  thecarapiAdminEnabled,
  thecarapiAdminFlag,
  thecarapiConfigured,
  thecarapiUsageSnapshot,
  type ThecarapiDeps,
} from "@/lib/vin-scan/thecarapi-api";
import { buildVinScanIndicator, type VinScanParse } from "@/lib/vin-scan/types";

export type ThecarapiAdminStatus = {
  enabled: boolean;
  configured: boolean;
  adminFlag: boolean;
  used: number;
  cap: number;
  cache: { cachedAt: string; status: string; summary: string } | null;
  records: ThecarapiAdminRecord[];
};

export async function thecarapiAdminStatus(vin = "", deps: ThecarapiDeps = {}): Promise<ThecarapiAdminStatus> {
  const env = deps.env ?? process.env;
  const usage = await thecarapiUsageSnapshot(deps);
  const clean = vin.trim().toUpperCase();
  const cached = clean ? await readThecarapiVinCache(clean).catch(() => null) : null;
  return {
    enabled: thecarapiAdminEnabled(env),
    configured: thecarapiConfigured(env),
    adminFlag: thecarapiAdminFlag(env),
    used: usage.used,
    cap: usage.cap,
    cache: cached
      ? { cachedAt: cached.cachedAt, status: cached.parse.status, summary: cached.parse.summary }
      : null,
    records: cached?.records ?? [],
  };
}

export async function fetchThecarapiCcVinMerge(opts: {
  vin: string;
  prev?: CcVinBlockState | null;
  sessionId?: string;
  skipCache?: boolean;
  deps?: ThecarapiDeps;
  fetchJpegs?: ThecarapiGalleryFetch;
  writeJpeg?: ThecarapiGalleryWrite;
}): Promise<{
  parse: VinScanParse;
  block: CcVinBlockState;
  fromCache: boolean;
  cachedAt: string | null;
  billable: boolean;
  used: number;
  cap: number;
  httpStatus: number | null;
  records: ThecarapiAdminRecord[];
  error?: "missing_thecarapi_credentials" | "thecarapi_disabled";
}> {
  const env = opts.deps?.env ?? process.env;
  const prev = opts.prev ?? emptyCcVinBlock();
  const usage = () => thecarapiUsageSnapshot(opts.deps);
  if (!thecarapiConfigured(env)) {
    const snap = await usage();
    return {
      parse: { status: "skipped", summary: "TheCarApi izslēgts (nav apmaksāts / nav atslēgas)" },
      block: prev,
      fromCache: false,
      cachedAt: null,
      billable: false,
      used: snap.used,
      cap: snap.cap,
      httpStatus: null,
      records: [],
      error: "missing_thecarapi_credentials",
    };
  }
  if (!thecarapiAdminFlag(env)) {
    const snap = await usage();
    return {
      parse: { status: "skipped", summary: "TheCarApi izslēgts (nav apmaksāts / nav atslēgas)" },
      block: prev,
      fromCache: false,
      cachedAt: null,
      billable: false,
      used: snap.used,
      cap: snap.cap,
      httpStatus: null,
      records: [],
      error: "thecarapi_disabled",
    };
  }

  const result = await fetchThecarapiVinWithDetails(opts.vin, { ...opts.deps, env, skipCache: opts.skipCache === true });
  const snap = await usage();

  const gallery = await storeThecarapiGallery({
    vin: opts.vin,
    sessionId: opts.sessionId,
    records: result.records ?? [],
    existing: prev.photoGroups,
    fetchJpegs: opts.fetchJpegs,
    writeJpeg: opts.writeJpeg,
  });
  const previous = await readThecarapiVinCacheRaw(opts.vin).catch(() => null);
  if (previous && gallery.records.length > 0) {
    await writeThecarapiVinCache(opts.vin, result.parse, {
      httpStatus: previous.httpStatus,
      etag: previous.etag,
      refs: previous.refs,
      records: gallery.records,
      recordsComplete: true,
      cachedAt: previous.cachedAt,
    }).catch(() => undefined);
  }

  const indicator = buildVinScanIndicator(THECARAPI_SOURCE_ID, opts.vin, result.parse);
  const parsed = vinScanAuctionsToCcVinParsed([indicator]);
  let block = applyCcVinParsedReport(parsed, prev);
  if (result.parse.detail?.trim()) {
    block = {
      ...block,
      aiContextRaw: [block.aiContextRaw.trim(), result.parse.detail.trim()].filter(Boolean).join("\n\n").slice(0, 20_000),
    };
  }
  block = { ...block, thecarapiRecords: gallery.records };
  if (gallery.groups.length > 0) {
    const synced = syncCcVinPhotoGroupsAndFlat([...(block.photoGroups ?? []), ...gallery.groups]);
    block = { ...block, photoGroups: synced.photoGroups, photos: synced.photos };
  }
  return {
    parse: result.parse,
    block: normalizeCcVinBlock(block),
    fromCache: result.fromCache,
    cachedAt: result.cachedAt,
    billable: result.billable,
    used: snap.used,
    cap: snap.cap,
    httpStatus: result.httpStatus,
    records: gallery.records,
  };
}
