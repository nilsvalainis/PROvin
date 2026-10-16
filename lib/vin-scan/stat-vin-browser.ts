/**
 * stat.vin vairs neatbild servera un datucentru IP (HTTP 403, Code 007).
 * Josla paliek „from browser”: HTML atnes Tampermonkey no operatora pārlūka.
 */

import { browserFetchAwaiting, browserFetchLane, browserFetchSummary, browserFetchToken } from "@/lib/vin-scan/browser-fetch";

export const STAT_VIN_FROM_BROWSER_SUMMARY = browserFetchSummary("stat_vin");

export function statVinBrowserLane(): { status: "browser_only"; summary: string } {
  return browserFetchLane("stat_vin");
}

export function statVinAwaitingBrowserFetch(
  row: { id?: string; status?: string; summary?: string } | null | undefined,
): boolean {
  return Boolean(row?.id === "stat_vin" && browserFetchAwaiting(row));
}

export function statVinBrowserFetchToken(vin: string, at: string): string {
  return browserFetchToken(vin, at);
}
