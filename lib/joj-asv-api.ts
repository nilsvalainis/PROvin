import "server-only";

import { ASV_PHOTO_MAX_BYTES, makeAsvPhotoId, writeAsvPhotoJpeg } from "@/lib/admin-asv-photo-store";
import { fetchAuctionPhotoJpegs } from "@/lib/auction-photo-fetch";
import { ASV_MAX_PHOTOS, makeAsvPhotoGroupId, type AsvPhotoGroup, type AsvPhotoMeta } from "@/lib/asv-photo-types";
import type { AsvBlockState, AsvJojFailedPhotoGroup, AsvJojIngest } from "@/lib/asv-report";
import {
  appendAsvPhotoGroups,
  buildAsvJojIngest,
  formatJojAsvCostUsd,
  jojAsvPhotoGroupTitle,
  mergeJojParseIntoAsvBlock,
} from "@/lib/joj-asv-merge";
import { isAllowedVinScanAuctionPhotoUrl, type VinScanAuctionPhotoGroupPlan } from "@/lib/order-vin-scan-photos";
import { fetchJojSearchVin, jojApiConfigured } from "@/lib/vin-scan/joj-api";
import { knownJojLotFromUrl } from "@/lib/vin-scan/parse-joj";
import type { VinScanParse } from "@/lib/vin-scan/types";

export type StoreJojPhotoGroupsResult = {
  groups: AsvPhotoGroup[];
  failedPhotoGroups: AsvJojFailedPhotoGroup[];
};

function existingAsvPhotoKeys(groups: AsvPhotoGroup[] | null | undefined): {
  urls: Set<string>;
  hashes: Set<string>;
} {
  const urls = new Set<string>();
  const hashes = new Set<string>();
  for (const group of groups ?? []) {
    for (const photo of group.photos ?? []) {
      if (photo.sourceUrl) urls.add(photo.sourceUrl);
      if (photo.contentHash) hashes.add(photo.contentHash.toLowerCase());
    }
  }
  return { urls, hashes };
}

export async function storeJojPhotoGroups(opts: {
  sessionId: string;
  photoGroups: readonly VinScanAuctionPhotoGroupPlan[];
  existing?: AsvPhotoGroup[] | null;
}): Promise<StoreJojPhotoGroupsResult> {
  const groups: AsvPhotoGroup[] = [];
  const failedPhotoGroups: AsvJojFailedPhotoGroup[] = [];
  if (!opts.sessionId) return { groups, failedPhotoGroups };

  const known = existingAsvPhotoKeys(opts.existing);
  let used = countExistingAsvPhotos(opts.existing);

  for (const plan of opts.photoGroups) {
    const wanted = plan.urls.filter((u) => isAllowedVinScanAuctionPhotoUrl(u) && !known.urls.has(u));
    if (wanted.length === 0) continue;
    const room = Math.max(0, ASV_MAX_PHOTOS - used);
    const toFetch = wanted.slice(0, room);
    const skipped = wanted.length - toFetch.length;
    if (toFetch.length === 0) {
      if (skipped > 0) failedPhotoGroups.push({ title: plan.title, urls: wanted });
      continue;
    }

    const fetched = await fetchAuctionPhotoJpegs(toFetch, ASV_PHOTO_MAX_BYTES);
    const photos: AsvPhotoMeta[] = [];
    const failedUrls: string[] = fetched.failed.map((row) => row.url);
    for (const row of fetched.ok) {
      if (used >= ASV_MAX_PHOTOS) {
        failedUrls.push(row.url);
        continue;
      }
      if (known.hashes.has(row.contentHash) || known.urls.has(row.url)) continue;
      const photoId = makeAsvPhotoId();
      try {
        await writeAsvPhotoJpeg(opts.sessionId, photoId, row.jpeg);
      } catch {
        failedUrls.push(row.url);
        continue;
      }
      known.urls.add(row.url);
      known.hashes.add(row.contentHash);
      used += 1;
      photos.push({ id: photoId, sourceUrl: row.url, contentHash: row.contentHash });
    }
    if (photos.length > 0) {
      groups.push({
        id: makeAsvPhotoGroupId(),
        title: plan.title.slice(0, 120),
        photos,
      });
    }
    if (failedUrls.length > 0) {
      failedPhotoGroups.push({ title: plan.title, urls: failedUrls });
    }
  }

  return { groups, failedPhotoGroups };
}

function countExistingAsvPhotos(groups: AsvPhotoGroup[] | null | undefined): number {
  let n = 0;
  for (const group of groups ?? []) n += group.photos?.length ?? 0;
  return n;
}

export async function fetchJojAsvMerge(opts: {
  vin: string;
  prev: AsvBlockState;
  sessionId?: string;
  listingUrl?: string;
  skipCache?: boolean;
  retryPhotoGroups?: AsvJojFailedPhotoGroup[];
}): Promise<{
  parse: VinScanParse;
  block: AsvBlockState;
  jojIngest: AsvJojIngest;
  storedPhotoGroups: AsvPhotoGroup[];
  failedPhotoGroups: AsvJojFailedPhotoGroup[];
  costUsd: string;
  error?: string;
}> {
  if (opts.retryPhotoGroups?.length && opts.sessionId) {
    const stored = await storeJojPhotoGroups({
      sessionId: opts.sessionId,
      photoGroups: opts.retryPhotoGroups.map((g) => ({
        key: `retry|${g.title}`,
        title: g.title || jojAsvPhotoGroupTitle({ status: "found", summary: "" }),
        sourceId: "joj_copart_iaai",
        urls: g.urls,
      })),
      existing: opts.prev.photoGroups,
    });
    const photoGroups = appendAsvPhotoGroups(opts.prev.photoGroups, stored.groups);
    const jojIngest: AsvJojIngest = {
      ...(opts.prev.jojIngest ?? buildAsvJojIngest(opts.vin, { status: "found", summary: "" }, new Date().toISOString())),
      ...(stored.failedPhotoGroups.length ? { failedPhotoGroups: stored.failedPhotoGroups } : { failedPhotoGroups: undefined }),
    };
    return {
      parse: { status: "found", summary: opts.prev.jojIngest?.summary || "JoJ foto atkārtošana" },
      block: { ...opts.prev, jojIngest, photoGroups },
      jojIngest,
      storedPhotoGroups: stored.groups,
      failedPhotoGroups: stored.failedPhotoGroups,
      costUsd: "$0.00",
    };
  }

  if (!jojApiConfigured()) {
    const parse: VinScanParse = { status: "skipped", summary: "nav konfigurēts" };
    const fetchedAt = new Date().toISOString();
    return {
      parse,
      block: opts.prev,
      jojIngest: buildAsvJojIngest(opts.vin, parse, fetchedAt),
      storedPhotoGroups: [],
      failedPhotoGroups: [],
      costUsd: "$0.00",
      error: "missing_joj_credentials",
    };
  }

  const knownLot = knownJojLotFromUrl(opts.listingUrl ?? "");
  const parse = await fetchJojSearchVin(opts.vin, {
    listingUrl: opts.listingUrl,
    knownLot,
    skipCache: opts.skipCache === true,
  });
  const fetchedAt = new Date().toISOString();
  const charged = parse.status === "found" || parse.status === "none";
  const costUsd = charged ? formatJojAsvCostUsd() : "$0.00";

  if (parse.status === "skipped") {
    const jojIngest = buildAsvJojIngest(opts.vin, parse, fetchedAt);
    return {
      parse,
      block: opts.prev,
      jojIngest,
      storedPhotoGroups: [],
      failedPhotoGroups: [],
      costUsd,
      error: "missing_joj_credentials",
    };
  }

  const { block: merged, photoGroups: plans } = mergeJojParseIntoAsvBlock(opts.vin, parse, opts.prev);
  const stored = opts.sessionId
    ? await storeJojPhotoGroups({
        sessionId: opts.sessionId,
        photoGroups: plans,
        existing: opts.prev.photoGroups,
      })
    : { groups: [] as AsvPhotoGroup[], failedPhotoGroups: [] as AsvJojFailedPhotoGroup[] };
  const photoGroups = appendAsvPhotoGroups(merged.photoGroups, stored.groups);
  const jojIngest = buildAsvJojIngest(opts.vin, parse, fetchedAt, {
    failedPhotoGroups: stored.failedPhotoGroups,
  });

  return {
    parse,
    block: { ...merged, jojIngest, photoGroups },
    jojIngest,
    storedPhotoGroups: stored.groups,
    failedPhotoGroups: stored.failedPhotoGroups,
    costUsd,
  };
}
