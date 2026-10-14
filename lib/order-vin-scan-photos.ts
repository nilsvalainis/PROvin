/**
 * VIN SCAN izsoļu foto URL: atlase un hostu atļauja pirms lejupielādes.
 * Tīra loģika, bez tīkla.
 */

import type { VinScanIndicator } from "@/lib/vin-scan/types";

export const ORDER_VIN_SCAN_PHOTO_IMPORT_MAX = 20;

const HOST_OK =
  /(^|\.)(copart\.com|iaai\.com|stat\.vin|bidfax\.(info|net)|poctra\.com|autoastat\.com|bid\.cars|cloudfront\.net)$/i;

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

export function collectVinScanAuctionPhotoUrls(indicators: readonly VinScanIndicator[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string) => {
    const url = String(raw || "").trim();
    if (!url || seen.has(url) || !isAllowedVinScanAuctionPhotoUrl(url)) return;
    seen.add(url);
    urls.push(url);
  };
  const rows = [...indicators].sort((a, b) => {
    if (a.id === "stat_vin" && b.id !== "stat_vin") return -1;
    if (b.id === "stat_vin" && a.id !== "stat_vin") return 1;
    return 0;
  });
  for (const row of rows) {
    if (row.status !== "found") continue;
    push(row.media?.photoUrl);
    for (const extra of row.media?.photoUrls ?? []) push(extra);
    for (const auction of row.auctions ?? []) push(auction.photoUrl);
    if (urls.length >= ORDER_VIN_SCAN_PHOTO_IMPORT_MAX) break;
  }
  return urls.slice(0, ORDER_VIN_SCAN_PHOTO_IMPORT_MAX);
}

export function vinScanAuctionPhotoGroupTitle(indicators: readonly VinScanIndicator[]): string {
  const stat = indicators.find((row) => row.id === "stat_vin" && row.status === "found");
  const auction = stat?.auctions?.[0] || indicators.find((row) => (row.auctions ?? []).length)?.auctions?.[0];
  const venue = auction?.venue?.trim() || "";
  const year = /^(\d{4})/.exec(auction?.date || "")?.[1] || "";
  const bits = ["VIN SCAN", venue, year].filter(Boolean);
  return bits.join(" · ").slice(0, 80);
}

export function ccVinHasVinScanPhotoGroup(groups: readonly { title?: string; photos?: readonly unknown[] }[] | null | undefined): boolean {
  return (groups ?? []).some((g) => /^VIN SCAN/i.test(String(g.title || "")) && (g.photos?.length ?? 0) > 0);
}
