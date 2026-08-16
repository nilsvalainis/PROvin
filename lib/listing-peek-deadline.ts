import type { AuditDeadlineStatus } from "@/lib/admin-audit-deadline";

/** Ātrais vērtējums — atbildes SLA 24 h no iesūtīšanas. */
export const LISTING_PEEK_REPLY_DEADLINE_MS = 24 * 60 * 60 * 1000;
/** Pēdējās 6 h — dzeltens brīdinājums (kā pasūtījumu 48 h taimerī). */
export const LISTING_PEEK_REPLY_URGENT_MS = 6 * 60 * 60 * 1000;

export function listingPeekCreatedMs(createdAt: string): number | null {
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) ? ms : null;
}

export function formatListingPeekSubmittedAt(createdAt: string): string {
  const ms = listingPeekCreatedMs(createdAt);
  if (ms == null) return createdAt;
  return new Date(ms).toLocaleString("lv-LV", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatListingPeekDeadlineRemaining(
  createdAt: string,
  nowMs = Date.now(),
): { label: string; status: AuditDeadlineStatus } | null {
  const createdMs = listingPeekCreatedMs(createdAt);
  if (createdMs == null) return null;
  const remainingMs = createdMs + LISTING_PEEK_REPLY_DEADLINE_MS - nowMs;
  if (remainingMs <= 0) {
    const overdueH = Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000));
    return {
      label: overdueH <= 1 ? "Termiņš beidzies" : `Kavējas ${overdueH} h`,
      status: "overdue",
    };
  }
  const totalMin = Math.floor(remainingMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return {
    label: h > 0 ? `${h} h ${m} min` : `${m} min`,
    status: remainingMs <= LISTING_PEEK_REPLY_URGENT_MS ? "urgent" : "ok",
  };
}
