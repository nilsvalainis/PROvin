import "server-only";

import {
  ASV_PHOTO_MAX_BYTES,
  makeAsvPhotoId,
  writeAsvPhotoJpeg,
} from "@/lib/admin-asv-photo-store";
import { jpegFromAdminPhotoUpload } from "@/lib/admin-photo-normalize";
import { ASV_MAX_PHOTOS, makeAsvPhotoGroupId, type AsvPhotoGroup } from "@/lib/asv-photo-types";
import type { AsvBlockState, AsvJojIngest } from "@/lib/asv-report";
import {
  appendAsvPhotoGroups,
  buildAsvJojIngest,
  formatJojAsvCostUsd,
  jojAsvPhotoGroupTitle,
  mergeJojParseIntoAsvBlock,
} from "@/lib/joj-asv-merge";
import { isAllowedVinScanAuctionPhotoUrl } from "@/lib/order-vin-scan-photos";
import { fetchJojSearchVin, jojApiConfigured } from "@/lib/vin-scan/joj-api";
import { knownJojLotFromUrl } from "@/lib/vin-scan/parse-joj";
import type { VinScanParse } from "@/lib/vin-scan/types";

async function downloadAuctionJpeg(url: string): Promise<Buffer | null> {
  if (!isAllowedVinScanAuctionPhotoUrl(url)) return null;
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const normalized = await jpegFromAdminPhotoUpload(Buffer.from(ab), ASV_PHOTO_MAX_BYTES);
    return normalized.ok ? normalized.jpeg : null;
  } catch {
    return null;
  }
}

async function storeJojPhotoGroups(opts: {
  sessionId: string;
  parse: VinScanParse;
  photoUrls: string[];
  title: string;
}): Promise<AsvPhotoGroup[]> {
  const groups: AsvPhotoGroup[] = [];
  if (!opts.sessionId || opts.photoUrls.length === 0) return groups;
  const ids: string[] = [];
  for (const url of opts.photoUrls.slice(0, ASV_MAX_PHOTOS)) {
    if (ids.length >= 12) break;
    const jpeg = await downloadAuctionJpeg(url);
    if (!jpeg) continue;
    const photoId = makeAsvPhotoId();
    try {
      await writeAsvPhotoJpeg(opts.sessionId, photoId, jpeg);
      ids.push(photoId);
    } catch {
      /* skip */
    }
  }
  if (ids.length > 0) {
    groups.push({
      id: makeAsvPhotoGroupId(),
      title: opts.title.slice(0, 120),
      photos: ids.map((id) => ({ id })),
    });
  }
  return groups;
}

export async function fetchJojAsvMerge(opts: {
  vin: string;
  prev: AsvBlockState;
  sessionId?: string;
  listingUrl?: string;
  skipCache?: boolean;
}): Promise<{
  parse: VinScanParse;
  block: AsvBlockState;
  jojIngest: AsvJojIngest;
  storedPhotoGroups: AsvPhotoGroup[];
  costUsd: string;
  error?: string;
}> {
  if (!jojApiConfigured()) {
    const parse: VinScanParse = { status: "skipped", summary: "nav konfigurēts" };
    const fetchedAt = new Date().toISOString();
    return {
      parse,
      block: opts.prev,
      jojIngest: buildAsvJojIngest(opts.vin, parse, fetchedAt),
      storedPhotoGroups: [],
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
  const jojIngest = buildAsvJojIngest(opts.vin, parse, fetchedAt);
  const charged = parse.status === "found" || parse.status === "none";
  const costUsd = charged ? formatJojAsvCostUsd() : "$0.00";

  if (parse.status === "skipped") {
    return {
      parse,
      block: opts.prev,
      jojIngest,
      storedPhotoGroups: [],
      costUsd,
      error: "missing_joj_credentials",
    };
  }

  const { block: merged, photoUrls, photoGroupTitle } = mergeJojParseIntoAsvBlock(
    opts.vin,
    parse,
    opts.prev,
  );
  const storedPhotoGroups = opts.sessionId
    ? await storeJojPhotoGroups({
        sessionId: opts.sessionId,
        parse,
        photoUrls,
        title: photoGroupTitle || jojAsvPhotoGroupTitle(parse),
      })
    : [];
  const photoGroups = appendAsvPhotoGroups(merged.photoGroups, storedPhotoGroups);

  return {
    parse,
    block: { ...merged, jojIngest, photoGroups },
    jojIngest,
    storedPhotoGroups,
    costUsd,
  };
}
