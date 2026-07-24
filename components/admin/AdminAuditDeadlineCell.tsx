"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAuditDeadlineRemaining, type AuditDeadlineStatus } from "@/lib/admin-audit-deadline";
import { useAdminAuditDeadlineTick } from "@/components/admin/AdminAuditDeadlineTickProvider";
import {
  ADMIN_AUDIT_COMPLETE_STORAGE_KEY,
  readAuditCompleteIdsFromStorage,
  setAuditCompleteInLocalCache,
} from "@/lib/admin-audit-deadline-complete";

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
  /** Servera persistents stāvoklis no dashboard indeksa. */
  initialComplete?: boolean;
}) {
  const tick = useAdminAuditDeadlineTick();
  const [isComplete, setIsComplete] = useState(initialComplete);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsComplete(initialComplete);
  }, [initialComplete, sessionId]);

  /** Vienreizēja migrācija: vecā localStorage atzīme → serveris. */
  useEffect(() => {
    if (initialComplete) return;
    const localIds = readAuditCompleteIdsFromStorage((k) => localStorage.getItem(k));
    if (!localIds.has(sessionId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/audit-deadline-complete", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, complete: true }),
        });
        if (!cancelled && res.ok) {
          setIsComplete(true);
          setAuditCompleteInLocalCache(
            sessionId,
            true,
            (k) => localStorage.getItem(k),
            (k, v) => localStorage.setItem(k, v),
          );
        }
      } catch {
        /* ignore — lietotājs var noklikšķināt manuāli */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialComplete, sessionId]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ADMIN_AUDIT_COMPLETE_STORAGE_KEY) return;
      const ids = readAuditCompleteIdsFromStorage((k) => localStorage.getItem(k));
      setIsComplete(ids.has(sessionId) || initialComplete);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sessionId, initialComplete]);

  void tick;
  const { label, status } = formatAuditDeadlineRemaining(createdUnixSec);

  const onToggle = useCallback(async () => {
    if (saving) return;
    const next = !isComplete;
    setIsComplete(next);
    setSaving(true);
    setAuditCompleteInLocalCache(
      sessionId,
      next,
      (k) => localStorage.getItem(k),
      (k, v) => localStorage.setItem(k, v),
    );
    try {
      const res = await fetch("/api/admin/audit-deadline-complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, complete: next }),
      });
      if (!res.ok) {
        setIsComplete(!next);
        setAuditCompleteInLocalCache(
          sessionId,
          !next,
          (k) => localStorage.getItem(k),
          (k, v) => localStorage.setItem(k, v),
        );
        console.error("[admin] audit-deadline-complete", res.status, await res.text().catch(() => ""));
      }
    } catch (e) {
      setIsComplete(!next);
      setAuditCompleteInLocalCache(
        sessionId,
        !next,
        (k) => localStorage.getItem(k),
        (k, v) => localStorage.setItem(k, v),
      );
      console.error("[admin] audit-deadline-complete fetch", e);
    } finally {
      setSaving(false);
    }
  }, [isComplete, saving, sessionId]);

  const displayLabel = isComplete ? "Izpildīts" : label;
  const pillClass = isComplete ? PILL_COMPLETED : PILL_BY_STATUS[status];

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      disabled={saving}
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
