"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { IrissAdminSidebarNav } from "./IrissAdminSidebarNav";
import { AdminWorkspaceSwitcher } from "./AdminWorkspaceSwitcher";
import { LogoutButton } from "./LogoutButton";

const SIDEBAR_COLLAPSED_KEY = "provin-admin-sidebar-collapsed";

type AdminShellLayoutValue = {
  sidebarCollapsed: boolean;
  expandSidebar: () => void;
};

const AdminShellLayoutContext = createContext<AdminShellLayoutValue | null>(null);

export function useAdminShellLayout() {
  return useContext(AdminShellLayoutContext);
}

export type AdminShellWorkspace = "pro" | "iriss";

type Props = {
  children: ReactNode;
  baseUrl?: string;
  notice?: ReactNode;
  /** PRO — esošais admin; IRISS — atsevišķa zona (pagaidām tukša). */
  workspace?: AdminShellWorkspace;
};

export function AdminShell({ children, baseUrl, notice, workspace = "pro" }: Props) {
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

  const shellLayoutValue = useMemo(
    () => ({ sidebarCollapsed, expandSidebar }),
    [sidebarCollapsed, expandSidebar],
  );

  const isProWorkspace = workspace === "pro";

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)]">
      <header className="shrink-0 border-b border-slate-200/70 bg-white/90 px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm sm:px-4">
        <AdminWorkspaceSwitcher />
      </header>
      <div className={`flex min-h-0 flex-1 flex-col md:flex-row ${!isProWorkspace ? "iriss-admin-scope" : ""}`}>
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
              {isProWorkspace ? (
                <>
                  <Link
                    href="/admin"
                    className="block text-[15px] font-semibold leading-snug tracking-tight text-[var(--color-provin-accent)]"
                  >
                    PROVIN
                  </Link>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
                    Administrēšana
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-semibold tracking-tight text-[var(--color-apple-text)]">IRISS</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
                    Administrēšana
                  </p>
                </>
              )}
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
          {isProWorkspace ? <AdminSidebarNav baseUrl={baseUrl} /> : <IrissAdminSidebarNav />}
          <div className="md:pt-1">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <AdminShellLayoutContext.Provider value={shellLayoutValue}>
        <main className="min-w-0 w-full max-w-none flex-1 space-y-3 p-2 sm:px-3 sm:pb-4 md:px-4 md:pb-5 lg:px-5 lg:pb-6 pt-1.5 sm:pt-2">
          {notice}
          <div className="w-full min-w-0 max-w-none">{children}</div>
        </main>
      </AdminShellLayoutContext.Provider>
      </div>
    </div>
  );
}
