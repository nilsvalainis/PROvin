"use client";

import { useEffect, useRef, useState } from "react";

import { countSourceIssues, type SourceIssue, type SourceIssueSeverity } from "@/lib/source-consistency";

const DOT: Record<SourceIssueSeverity, string> = {
  critical: "bg-[#d70015]",
  warn: "bg-[#c77700]",
  info: "bg-[rgba(118,118,128,0.45)]",
};

const BTN: Record<SourceIssueSeverity | "none", string> = {
  critical: "bg-[rgba(255,59,48,0.10)] text-[#d70015] hover:bg-[rgba(255,59,48,0.16)]",
  warn: "bg-[rgba(255,149,0,0.14)] text-[#a35f00] hover:bg-[rgba(255,149,0,0.22)]",
  info: "bg-[rgba(118,118,128,0.12)] text-[var(--color-apple-text)] hover:bg-[rgba(118,118,128,0.2)]",
  none: "bg-[rgba(118,118,128,0.12)] text-[var(--color-apple-text-secondary,#6e6e73)] hover:bg-[rgba(118,118,128,0.2)]",
};

function topSeverity(issues: readonly SourceIssue[]): SourceIssueSeverity | "none" {
  if (issues.some((i) => i.severity === "critical")) return "critical";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  return issues.length ? "info" : "none";
}

/** Saraksts: punkts + avoti ar vērtībām (kopīgs joslai un sūtīšanas dialogam). */
export function SourceIssueList({ issues, className = "" }: { issues: readonly SourceIssue[]; className?: string }) {
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {issues.map((i) => (
        <li key={i.id} className="flex gap-2 text-[12px] leading-snug">
          <span className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${DOT[i.severity]}`} aria-hidden />
          <span className={`min-w-0 ${i.severity === "info" ? "text-[var(--color-apple-text-secondary,#6e6e73)]" : ""}`}>
            <span className="font-semibold">{i.title}</span>
            <span className="block break-words">
              {i.values.map((v, n) => (
                <span key={`${v.source}-${n}`}>
                  {n > 0 ? " · " : ""}
                  {v.source}: <span className="font-medium">{v.value}</span>
                </span>
              ))}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sūtīšanas dialogos: kritiskās pretrunas (brīdinājums, sūtīšanu nebloķē). */
export function CriticalSourceIssuesAlert({ issues }: { issues: readonly SourceIssue[] | null | undefined }) {
  if (!issues?.length) return null;
  return (
    <div className="rounded-lg border border-[rgba(255,59,48,0.35)] bg-[rgba(255,59,48,0.07)] px-3 py-2.5" data-critical-source-issues role="alert">
      <p className="mb-1.5 text-[12px] font-semibold text-[#d70015]">Kritiskas pretrunas: {issues.length}</p>
      <SourceIssueList issues={issues} />
    </div>
  );
}

/** «Pretrunas: N» pie «Ģenerēt PDF»: klikšķis atver sarakstu (punkts, avoti, vērtības). */
export function AdminSourceConsistencyBar({ issues }: { issues: readonly SourceIssue[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const n = countSourceIssues(issues);
  const sev = topSeverity(issues);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative mr-auto" data-source-consistency>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={issues.length === 0}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-[12px] font-semibold transition disabled:cursor-default ${BTN[sev]}`}
      >
        {sev !== "none" ? <span className={`h-2 w-2 rounded-full ${DOT[sev === "info" ? "info" : sev]}`} aria-hidden /> : null}
        Pretrunas: {n}
      </button>
      {open && issues.length > 0 ? (
        <div className="absolute bottom-full left-0 z-50 mb-2 max-h-[60vh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated,#fff)] p-3 text-[var(--color-apple-text)] shadow-[0_8px_32px_rgba(15,23,42,0.18)]">
          <SourceIssueList issues={issues} />
        </div>
      ) : null}
    </div>
  );
}
