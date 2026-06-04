"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAuditDeadlineRemaining, type AuditDeadlineStatus } from "@/lib/admin-audit-deadline";
import {
  ADMIN_AUDIT_COMPLETE_STORAGE_KEY,
  readAuditCompleteIdsFromStorage,
  toggleAuditCompleteInSet,
  writeAuditCompleteIdsToStorage,
} from "@/lib/admin-audit-deadline-complete";

const PILL_BASE =
  "inline-flex cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35";

const PILL_BY_STATUS: Record<AuditDeadlineStatus, string> = {
  ok: "bg-white text-[var(--color-apple-text)] ring-slate-200/90 hover:bg-slate-50/95",
  urgent: "bg-amber-50 text-amber-900 ring-amber-200/90 hover:bg-amber-100/90",
  overdue: "bg-red-50 text-red-700 ring-red-200/85 hover:bg-red-100/90",
};

const PILL_COMPLETED =
  "bg-emerald-50 text-emerald-800 ring-emerald-200/80 hover:bg-emerald-100/90 cursor-pointer";

export function AdminAuditDeadlineCell({
  sessionId,
  createdUnixSec,
}: {
  sessionId: string;
  createdUnixSec: number;
}) {
  const [tick, setTick] = useState(0);
  const [completeIds, setCompleteIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCompleteIds(readAuditCompleteIdsFromStorage((k) => localStorage.getItem(k)));
    const onStorage = (e: StorageEvent) => {
      if (e.key === ADMIN_AUDIT_COMPLETE_STORAGE_KEY) {
        setCompleteIds(readAuditCompleteIdsFromStorage((k) => localStorage.getItem(k)));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  void tick;
  const { label, status } = formatAuditDeadlineRemaining(createdUnixSec);
  const isComplete = completeIds.has(sessionId);

  const onToggle = useCallback(() => {
    setCompleteIds((prev) => {
      const next = toggleAuditCompleteInSet(prev, sessionId);
      writeAuditCompleteIdsToStorage((k, v) => localStorage.setItem(k, v), next);
      return next;
    });
  }, [sessionId]);

  const displayLabel = isComplete ? "Izpildīts" : label;
  const pillClass = isComplete ? PILL_COMPLETED : PILL_BY_STATUS[status];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${PILL_BASE} tabular-nums ${pillClass}`}
      aria-pressed={isComplete}
      title={
        isComplete
          ? "Atzīmēts kā izpildīts — klikšķis atceļ"
          : "Klikšķini, lai atzīmētu audita sagatavošanu kā izpildītu (48 h)"
      }
    >
      {displayLabel}
    </button>
  );
}
