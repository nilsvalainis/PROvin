"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAuditDeadlineRemaining, type AuditDeadlineStatus } from "@/lib/admin-audit-deadline";
import { useAdminAuditDeadlineTick } from "@/components/admin/AdminAuditDeadlineTickProvider";

const PILL_BASE =
  "inline-flex cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35 disabled:cursor-wait disabled:opacity-70";

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
  initialComplete = false,
}: {
  sessionId: string;
  createdUnixSec: number;
  /** Servera stāvoklis pēc lapas ielādes. */
  initialComplete?: boolean;
}) {
  const tick = useAdminAuditDeadlineTick();
  const [isComplete, setIsComplete] = useState(initialComplete);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsComplete(initialComplete);
  }, [initialComplete, sessionId]);

  void tick;
  const { label, status } = formatAuditDeadlineRemaining(createdUnixSec);

  const onToggle = useCallback(async () => {
    if (saving) return;
    const next = !isComplete;
    setIsComplete(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/audit-deadline-complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, complete: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setIsComplete(!next);
        window.alert(
          (typeof data.message === "string" && data.message) ||
            (typeof data.error === "string" && data.error) ||
            "Neizdevās saglabāt „Izpildīts”.",
        );
        return;
      }
    } catch {
      setIsComplete(!next);
      window.alert("Tīkla kļūda — „Izpildīts” netika saglabāts.");
    } finally {
      setSaving(false);
    }
  }, [isComplete, saving, sessionId]);

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      disabled={saving}
      className={`${PILL_BASE} tabular-nums ${isComplete ? PILL_COMPLETED : PILL_BY_STATUS[status]}`}
      aria-pressed={isComplete}
      title={isComplete ? "Izpildīts — klikšķis atceļ" : "Atzīmēt auditu kā izpildītu"}
    >
      {isComplete ? "Izpildīts" : label}
    </button>
  );
}
