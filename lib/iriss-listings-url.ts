import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

/** Tas pats meklējums neatkarīgi no parametru secības un beigu slīpsvītras. Bez node:crypto, der arī klientam. */
export function normalizeListingUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    const pairs = [...u.searchParams.entries()].sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    u.search = "";
    for (const [k, v] of pairs) u.searchParams.append(k, v);
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Meklēšanas piederība: platforma + normalizēts URL, nevis platforma + pasūtījums. */
export function listingSearchKey(platform: IrissListingPlatform, sourceUrl: string): string {
  return `${platform}|${normalizeListingUrl(sourceUrl)}`;
}

/** Pēdējais nolasījums konkrētai pasūtījuma saitei (URL normalizēts). Bez node:crypto. */
export function listingLinkRunForUrl<T extends { orderId: string; platform: IrissListingPlatform; sourceUrl: string }>(
  runs: readonly T[],
  orderId: string,
  sourceUrl: string,
): T | null {
  const want = sourceUrl.trim();
  if (!want) return null;
  for (const run of runs) {
    if (run.orderId !== orderId) continue;
    if (listingSearchKey(run.platform, run.sourceUrl) === listingSearchKey(run.platform, want)) return run;
  }
  return null;
}
