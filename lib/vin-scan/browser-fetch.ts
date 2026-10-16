/**
 * Avoti, kuru servera un datucentru IP saņem Cloudflare / HTTP 403.
 * Josla paliek „from browser”: HTML atnes Tampermonkey no operatora pārlūka (kā stat.vin).
 */

import type { VinScanSourceId } from "@/lib/vin-scan/catalog";

export const VIN_SCAN_BROWSER_FETCH_IDS = [
  "stat_vin",
  "bid_cars",
  "bidfax",
  "checkcar_vin",
  "plc_auction",
  "carfax_eu",
  "poctra",
  "lt_itpr",
  "biluppgifter",
  "nicb",
] as const satisfies readonly VinScanSourceId[];

export type VinScanBrowserFetchId = (typeof VIN_SCAN_BROWSER_FETCH_IDS)[number];

const LABEL: Record<VinScanBrowserFetchId, string> = {
  stat_vin: "stat.vin",
  bid_cars: "bid.cars",
  bidfax: "BidFax",
  checkcar_vin: "checkcar.vin",
  plc_auction: "plc.auction",
  carfax_eu: "CARFAX.eu",
  poctra: "Poctra",
  lt_itpr: "epolicija.lt",
  biluppgifter: "biluppgifter.se",
  nicb: "NICB",
};

export function isVinScanBrowserFetchId(id: string): id is VinScanBrowserFetchId {
  return (VIN_SCAN_BROWSER_FETCH_IDS as readonly string[]).includes(id);
}

export function browserFetchSummary(id: VinScanBrowserFetchId): string {
  return `${LABEL[id]}: no pārlūka (from browser)`;
}

export function browserFetchLane(id: VinScanBrowserFetchId): { status: "browser_only"; summary: string } {
  return { status: "browser_only", summary: browserFetchSummary(id) };
}

export function browserFetchAwaiting(
  row: { id?: string; status?: string; summary?: string } | null | undefined,
): boolean {
  if (!row?.id || !isVinScanBrowserFetchId(row.id)) return false;
  if (row.status === "found" || row.status === "none") return false;
  return row.status === "browser_only" && /from browser/i.test(row.summary || "");
}

export function browserFetchToken(vin: string, at: string): string {
  const v = vin.trim().toUpperCase();
  const stamp = at.trim();
  if (!v || !stamp) return "";
  return `${v}:${stamp}`;
}
