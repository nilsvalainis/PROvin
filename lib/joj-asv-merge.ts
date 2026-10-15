/**
 * JoJ Copart/IAAI → ASV avota slānis (apvienošana ar deduplikāciju: lib/asv-source-merge).
 */

import type { AsvBlockState, AsvJojIngest } from "@/lib/asv-report";
import {
  ASV_MAX_PHOTOS,
  countAsvPhotos,
  makeAsvPhotoGroupId,
  normalizeAsvPhotoGroups,
  type AsvPhotoGroup,
} from "@/lib/asv-photo-types";
import { mergeImportedPhotoGroups } from "@/lib/auction-photo-group-merge";
import { bundleFromJojVinScan, setAsvJojSnapshot } from "@/lib/asv-source-merge";
import {
  collectVinScanAuctionPhotoGroups,
  vinScanAuctionPhotoGroupTitleForAuction,
  type VinScanAuctionPhotoGroupPlan,
} from "@/lib/order-vin-scan-photos";
import { buildVinScanIndicator, type VinScanParse, type VinScanStatus } from "@/lib/vin-scan/types";

const JOJ_ASV_SOURCE_ID = "joj_copart_iaai" as const;

export const JOJ_ASV_PRICE_USD_CENTS = 50;

export function formatJojAsvCostUsd(): string {
  return `$${(JOJ_ASV_PRICE_USD_CENTS / 100).toFixed(2)}`;
}

/** Keša trāpījums nav rēķins. Rēķina tikai reālu HTTP 200 vai 404. */
export function jojAsvCostUsd(opts: { fromCache?: boolean; httpStatus?: number | null }): string {
  if (opts.fromCache) return "$0.00";
  if (opts.httpStatus === 200 || opts.httpStatus === 404) return formatJojAsvCostUsd();
  return "$0.00";
}

export function formatJojFetchedAtRiga(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const parts = new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  if (!day || !month || !year) return "";
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

export function jojCacheHitLabel(cachedAtIso: string): string {
  const date = formatJojFetchedAtRiga(cachedAtIso);
  return date ? `no keša (${date})` : "no keša";
}

export function jojCacheNoneConfirmMessage(cachedAtIso: string): string {
  const date = formatJojFetchedAtRiga(cachedAtIso);
  return `Kešā: nav ierakstu (${date}). Pieprasīt vēlreiz par 0,50 $?`;
}

function jojIngestStatusFromParse(status: VinScanStatus): AsvJojIngest["status"] {
  if (status === "found") return "found";
  if (status === "none") return "none";
  if (status === "skipped") return "skipped";
  return "unknown";
}

export type BuildAsvJojIngestExtra = Pick<
  AsvJojIngest,
  "failedPhotoGroups" | "fromCache" | "cachedAt" | "httpStatus" | "lot" | "lotDomain"
>;

export function buildAsvJojIngest(
  vin: string,
  parse: VinScanParse,
  fetchedAt: string,
  extra?: BuildAsvJojIngestExtra,
): AsvJojIngest {
  const fromCache = extra?.fromCache === true;
  const httpStatus = extra?.httpStatus;
  return {
    lastFetchedVin: vin,
    fetchedAt,
    lastCostUsd: jojAsvCostUsd({ fromCache, httpStatus }),
    status: jojIngestStatusFromParse(parse.status),
    summary: parse.summary?.trim() || "",
    ...(fromCache ? { fromCache: true } : {}),
    ...(extra?.cachedAt ? { cachedAt: extra.cachedAt } : {}),
    ...(httpStatus != null ? { httpStatus } : {}),
    ...(extra?.lot ? { lot: extra.lot } : {}),
    ...(extra?.lotDomain ? { lotDomain: extra.lotDomain } : {}),
    ...(extra?.failedPhotoGroups?.length ? { failedPhotoGroups: extra.failedPhotoGroups } : {}),
  };
}

export function jojAsvPhotoGroupTitle(parse: VinScanParse): string {
  const first = parse.auctions?.[0];
  if (first) return vinScanAuctionPhotoGroupTitleForAuction(JOJ_ASV_SOURCE_ID, first);
  return "JoJ · Copart/IAAI";
}

export function jojAsvPhotoGroupPlans(parse: VinScanParse): VinScanAuctionPhotoGroupPlan[] {
  const indicator = buildVinScanIndicator(JOJ_ASV_SOURCE_ID, "", parse);
  return collectVinScanAuctionPhotoGroups([indicator]);
}

export function mergeJojParseIntoAsvBlock(
  vin: string,
  parse: VinScanParse,
  prev: AsvBlockState,
): { block: AsvBlockState; photoUrls: string[]; photoGroups: VinScanAuctionPhotoGroupPlan[]; photoGroupTitle: string } {
  const photoGroups = jojAsvPhotoGroupPlans(parse);
  const photoUrls = photoGroups.flatMap((g) => g.urls);
  const jojBundle = bundleFromJojVinScan(vin, parse);
  const block = setAsvJojSnapshot(prev, jojBundle);
  return {
    block,
    photoUrls,
    photoGroups,
    photoGroupTitle: photoGroups[0]?.title || jojAsvPhotoGroupTitle(parse),
  };
}

export function appendAsvPhotoGroups(
  existing: AsvPhotoGroup[] | null | undefined,
  incoming: AsvPhotoGroup[] | null | undefined,
): AsvPhotoGroup[] {
  const base = normalizeAsvPhotoGroups(existing);
  const add = normalizeAsvPhotoGroups(incoming);
  if (add.length === 0) return base;
  const merged = mergeImportedPhotoGroups(
    base,
    add.map((g) => ({ title: g.title, photos: g.photos })),
    makeAsvPhotoGroupId,
  );
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
