"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AdminNavInteractionProvider } from "@/components/admin/AdminNavInteractionContext";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { IrissAdminSidebarNav } from "./IrissAdminSidebarNav";
import { AdminWorkspaceSwitcher } from "./AdminWorkspaceSwitcher";
import { LogoutButton } from "./LogoutButton";

const SIDEBAR_COLLAPSED_KEY = "provin-admin-sidebar-collapsed";

/** Mobilajā admin augšējā joslā — tās pašas 3 strīpiņas kā publiskajā HeaderClient. */
function AdminMobileMenuIcon({ lineClass }: { lineClass: string }) {
  return (
    <span className="flex flex-col items-center justify-center gap-[5px]" aria-hidden>
      <span className={`h-px w-[22px] ${lineClass}`} />
      <span className={`h-px w-[22px] ${lineClass}`} />
      <span className={`h-px w-[22px] ${lineClass}`} />
    </span>
  );
}

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

type NavPanelProps = {
  isProWorkspace: boolean;
  baseUrl?: string;
  onClose: () => void;
};

function AdminShellNavPanel({ isProWorkspace, baseUrl, onClose }: NavPanelProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 md:flex-col md:items-stretch">
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
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-xs font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          aria-label="Aizvērt galveno izvēlni"
          title="Aizvērt izvēlni"
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
  );
}

export function AdminShell({ children, baseUrl, notice, workspace = "pro" }: Props) {
  const pathname = usePathname() ?? "";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const expandSidebar = useCallback(() => setSidebarCollapsed(false), []);
  const collapseSidebar = useCallback(() => setSidebarCollapsed(true), []);

  const onAsideCloseClick = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileNavOpen(false);
    } else {
      collapseSidebar();
    }
  }, [collapseSidebar]);

  const shellLayoutValue = useMemo(
    () => ({ sidebarCollapsed, expandSidebar }),
    [sidebarCollapsed, expandSidebar],
  );

  const isProWorkspace = workspace === "pro";
  /** Kamēr IRISS ir tikai „Pasūtījumi”, mobilajā paslēdzam PRO/IRISS joslu — navigācija caur izvēlni + saite uz PRO. */
  const hideWorkspaceSwitcherOnMobile = !isProWorkspace;

  const asideDesktopOpen =
    "md:relative md:z-auto md:flex md:h-auto md:w-56 md:flex-col md:border-r md:border-b-0 md:border-slate-200/70 md:bg-white/95 md:shadow-none md:overflow-y-auto";

  return (
    <AdminNavInteractionProvider>
      <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)]">
        <div className="sticky top-0 z-[60] flex shrink-0 flex-col border-b border-slate-200/70 bg-white/90 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm">
          <header
            className={`flex shrink-0 flex-row items-center justify-between gap-2 px-3 py-2 sm:px-4 ${hideWorkspaceSwitcherOnMobile ? "max-md:justify-end" : ""}`}
          >
            <div className={`min-w-0 flex-1 ${hideWorkspaceSwitcherOnMobile ? "max-md:hidden" : ""}`}>
              <AdminWorkspaceSwitcher />
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-1.5 text-[var(--color-apple-text)] outline-none transition-opacity hover:opacity-80 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="admin-mobile-nav-panel"
              aria-label={mobileNavOpen ? "Aizvērt galveno izvēlni" : "Atvērt galveno izvēlni"}
            >
              {mobileNavOpen ? (
                <X className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
              ) : (
                <AdminMobileMenuIcon lineClass="bg-[var(--color-apple-text)]" />
              )}
            </button>
          </header>

          <div
            id="admin-mobile-nav-panel"
            className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none md:hidden ${
              mobileNavOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
            aria-hidden={!mobileNavOpen}
          >
            <div className="min-h-0">
              <div className="max-h-[min(72dvh,calc(100dvh-5rem))] overflow-y-auto overscroll-contain border-t border-slate-100/90 bg-white/98 px-3 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)] sm:px-4">
                <AdminShellNavPanel
                  isProWorkspace={isProWorkspace}
                  baseUrl={baseUrl}
                  onClose={() => setMobileNavOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={`relative z-0 flex min-h-0 flex-1 flex-col md:flex-row ${!isProWorkspace ? "iriss-admin-scope" : ""}`}>
          {mobileNavOpen ? (
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-[40] border-0 bg-black/45 p-0 md:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
          ) : null}
          <aside
            id="admin-desktop-nav-aside"
            className={`relative z-10 hidden shrink-0 border-b border-slate-200/70 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm ${
              sidebarCollapsed ? "md:hidden" : asideDesktopOpen
            }`}
            aria-hidden={sidebarCollapsed}
          >
            <div className="p-3 sm:p-4">
              <AdminShellNavPanel isProWorkspace={isProWorkspace} baseUrl={baseUrl} onClose={onAsideCloseClick} />
            </div>
          </aside>
          <AdminShellLayoutContext.Provider value={shellLayoutValue}>
            <main className="relative z-10 min-w-0 w-full max-w-none flex-1 space-y-3 p-2 sm:px-3 sm:pb-4 md:px-4 md:pb-5 lg:px-5 lg:pb-6 pt-1.5 sm:pt-2">
              {notice}
              <div className="w-full min-w-0 max-w-none">{children}</div>
            </main>
          </AdminShellLayoutContext.Provider>
        </div>
      </div>
    </AdminNavInteractionProvider>
  );
}
