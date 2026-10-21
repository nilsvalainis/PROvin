"use client";

import { formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";
import { useAdminAuditDeadlineTick } from "@/components/admin/AdminAuditDeadlineTickProvider";

export function AdminAuditSlaOrderBanner({
  createdUnixSec,
  hidden = false,
}: {
  createdUnixSec: number;
  hidden?: boolean;
}) {
  const tick = useAdminAuditDeadlineTick();
  void tick;
  if (hidden || !Number.isFinite(createdUnixSec) || createdUnixSec <= 0) return null;
  const { label, status } = formatAuditDeadlineRemaining(createdUnixSec);
  if (status !== "urgent" && status !== "overdue") return null;
  const overdue = status === "overdue";
  return (
    <p
      className={`mb-3 rounded-lg border px-3 py-2 text-[12px] font-semibold leading-snug ${
        overdue
          ? "border-red-200/90 bg-red-50 text-red-950"
          : "border-amber-200/90 bg-amber-50 text-amber-950"
      }`}
      role="status"
    >
      {overdue
        ? label === "Termiņš beidzies"
          ? "48 h termiņš beidzies."
          : `48 h termiņš: ${label.charAt(0).toLowerCase()}${label.slice(1)}.`
        : `48 h termiņš: atlikušas ${label}.`}
    </p>
  );
}

export function AdminAuditSlaListBanner({
  urgentCount,
  overdueCount,
}: {
  urgentCount: number;
  overdueCount: number;
}) {
  if (urgentCount <= 0 && overdueCount <= 0) return null;
  const parts: string[] = [];
  if (urgentCount > 0) parts.push(`${urgentCount} ar ≤ 3 h`);
  if (overdueCount > 0) parts.push(`${overdueCount} kavējas`);
  return (
    <p
      className="mb-2 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-950"
      role="status"
    >
      48 h SLA: {parts.join(". ")}.
    </p>
  );
}
