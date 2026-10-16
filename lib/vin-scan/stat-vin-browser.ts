/**
 * stat.vin vairs neatbild servera un datucentru IP (HTTP 403, Code 007).
 * Josla paliek „from browser”: HTML atnes Tampermonkey no operatora pārlūka.
 */

export const STAT_VIN_FROM_BROWSER_SUMMARY = "stat.vin: no pārlūka (from browser)";

export function statVinBrowserLane(): { status: "browser_only"; summary: string } {
  return { status: "browser_only", summary: STAT_VIN_FROM_BROWSER_SUMMARY };
}

export function statVinAwaitingBrowserFetch(
  row: { id?: string; status?: string; summary?: string } | null | undefined,
): boolean {
  if (!row || row.id !== "stat_vin") return false;
  if (row.status === "found" || row.status === "none") return false;
  return row.status === "browser_only" && /from browser/i.test(row.summary || "");
}

export function statVinBrowserFetchToken(vin: string, at: string): string {
  const v = vin.trim().toUpperCase();
  const stamp = at.trim();
  if (!v || !stamp) return "";
  return `${v}:${stamp}`;
}
