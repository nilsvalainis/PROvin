"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminSidebarNav } from "./AdminSidebarNav";

const SIDEBAR_COLLAPSED_KEY = "provin-admin-sidebar-collapsed";

type Props = { children: ReactNode; baseUrl?: string; notice?: ReactNode };

export function AdminShell({ children, baseUrl, notice }: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed, storageReady]);

  const expandSidebar = useCallback(() => setSidebarCollapsed(false), []);
  const collapseSidebar = useCallback(() => setSidebarCollapsed(true), []);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)] md:flex-row">
      <aside
        className={
          sidebarCollapsed
            ? "hidden shrink-0 md:hidden"
            : "shrink-0 border-b border-slate-200/70 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm md:w-56 md:border-b-0 md:border-r md:border-slate-200/70 md:shadow-none"
        }
        aria-hidden={sidebarCollapsed}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4 md:flex-col md:items-stretch">
          <div className="flex w-full min-w-0 items-start justify-between gap-2 md:flex-col md:items-stretch">
            <div className="min-w-0">
              <Link
                href="/admin"
                className="text-[15px] font-semibold tracking-tight text-[var(--color-provin-accent)]"
              >
                PROVIN
              </Link>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
                Administrēšana
              </p>
            </div>
            <button
              type="button"
              onClick={collapseSidebar}
              className="shrink-0 rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-xs font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Paslēpt galveno izvēlni"
              title="Paslēpt izvēlni"
            >
              <span aria-hidden className="tabular-nums">
                «
              </span>
            </button>
          </div>
          <AdminSidebarNav baseUrl={baseUrl} />
        </div>
      </aside>
      <main className="min-w-0 w-full max-w-none flex-1 space-y-5 p-3 sm:p-4 md:p-5 lg:p-6">
        {sidebarCollapsed ? (
          <div className="-mt-1 flex justify-start">
            <button
              type="button"
              onClick={expandSidebar}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Rādīt galveno izvēlni"
              title="Rādīt izvēlni"
            >
              <span className="text-base leading-none" aria-hidden>
                ☰
              </span>
              <span>Izvēlne</span>
            </button>
          </div>
        ) : null}
        {notice}
        <div className="w-full min-w-0 max-w-none">{children}</div>
      </main>
    </div>
  );
}
