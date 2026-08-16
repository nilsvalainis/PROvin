"use client";

import type { ReactNode } from "react";
import { useAdminAuditDeadlineTick } from "@/components/admin/AdminAuditDeadlineTickProvider";
import type { AuditDeadlineStatus } from "@/lib/admin-audit-deadline";
import {
  formatListingPeekDeadlineRemaining,
  formatListingPeekSubmittedAt,
} from "@/lib/listing-peek-deadline";

const PILL_BASE =
  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 tabular-nums";

const PILL_BY_STATUS: Record<AuditDeadlineStatus, string> = {
  ok: "bg-white text-[var(--color-apple-text)] ring-slate-200/90",
  urgent: "bg-amber-50 text-amber-900 ring-amber-200/90",
  overdue: "bg-red-50 text-red-700 ring-red-200/85",
};

export function listingPeekSlaCardClass(
  createdAt: string,
  done: boolean,
  rejected: boolean,
  nowMs = Date.now(),
): string {
  if (done) return "border-emerald-200/90 bg-emerald-50/40";
  if (rejected) return "border-slate-200/90 bg-slate-50/80 opacity-80";
  const sla = formatListingPeekDeadlineRemaining(createdAt, nowMs);
  if (sla?.status === "overdue") return "border-red-200/90 bg-red-50/35";
  if (sla?.status === "urgent") return "border-amber-200/90 bg-amber-50/40";
  return "border-slate-200/90";
}

export function AdminListingPeekCardShell({
  createdAt,
  complete = false,
  rejected = false,
  children,
}: {
  createdAt: string;
  complete?: boolean;
  rejected?: boolean;
  children: ReactNode;
}) {
  const tick = useAdminAuditDeadlineTick();
  void tick;
  return (
    <li
      className={`rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${listingPeekSlaCardClass(
        createdAt,
        complete,
        rejected,
      )}`}
    >
      {children}
    </li>
  );
}

export function AdminListingPeekSla({
  createdAt,
  complete = false,
  rejected = false,
}: {
  createdAt: string;
  complete?: boolean;
  rejected?: boolean;
}) {
  const tick = useAdminAuditDeadlineTick();
  void tick;
  const submitted = formatListingPeekSubmittedAt(createdAt);
  const sla = formatListingPeekDeadlineRemaining(createdAt);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[12px] text-[var(--color-provin-muted)]">
        <span className="font-semibold uppercase tracking-[0.06em]">Iesūtīts</span>{" "}
        <time dateTime={createdAt}>{submitted}</time>
      </p>
      {complete ? (
        <span className={`${PILL_BASE} bg-emerald-50 text-emerald-800 ring-emerald-200/80`}>
          Atbildēts
        </span>
      ) : rejected ? (
        <span className={`${PILL_BASE} bg-slate-200 text-slate-600 ring-slate-300/80`}>
          Noraidīts
        </span>
      ) : sla ? (
        <span
          className={`${PILL_BASE} ${PILL_BY_STATUS[sla.status]}`}
          title="Atbildes termiņš — 24 h no iesūtīšanas"
        >
          {sla.label}
        </span>
      ) : null}
    </div>
  );
}
