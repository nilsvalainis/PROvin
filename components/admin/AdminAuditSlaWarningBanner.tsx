"use client";

import { formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";
import { useAdminAuditDeadlineTick } from "@/components/admin/AdminAuditDeadlineTickProvider";

export function AdminAuditSlaOrderBanner({
  createdUnixSec,
  hidden = false,
  inactiveLabel,
}: {
  createdUnixSec: number;
  hidden?: boolean;
  /** 20.11 audits: atmaksāts / zaudēts strīds - termiņa vietā šis statuss (kā sarakstā). */
  inactiveLabel?: string;
}) {
  const tick = useAdminAuditDeadlineTick();
  void tick;
  if (inactiveLabel) {
    return (
      <p className="mb-3 rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-[12px] font-semibold leading-snug text-slate-700" role="status" data-testid="order-deadline-inactive">
        {inactiveLabel}
      </p>
    );
  }
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
