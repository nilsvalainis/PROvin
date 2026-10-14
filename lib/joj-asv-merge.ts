/**
 * JoJ Copart/IAAI → ASV avota slānis (apvienošana ar deduplikāciju: lib/asv-source-merge).
 */

import type { AsvBlockState, AsvJojIngest } from "@/lib/asv-report";
import {
  normalizeAsvPhotoGroups,
  type AsvPhotoGroup,
  ASV_MAX_PHOTOS,
  countAsvPhotos,
} from "@/lib/asv-photo-types";
import { bundleFromJojVinScan, setAsvJojSnapshot } from "@/lib/asv-source-merge";
import { collectVinScanAuctionPhotoUrls } from "@/lib/order-vin-scan-photos";
import { buildVinScanIndicator } from "@/lib/vin-scan/types";
import { JOJ_API_SOURCE_ID } from "@/lib/vin-scan/joj-api";
import type { VinScanParse, VinScanStatus } from "@/lib/vin-scan/types";

export const JOJ_ASV_PRICE_USD_CENTS = 50;

export function formatJojAsvCostUsd(): string {
  return `$${(JOJ_ASV_PRICE_USD_CENTS / 100).toFixed(2)}`;
}

function jojIngestStatusFromParse(status: VinScanStatus): AsvJojIngest["status"] {
  if (status === "found") return "found";
  if (status === "none") return "none";
  if (status === "skipped") return "skipped";
  return "unknown";
}

export function buildAsvJojIngest(vin: string, parse: VinScanParse, fetchedAt: string): AsvJojIngest {
  const charged = parse.status === "found" || parse.status === "none";
  return {
    lastFetchedVin: vin,
    fetchedAt,
    lastCostUsd: charged ? formatJojAsvCostUsd() : "$0.00",
    status: jojIngestStatusFromParse(parse.status),
    summary: parse.summary?.trim() || "",
  };
}

export function jojAsvPhotoGroupTitle(parse: VinScanParse): string {
  const venue = parse.auctions?.[0]?.venue?.trim() || "Copart/IAAI";
  return `JoJ · ${venue}`.slice(0, 120);
}

export function mergeJojParseIntoAsvBlock(
  vin: string,
  parse: VinScanParse,
  prev: AsvBlockState,
): { block: AsvBlockState; photoUrls: string[]; photoGroupTitle: string } {
  const indicator = buildVinScanIndicator(JOJ_API_SOURCE_ID, vin, parse);
  const photoUrls = collectVinScanAuctionPhotoUrls([indicator]);
  const jojBundle = bundleFromJojVinScan(vin, parse);
  const block = setAsvJojSnapshot(prev, jojBundle);
  return {
    block,
    photoUrls,
    photoGroupTitle: jojAsvPhotoGroupTitle(parse),
  };
}

export function appendAsvPhotoGroups(
  existing: AsvPhotoGroup[] | null | undefined,
  incoming: AsvPhotoGroup[] | null | undefined,
): AsvPhotoGroup[] {
  const base = normalizeAsvPhotoGroups(existing);
  const add = normalizeAsvPhotoGroups(incoming);
  if (add.length === 0) return base;
  const merged = [...base];
  for (const group of add) {
    if ((group.photos?.length ?? 0) === 0) continue;
    merged.push(group);
  }
  const normalized = normalizeAsvPhotoGroups(merged);
  if (countAsvPhotos(normalized) <= ASV_MAX_PHOTOS) return normalized;
  const out: AsvPhotoGroup[] = [];
  let total = 0;
  for (const group of normalized) {
    const remaining = ASV_MAX_PHOTOS - total;
    if (remaining <= 0) break;
    const photos = group.photos.slice(0, remaining);
    total += photos.length;
    if (photos.length === 0 && !group.title.trim()) continue;
    out.push({ ...group, photos });
  }
  return out;
}
