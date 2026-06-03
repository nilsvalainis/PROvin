"use client";

import { useEffect, useState } from "react";
import { formatAuditDeadlineRemaining, type AuditDeadlineStatus } from "@/lib/admin-audit-deadline";

const STATUS_CLASS: Record<AuditDeadlineStatus, string> = {
  ok: "text-emerald-800",
  urgent: "text-amber-800 font-semibold",
  overdue: "text-red-700 font-semibold",
};

export function AdminAuditDeadlineCell({ createdUnixSec }: { createdUnixSec: number }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  void tick;
  const { label, status } = formatAuditDeadlineRemaining(createdUnixSec);

  return (
    <span className={`text-[11px] tabular-nums ${STATUS_CLASS[status]}`} title="Atlikušais laiks līdz 48 h audita termiņam">
      {label}
    </span>
  );
}
