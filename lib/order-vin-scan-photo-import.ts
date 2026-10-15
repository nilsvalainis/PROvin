import "server-only";

import { CC_VIN_PHOTO_MAX_BYTES, makeCcVinPhotoId, writeCcVinPhotoJpeg } from "@/lib/admin-cc-vin-photo-store";
import { CC_VIN_MAX_PHOTOS, type CcVinPhotoMeta } from "@/lib/cc-vin-photo-types";
import { fetchAuctionPhotoJpegs } from "@/lib/auction-photo-fetch";
import {
  ORDER_VIN_SCAN_PHOTO_IMPORT_MAX,
  isAllowedVinScanAuctionPhotoUrl,
  type VinScanAuctionPhotoGroupPlan,
} from "@/lib/order-vin-scan-photos";

export type ImportVinScanAuctionPhotoGroupInput = {
  title: string;
  urls: readonly string[];
};

export type ImportedVinScanAuctionPhotoGroup = {
  title: string;
  photoIds: string[];
  photos: CcVinPhotoMeta[];
  failedUrls: string[];
};

export type ImportVinScanAuctionPhotosResult = {
  groups: ImportedVinScanAuctionPhotoGroup[];
  photoIds: string[];
  imported: number;
  skipped: number;
  failed: number;
  failedUrls: string[];
};

function uniqueAllowed(urls: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = raw.trim();
    if (!url || seen.has(url) || !isAllowedVinScanAuctionPhotoUrl(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export async function importVinScanAuctionPhotoGroupsToCcVin(
  sessionId: string,
  groups: readonly ImportVinScanAuctionPhotoGroupInput[],
  opts: {
    existingCount: number;
    existingSourceUrls?: readonly string[];
    existingContentHashes?: readonly string[];
  },
): Promise<ImportVinScanAuctionPhotosResult> {
  const room = Math.max(0, CC_VIN_MAX_PHOTOS - Math.max(0, opts.existingCount));
  const knownUrls = new Set((opts.existingSourceUrls ?? []).map((u) => u.trim()).filter(Boolean));
  const knownHashes = new Set((opts.existingContentHashes ?? []).map((h) => h.trim().toLowerCase()).filter(Boolean));
  const outGroups: ImportedVinScanAuctionPhotoGroup[] = [];
  const photoIds: string[] = [];
  const failedUrls: string[] = [];
  let skipped = 0;
  let used = 0;

  for (const group of groups) {
    const title = group.title.trim().slice(0, 120) || "VIN SCAN";
    const wanted = uniqueAllowed(group.urls).slice(0, ORDER_VIN_SCAN_PHOTO_IMPORT_MAX);
    const toFetch: string[] = [];
    for (const url of wanted) {
      if (used >= room) {
        skipped += 1;
        continue;
      }
      if (knownUrls.has(url)) {
        skipped += 1;
        continue;
      }
      toFetch.push(url);
    }
    if (toFetch.length === 0) {
      if (wanted.length > 0) {
        outGroups.push({ title, photoIds: [], photos: [], failedUrls: [] });
      }
      continue;
    }

    const fetched = await fetchAuctionPhotoJpegs(toFetch, CC_VIN_PHOTO_MAX_BYTES);
    const photos: CcVinPhotoMeta[] = [];
    const groupFailed: string[] = [];
    for (const row of fetched.ok) {
      if (used >= room) {
        skipped += 1;
        continue;
      }
      if (knownHashes.has(row.contentHash) || knownUrls.has(row.url)) {
        skipped += 1;
        continue;
      }
      const photoId = makeCcVinPhotoId();
      try {
        await writeCcVinPhotoJpeg(sessionId, photoId, row.jpeg);
      } catch {
        groupFailed.push(row.url);
        failedUrls.push(row.url);
        continue;
      }
      knownUrls.add(row.url);
      knownHashes.add(row.contentHash);
      used += 1;
      const meta: CcVinPhotoMeta = { id: photoId, sourceUrl: row.url, contentHash: row.contentHash };
      photos.push(meta);
      photoIds.push(photoId);
    }
    for (const row of fetched.failed) {
      groupFailed.push(row.url);
      failedUrls.push(row.url);
    }
    outGroups.push({ title, photoIds: photos.map((p) => p.id), photos, failedUrls: groupFailed });
  }

  return {
    groups: outGroups,
    photoIds,
    imported: photoIds.length,
    skipped,
    failed: failedUrls.length,
    failedUrls,
  };
}

/** Vecais plakanais ceļš: viena grupa, visi URL. */
export async function importVinScanAuctionPhotosToCcVin(
  sessionId: string,
  urls: readonly string[],
  existingCount: number,
  opts?: { existingSourceUrls?: readonly string[]; existingContentHashes?: readonly string[] },
): Promise<ImportVinScanAuctionPhotosResult> {
  return importVinScanAuctionPhotoGroupsToCcVin(
    sessionId,
    [{ title: "VIN SCAN", urls }],
    {
      existingCount,
      existingSourceUrls: opts?.existingSourceUrls,
      existingContentHashes: opts?.existingContentHashes,
    },
  );
}

export function plansToImportGroups(
  plans: readonly VinScanAuctionPhotoGroupPlan[],
): ImportVinScanAuctionPhotoGroupInput[] {
  return plans.map((plan) => ({ title: plan.title, urls: plan.urls }));
}
