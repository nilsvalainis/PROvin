"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminMobilePullToRefresh } from "@/components/admin/AdminMobilePullToRefresh";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { IrissAdminSidebarNav } from "./IrissAdminSidebarNav";
import { AdminWorkspaceSwitcher } from "./AdminWorkspaceSwitcher";
import { LogoutButton } from "./LogoutButton";

/** Mobilajā admin augšējā joslā — tās pašas 3 strīpiņas kā publiskajā HeaderClient. */
function AdminMobileMenuIcon({ lineClass }: { lineClass: string }) {
  return (
    <span className="flex flex-col items-center justify-center gap-[4px]" aria-hidden>
      <span className={`h-px w-[19px] ${lineClass}`} />
      <span className={`h-px w-[19px] ${lineClass}`} />
      <span className={`h-px w-[19px] ${lineClass}`} />
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

const MOBILE_NAV_TOP_REM = 3.5;

export function AdminShell({ children, baseUrl, notice, workspace = "pro" }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const onAsideCloseClick = useCallback(() => setMobileNavOpen(false), []);

  const shellLayoutValue = useMemo(
    () => ({ sidebarCollapsed: false, expandSidebar: () => undefined }),
    [],
  );

  const isProWorkspace = workspace === "pro";
  /** Kamēr IRISS ir tikai „Pasūtījumi”, mobilajā paslēdzam PRO/IRISS joslu — navigācija caur izvēlni + saite uz PRO. */
  const hideWorkspaceSwitcherOnMobile = !isProWorkspace;

  const asideMobileClasses = mobileNavOpen
    ? "max-md:fixed max-md:left-0 max-md:top-[3.5rem] max-md:z-[60] max-md:flex max-md:h-[calc(100dvh-3.5rem)] max-md:w-[min(20rem,88vw)] max-md:flex-col max-md:overflow-y-auto max-md:border-r max-md:border-slate-200/70 max-md:bg-white/98 max-md:shadow-2xl max-md:backdrop-blur-sm"
    : "max-md:hidden";

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)]">
      <header
        className={`sticky top-0 z-[45] flex shrink-0 flex-col gap-2 border-b border-slate-200/70 bg-white/90 px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm sm:px-4 ${hideWorkspaceSwitcherOnMobile ? "max-md:items-end" : ""}`}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className={`min-w-0 flex-1 ${hideWorkspaceSwitcherOnMobile ? "max-md:hidden" : ""}`}>
            <AdminWorkspaceSwitcher />
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/85 bg-white p-1.5 text-[var(--color-provin-accent)] shadow-sm outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:hidden"
              aria-label="Atsvaidzināt lapu"
              title="Atsvaidzināt lapu"
            >
              <RefreshCw className="h-[17px] w-[17px]" strokeWidth={2.25} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-1.5 text-[var(--color-apple-text)] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="admin-mobile-nav-aside"
              aria-label={mobileNavOpen ? "Aizvērt galveno izvēlni" : "Atvērt galveno izvēlni"}
            >
              <AdminMobileMenuIcon lineClass="bg-[var(--color-apple-text)]" />
            </button>
          </div>
        </div>

        <div className="hidden w-full items-center justify-between gap-3 border-t border-slate-200/70 pt-2 md:flex">
          {isProWorkspace ? (
            <AdminSidebarNav baseUrl={baseUrl} orientation="horizontal" />
          ) : (
            <IrissAdminSidebarNav orientation="horizontal" />
          )}
          <LogoutButton className="md:w-auto md:px-3 md:py-2" />
        </div>
      </header>

      <AdminMobilePullToRefresh />

      {mobileNavOpen ? (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          className="fixed inset-x-0 bottom-0 z-[55] border-0 bg-black/45 p-0 md:hidden"
          style={{ top: `${MOBILE_NAV_TOP_REM}rem` }}
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div className={`flex min-h-0 flex-1 flex-col ${!isProWorkspace ? "iriss-admin-scope" : ""}`}>
        <aside
          id="admin-mobile-nav-aside"
          className={`shrink-0 border-b border-slate-200/70 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm ${asideMobileClasses}`}
          aria-hidden={!mobileNavOpen}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4">
            <div className="flex w-full min-w-0 items-start justify-between gap-2">
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
                onClick={onAsideCloseClick}
                className="shrink-0 rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-xs font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 md:hidden"
                aria-label="Aizvērt galveno izvēlni"
                title="Aizvērt izvēlni"
              >
                <span aria-hidden className="tabular-nums">
                  «
                </span>
              </button>
            </div>
            {isProWorkspace ? <AdminSidebarNav baseUrl={baseUrl} /> : <IrissAdminSidebarNav />}
            <div>
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
