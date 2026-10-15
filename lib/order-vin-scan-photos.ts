/**
 * VIN SCAN izsoļu foto URL: atlase un hostu atļauja pirms lejupielādes.
 * Tīra loģika, bez tīkla. Avoti/lots nekonkurē par kopīgu 20-slotu baseinu.
 */

import type { VinScanAuction, VinScanIndicator } from "@/lib/vin-scan/types";
import {
  AUCTION_PHOTO_BLOCK_MAX,
  AUCTION_PHOTO_PER_LOT_MAX,
  uniqueBestAuctionPhotoUrls,
} from "@/lib/vin-scan/auction-photo-urls";

/** Vienas izsoles / avota grupas griesti (ne kopīgs baseins starp avotiem). */
export const ORDER_VIN_SCAN_PHOTO_IMPORT_MAX = AUCTION_PHOTO_PER_LOT_MAX;

const HOST_OK =
  /(^|\.)(copart\.com|copart\.fi|iaai\.com|stat\.vin|bidfax\.(info|net)|poctra\.com|autoastat\.com|bid\.cars|cloudfront\.net|import-motor\.com)$/i;

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|\[::1\])|^(172\.(1[6-9]|2\d|3[01])\.)/i;

export function isAllowedVinScanAuctionPhotoUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (!host || PRIVATE_HOST.test(host)) return false;
    return HOST_OK.test(host);
  } catch {
    return false;
  }
}

export type VinScanAuctionPhotoGroupPlan = {
  key: string;
  title: string;
  sourceId: string;
  urls: string[];
};

function allowedUnique(urls: readonly (string | undefined)[], max = ORDER_VIN_SCAN_PHOTO_IMPORT_MAX): string[] {
  const best = uniqueBestAuctionPhotoUrls(
    urls.filter((u): u is string => Boolean(u && u.trim())),
    max,
  );
  return best.filter(isAllowedVinScanAuctionPhotoUrl);
}

function lotFromAuction(auction: VinScanAuction): string {
  const explicit = String(auction.lot || "").trim();
  if (explicit) return explicit;
  const fromTitle = /lots\s+(\S+)/i.exec(auction.title || "");
  return fromTitle?.[1] ?? "";
}

export function vinScanAuctionPhotoGroupTitleForAuction(
  sourceId: string,
  auction: Pick<VinScanAuction, "venue" | "date" | "title" | "lot">,
): string {
  const prefix = sourceId === "joj_copart_iaai" ? "JoJ" : "VIN SCAN";
  const venue = auction.venue?.trim() || "";
  const lot = lotFromAuction(auction as VinScanAuction);
  const year = /^(\d{4})/.exec(auction.date || "")?.[1] || "";
  return [prefix, venue, lot ? `lots ${lot}` : "", year].filter(Boolean).join(" · ").slice(0, 80);
}

export function vinScanAuctionPhotoGroupTitle(indicators: readonly VinScanIndicator[]): string {
  const joj = indicators.find((row) => row.id === "joj_copart_iaai" && row.status === "found");
  const stat = indicators.find((row) => row.id === "stat_vin" && row.status === "found");
  const src = joj || stat || indicators.find((row) => (row.auctions ?? []).length);
  const auction = src?.auctions?.[0];
  if (src && auction) return vinScanAuctionPhotoGroupTitleForAuction(src.id, auction);
  const venue = auction?.venue?.trim() || "";
  const year = /^(\d{4})/.exec(auction?.date || "")?.[1] || "";
  return ["VIN SCAN", venue, year].filter(Boolean).join(" · ").slice(0, 80);
}

export function collectVinScanAuctionPhotoGroups(
  indicators: readonly VinScanIndicator[],
): VinScanAuctionPhotoGroupPlan[] {
  const plans: VinScanAuctionPhotoGroupPlan[] = [];
  const rank = (id: string) => (id === "joj_copart_iaai" ? 0 : id === "stat_vin" ? 1 : 2);
  const rows = [...indicators].sort((a, b) => rank(a.id) - rank(b.id));

  for (const row of rows) {
    if (row.status !== "found") continue;
    const assigned = new Set<string>();
    for (const auction of row.auctions ?? []) {
      const urls = allowedUnique([...(auction.photoUrls ?? []), auction.photoUrl], ORDER_VIN_SCAN_PHOTO_IMPORT_MAX);
      if (urls.length === 0) continue;
      for (const url of urls) assigned.add(url);
      const title = vinScanAuctionPhotoGroupTitleForAuction(row.id, auction);
      const lot = lotFromAuction(auction);
      const key = [row.id, auction.venue || "", lot, auction.date || "", title].join("|");
      plans.push({ key, title, sourceId: row.id, urls });
    }
    const leftover = allowedUnique(
      [row.media?.photoUrl, ...(row.media?.photoUrls ?? [])],
      ORDER_VIN_SCAN_PHOTO_IMPORT_MAX,
    ).filter((url) => !assigned.has(url));
    if (leftover.length === 0) continue;
    const title = vinScanAuctionPhotoGroupTitle([row]);
    plans.push({
      key: `${row.id}|media|${title}`,
      title,
      sourceId: row.id,
      urls: leftover,
    });
  }

  let total = 0;
  const capped: VinScanAuctionPhotoGroupPlan[] = [];
  for (const plan of plans) {
    const remaining = AUCTION_PHOTO_BLOCK_MAX - total;
    if (remaining <= 0) break;
    const urls = plan.urls.slice(0, remaining);
    total += urls.length;
    capped.push({ ...plan, urls });
  }
  return capped;
}

export function collectVinScanAuctionPhotoUrls(indicators: readonly VinScanIndicator[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const plan of collectVinScanAuctionPhotoGroups(indicators)) {
    for (const url of plan.urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= AUCTION_PHOTO_BLOCK_MAX) return urls;
    }
  }
  return urls;
}

export function ccVinHasVinScanPhotoGroup(
  groups: readonly { title?: string; photos?: readonly unknown[] }[] | null | undefined,
): boolean {
  return (groups ?? []).some((g) => /^(VIN SCAN|JoJ)\b/i.test(String(g.title || "")) && (g.photos?.length ?? 0) > 0);
}
