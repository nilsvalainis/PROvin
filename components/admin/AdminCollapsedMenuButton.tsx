"use client";

import { useAdminShellLayout } from "@/components/admin/AdminShell";

/** Rāda „Izvēlne”, kad sānjosla ir sakļauta (viena rinda ar pārējo galveni). */
export function AdminCollapsedMenuButton({ className = "" }: { className?: string }) {
  const shell = useAdminShellLayout();
  if (!shell?.sidebarCollapsed) return null;
  return (
    <button
      type="button"
      onClick={shell.expandSidebar}
      className={`hidden shrink-0 items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 md:inline-flex ${className}`}
      aria-label="Rādīt galveno izvēlni"
      title="Rādīt izvēlni"
    >
      <span className="text-sm leading-none" aria-hidden>
        ☰
      </span>
      <span>Izvēlne</span>
    </button>
  );
}
