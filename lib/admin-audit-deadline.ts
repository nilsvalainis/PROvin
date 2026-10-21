/** PROVIN audita sagatavošanas SLA: 48 h no pasūtījuma laika (Stripe `created`). */

export const AUDIT_PREPARATION_DEADLINE_MS = 48 * 60 * 60 * 1000;
/** Pill + proaktīvais brīdinājums: atlikušas ≤ 3 h. */
export const AUDIT_PREPARATION_URGENT_MS = 3 * 60 * 60 * 1000;

export type AuditDeadlineStatus = "ok" | "urgent" | "overdue";

export function auditDeadlineMs(createdUnixSec: number): number {
  return createdUnixSec * 1000 + AUDIT_PREPARATION_DEADLINE_MS;
}

export function auditDeadlineUnix(createdUnixSec: number): number {
  return Math.floor(auditDeadlineMs(createdUnixSec) / 1000);
}

/** Viens brīdinājums uz konkrētu termiņu. Ja piepirkums pārbīda termiņu, sūta vēlreiz. */
export function shouldSendAuditSlaWarning(
  alreadyWarnedDeadlineUnix: number | null | undefined,
  deadlineUnix: number,
): boolean {
  return alreadyWarnedDeadlineUnix !== deadlineUnix;
}

export function formatAuditDeadlineRemaining(
  createdUnixSec: number,
  nowMs = Date.now(),
): { label: string; status: AuditDeadlineStatus } {
  const remainingMs = auditDeadlineMs(createdUnixSec) - nowMs;
  if (remainingMs <= 0) {
    const overdueH = Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000));
    return {
      label:
        overdueH <= 1
          ? "Termiņš beidzies"
          : overdueH >= 48
            ? `Kavējas ${Math.floor(overdueH / 24)} d`
            : `Kavējas ${overdueH} h`,
      status: "overdue",
    };
  }
  const totalMin = Math.floor(remainingMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const label = h > 0 ? `${h} h ${m} min` : `${m} min`;
  return {
    label,
    status: remainingMs <= AUDIT_PREPARATION_URGENT_MS ? "urgent" : "ok",
  };
}

export function collectAuditSlaWarningCandidates<
  T extends {
    id: string;
    created: number;
    deadlineFromUnix?: number | null;
    auditComplete?: boolean;
    isB2bPack?: boolean;
  },
>(rows: T[], nowMs: number): T[] {
  const out: T[] = [];
  for (const r of rows) {
    if (r.auditComplete || r.isB2bPack) continue;
    const { status } = formatAuditDeadlineRemaining(r.deadlineFromUnix ?? r.created, nowMs);
    if (status === "urgent") out.push(r);
  }
  return out;
}
