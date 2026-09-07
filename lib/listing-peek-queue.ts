/**
 * Free listing-peek backlog gate: when open (pending) peeks hit the limit,
 * the public form pauses. Paid checkout is unaffected.
 */

export const LISTING_PEEK_QUEUE_LIMIT_DEFAULT = 10;

export type ListingPeekQueueStatus = "new" | "in_progress" | "completed" | "rejected";

/** Same pending split as `/admin/atras-vertesanas` („Gaida atbildi”). */
export function isOpenListingPeekWork(entry: {
  status: ListingPeekQueueStatus | string;
}): boolean {
  return entry.status === "new" || entry.status === "in_progress";
}

export function countOpenListingPeeks(
  entries: ReadonlyArray<{ status: ListingPeekQueueStatus | string }>,
): number {
  let n = 0;
  for (const entry of entries) {
    if (isOpenListingPeekWork(entry)) n += 1;
  }
  return n;
}

/** `LISTING_PEEK_QUEUE_LIMIT` env; default 10. Invalid / missing → default. */
export function getListingPeekQueueLimit(
  envValue: string | undefined = process.env.LISTING_PEEK_QUEUE_LIMIT,
): number {
  const raw = typeof envValue === "string" ? envValue.trim() : "";
  if (!raw) return LISTING_PEEK_QUEUE_LIMIT_DEFAULT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return LISTING_PEEK_QUEUE_LIMIT_DEFAULT;
  return Math.min(n, 500);
}

export function isListingPeekQueuePaused(
  openCount: number,
  limit: number = getListingPeekQueueLimit(),
): boolean {
  return openCount >= limit;
}
