"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import { AdminMobileTabBar, AdminSidebar, useAdminSidebarCollapsed } from "./AdminSidebar";
import { AdminShellMainWithMobilePull } from "./AdminShellMainWithMobilePull";
import { AdminAuditDeadlineTickProvider } from "./AdminAuditDeadlineTickProvider";
import { AdminVinHandoffProvider } from "./AdminVinHandoffContext";
import { ADMIN_MOBILE_TABBAR_H_CSS } from "@/lib/admin-mobile-shell";

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
  /** PRO — esošais admin; IRISS — atsevišķa zona. */
  workspace?: AdminShellWorkspace;
};

export function AdminShell({ children, notice, workspace = "pro" }: Props) {
  const pathname = usePathname() ?? "";
  const shellLayoutValue = useMemo(
    () => ({ sidebarCollapsed: false, expandSidebar: () => undefined }),
    [],
  );

  const isProWorkspace = workspace === "pro";
  const isDetailScreen = /^\/admin\/(?:iriss\/pasutijumi|orders|konsultacijas|commission-invoice|partneri)\/[^/]+$/.test(pathname);
  /** Detaļu lapām ar savu apakšējo joslu mobilajā cilņu joslu nerādām. */
  const hideTabBar = isDetailScreen || /^\/admin\/atras-vertesanas\/[^/]+$/.test(pathname);
  const { collapsed, toggle } = useAdminSidebarCollapsed();

  return (
    <AdminVinHandoffProvider>
    <div
      className={`flex min-h-dvh bg-white max-md:h-dvh max-md:min-h-0 ${
        hideTabBar ? "" : "max-md:pb-[var(--admin-tabbar-h)]"
      }`}
      style={{ ["--admin-tabbar-h" as string]: hideTabBar ? "0px" : ADMIN_MOBILE_TABBAR_H_CSS }}
    >
      <AdminSidebar collapsed={collapsed} onToggle={toggle} />
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col max-md:h-full ${!isProWorkspace ? "iriss-admin-scope" : ""}`}>
        <AdminShellLayoutContext.Provider value={shellLayoutValue}>
          <AdminAuditDeadlineTickProvider>
            <AdminShellMainWithMobilePull isDetailScreen={isDetailScreen} notice={notice}>
              {children}
            </AdminShellMainWithMobilePull>
          </AdminAuditDeadlineTickProvider>
        </AdminShellLayoutContext.Provider>
      </div>
      {hideTabBar ? null : <AdminMobileTabBar workspace={workspace} />}
    </div>
    </AdminVinHandoffProvider>
  );
}
