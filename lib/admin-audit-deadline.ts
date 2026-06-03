/** PROVIN audita sagatavošanas SLA — 48 h no pasūtījuma laika (Stripe `created`). */

export const AUDIT_PREPARATION_DEADLINE_MS = 48 * 60 * 60 * 1000;

export type AuditDeadlineStatus = "ok" | "urgent" | "overdue";

export function auditDeadlineMs(createdUnixSec: number): number {
  return createdUnixSec * 1000 + AUDIT_PREPARATION_DEADLINE_MS;
}

export function formatAuditDeadlineRemaining(
  createdUnixSec: number,
  nowMs = Date.now(),
): { label: string; status: AuditDeadlineStatus } {
  const remainingMs = auditDeadlineMs(createdUnixSec) - nowMs;
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
  const label = h > 0 ? `${h} h ${m} min` : `${m} min`;
  return {
    label,
    status: remainingMs <= 6 * 60 * 60 * 1000 ? "urgent" : "ok",
  };
}
