"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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
  const asideMobileClasses = mobileNavOpen
    ? "max-md:fixed max-md:right-0 max-md:top-[3.5rem] max-md:z-[60] max-md:flex max-md:h-[calc(100dvh-3.5rem)] max-md:w-[min(14rem,74vw)] max-md:flex-col max-md:overflow-y-auto max-md:border-l max-md:border-slate-200/70 max-md:bg-white/98 max-md:shadow-2xl max-md:backdrop-blur-sm"
    : "max-md:hidden";

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)]">
      <header className="sticky top-0 z-[45] flex shrink-0 items-center gap-2 border-b border-slate-200/60 bg-white/85 px-3 py-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl sm:px-4">
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <AdminWorkspaceSwitcher />
          <div className="hidden items-center gap-2 md:flex">
            <div className="h-5 w-px bg-slate-200/90" aria-hidden />
            {isProWorkspace ? (
              <AdminSidebarNav baseUrl={baseUrl} orientation="horizontal" />
            ) : (
              <IrissAdminSidebarNav orientation="horizontal" />
            )}
          </div>
        </div>
        <div className="hidden md:flex">
          <LogoutButton className="border-0 bg-transparent px-1 py-0 text-xs font-semibold text-[var(--color-provin-muted)] shadow-none hover:bg-transparent hover:text-[var(--color-apple-text)] md:w-auto" />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/60 p-1.5 text-slate-700 shadow-sm backdrop-blur-xl outline-none transition hover:bg-white/75 focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Atsvaidzināt lapu"
            title="Atsvaidzināt lapu"
          >
            <RefreshCw className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/60 p-1.5 text-[var(--color-apple-text)] shadow-sm backdrop-blur-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-expanded={mobileNavOpen}
            aria-controls="admin-mobile-nav-aside"
            aria-label={mobileNavOpen ? "Aizvērt galveno izvēlni" : "Atvērt galveno izvēlni"}
          >
            <AdminMobileMenuIcon lineClass="bg-[var(--color-apple-text)]" />
          </button>
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
          className={`shrink-0 border-b border-slate-200/70 bg-white/92 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl md:hidden ${asideMobileClasses}`}
          aria-hidden={!mobileNavOpen}
        >
          <div className="flex flex-col gap-2 p-2.5">
            <div className="flex w-full min-w-0 items-start justify-between gap-2">
              <span aria-hidden />
              <button
                type="button"
                onClick={onAsideCloseClick}
                className="shrink-0 rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 md:hidden"
                aria-label="Aizvērt galveno izvēlni"
                title="Aizvērt izvēlni"
              >
                <span aria-hidden className="tabular-nums">
                  «
                </span>
              </button>
            </div>
            {isProWorkspace ? <AdminSidebarNav baseUrl={baseUrl} /> : null}
            <div className="pt-0.5">
              <LogoutButton />
            </div>
          </div>
        </aside>
        <AdminShellLayoutContext.Provider value={shellLayoutValue}>
          <main className="min-w-0 w-full max-w-none flex-1 space-y-3 p-2 pt-2 sm:px-3 sm:pb-4 md:px-4 md:pb-5 lg:px-5 lg:pb-6">
            {notice}
            <div className="w-full min-w-0 max-w-none rounded-[24px] border border-slate-200/60 bg-white/75 p-2.5 shadow-sm backdrop-blur-xl sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
              {children}
            </div>
          </main>
        </AdminShellLayoutContext.Provider>
      </div>
    </div>
  );
}
