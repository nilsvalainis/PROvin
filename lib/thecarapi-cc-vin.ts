/**
 * Admin TheCarApi ielāde Izsoļu portālu arhīva (cc_vin) tabulās un foto grupās.
 * Izsaukums tikai no pogas. Bez THECARAPI_ADMIN_ENABLED klients neiet tīklā.
 */
import "server-only";

import { makeCcVinPhotoId, writeCcVinPhotoJpeg, CC_VIN_PHOTO_MAX_BYTES } from "@/lib/admin-cc-vin-photo-store";
import { fetchAuctionPhotoJpegs } from "@/lib/auction-photo-fetch";
import { applyCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import { emptyCcVinBlock, normalizeCcVinBlock, type CcVinBlockState } from "@/lib/cc-vin-report";
import { makeCcVinPhotoGroupId, syncCcVinPhotoGroupsAndFlat, type CcVinPhotoGroup } from "@/lib/cc-vin-photo-types";
import { isAllowedVinScanAuctionPhotoUrl, type VinScanAuctionPhotoGroupPlan } from "@/lib/order-vin-scan-photos";
import { vinScanAuctionsToCcVinParsed } from "@/lib/order-vin-scan";
import { readThecarapiVinCache } from "@/lib/vin-scan/store";
import {
  fetchThecarapiVinWithDetails,
  THECARAPI_SOURCE_ID,
  thecarapiAdminEnabled,
  thecarapiAdminFlag,
  thecarapiConfigured,
  thecarapiMonthlyCap,
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
    cap: usage.cap || thecarapiMonthlyCap(env),
    cache: cached
      ? { cachedAt: cached.cachedAt, status: cached.parse.status, summary: cached.parse.summary }
      : null,
  };
}

async function storePhotoGroups(opts: {
  sessionId: string;
  plans: readonly VinScanAuctionPhotoGroupPlan[];
  existing?: CcVinPhotoGroup[] | null;
}): Promise<CcVinPhotoGroup[]> {
  const groups: CcVinPhotoGroup[] = [];
  const known = new Set<string>();
  for (const group of opts.existing ?? []) {
    for (const photo of group.photos ?? []) {
      if (photo.sourceUrl) known.add(photo.sourceUrl);
    }
  }
  for (const plan of opts.plans) {
    const wanted = plan.urls.filter((url) => isAllowedVinScanAuctionPhotoUrl(url) && !known.has(url));
    if (wanted.length === 0) continue;
    const fetched = await fetchAuctionPhotoJpegs(wanted, CC_VIN_PHOTO_MAX_BYTES);
    const photos = [];
    for (const row of fetched.ok) {
      if (known.has(row.url)) continue;
      const photoId = makeCcVinPhotoId();
      try {
        await writeCcVinPhotoJpeg(opts.sessionId, photoId, row.jpeg);
      } catch {
        continue;
      }
      known.add(row.url);
      photos.push({ id: photoId, sourceUrl: row.url, contentHash: row.contentHash });
    }
    if (photos.length > 0) {
      groups.push({ id: makeCcVinPhotoGroupId(), title: plan.title.slice(0, 120), photos });
    }
  }
  return groups;
}

function plansFromParse(vin: string, parse: VinScanParse): VinScanAuctionPhotoGroupPlan[] {
  const indicator = buildVinScanIndicator(THECARAPI_SOURCE_ID, vin, parse);
  const plans: VinScanAuctionPhotoGroupPlan[] = [];
  for (const auction of indicator.auctions ?? []) {
    const urls = (auction.photoUrls ?? []).filter((url) => isAllowedVinScanAuctionPhotoUrl(url));
    if (urls.length === 0) continue;
    const title = ["TheCarApi", auction.venue, auction.lot ? `lots ${auction.lot}` : "", auction.date?.slice(0, 4)]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 80);
    plans.push({
      key: `${THECARAPI_SOURCE_ID}|${auction.lot || ""}|${auction.date || ""}`,
      title,
      sourceId: THECARAPI_SOURCE_ID,
      urls,
    });
  }
  return plans;
}

export async function fetchThecarapiCcVinMerge(opts: {
  vin: string;
  prev?: CcVinBlockState | null;
  sessionId?: string;
  skipCache?: boolean;
  deps?: ThecarapiDeps;
}): Promise<{
  parse: VinScanParse;
  block: CcVinBlockState;
  fromCache: boolean;
  cachedAt: string | null;
  billable: boolean;
  used: number;
  cap: number;
  httpStatus: number | null;
  error?: "missing_thecarapi_credentials" | "thecarapi_disabled" | "monthly_cap";
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
      error: "thecarapi_disabled",
    };
  }

  const result = await fetchThecarapiVinWithDetails(opts.vin, { ...opts.deps, env, skipCache: opts.skipCache === true });
  const snap = await usage();
  if (result.parse.summary === "mēneša limits") {
    return {
      parse: result.parse,
      block: prev,
      fromCache: false,
      cachedAt: null,
      billable: false,
      used: snap.used,
      cap: snap.cap,
      httpStatus: null,
      error: "monthly_cap",
    };
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
  if (opts.sessionId && result.parse.status === "found") {
    const stored = await storePhotoGroups({
      sessionId: opts.sessionId,
      plans: plansFromParse(opts.vin, result.parse),
      existing: prev.photoGroups,
    });
    if (stored.length > 0) {
      const synced = syncCcVinPhotoGroupsAndFlat([...(block.photoGroups ?? []), ...stored]);
      block = { ...block, photoGroups: synced.photoGroups, photos: synced.photos };
    }
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
  };
}
