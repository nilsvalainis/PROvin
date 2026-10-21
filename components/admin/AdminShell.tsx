"use client";

import { AdminOfflineBanner } from "@/components/admin/AdminOfflineBanner";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { AdminGlobalSearch, AdminMobileSearchButton } from "./AdminGlobalSearch";
import { AdminMobileBackRow } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileTabBar, AdminSidebar, useAdminSidebarCollapsed } from "./AdminSidebar";
import { AdminShellMainWithMobilePull } from "./AdminShellMainWithMobilePull";
import { AdminAuditDeadlineTickProvider } from "./AdminAuditDeadlineTickProvider";
import { AdminVinHandoffProvider } from "./AdminVinHandoffContext";
import { AdminShellLayoutContext } from "@/components/admin/AdminShellLayoutContext";
import {
  useAdminMobileColorScheme,
  useAdminMobileViewport,
  useSyncAdminMobileThemeColor,
} from "@/components/admin/useAdminMobileViewport";
import {
  ADMIN_MOBILE_TABBAR_DOCK_WRAPPER,
  ADMIN_MOBILE_TABBAR_H_CSS,
  IRISS_MOBILE_TABBAR_H_CSS,
  adminMobilePullToRefreshEnabled,
  proMobileNeedsBack,
} from "@/lib/admin-mobile-shell";
import { adminChromeDataset, type AdminWorkspaceId } from "@/lib/admin-chrome-attrs";

export type { AdminShellLayoutValue } from "@/components/admin/AdminShellLayoutContext";
export { useAdminShellLayout } from "@/components/admin/AdminShellLayoutContext";

export type AdminShellWorkspace = AdminWorkspaceId;

type Props = {
  children: ReactNode;
  baseUrl?: string;
  notice?: ReactNode;
  /** PRO — esošais admin; IRISS — atsevišķa zona. */
  workspace?: AdminShellWorkspace;
};

export function AdminShell({ children, notice, workspace = "pro" }: Props) {
  const pathname = usePathname() ?? "";
  const isProWorkspace = workspace === "pro";
  const isDetailScreen = /^\/admin\/(?:iriss\/pasutijumi|orders|konsultacijas|commission-invoice|partneri)\/[^/]+$/.test(pathname);
  const pullToRefresh = adminMobilePullToRefreshEnabled(pathname);
  /** Detaļu lapām ar savu apakšējo joslu mobilajā cilņu joslu nerādām. */
  const hideTabBar = isDetailScreen || /^\/admin\/atras-vertesanas\/[^/]+$/.test(pathname);
  const showProBack = isProWorkspace && proMobileNeedsBack(pathname);
  const { collapsed, toggle } = useAdminSidebarCollapsed();
  const mobile = useAdminMobileViewport();
  const adminTheme = useAdminMobileColorScheme();
  useSyncAdminMobileThemeColor(adminTheme, workspace);
  const shellLayoutValue = useMemo(
    () => ({
      sidebarCollapsed: false,
      expandSidebar: () => undefined,
      workspace,
      theme: adminTheme,
    }),
    [adminTheme, workspace],
  );

  return (
    <AdminVinHandoffProvider>
    <AdminShellLayoutContext.Provider value={shellLayoutValue}>
    <div
      className={`admin-m flex min-h-dvh ${
        workspace === "iriss" ? "" : "bg-[var(--am-bg,#F2F2F7)]"
      } ${hideTabBar ? "" : "max-md:pb-[var(--admin-tabbar-h)]"}`}
      {...adminChromeDataset(workspace, adminTheme)}
      style={{
        ["--admin-tabbar-h" as string]: hideTabBar
          ? "0px"
          : workspace === "iriss"
            ? IRISS_MOBILE_TABBAR_H_CSS
            : ADMIN_MOBILE_TABBAR_H_CSS,
      }}
    >
      {mobile ? null : <AdminSidebar collapsed={collapsed} onToggle={toggle} workspace={workspace} />}
      <div className={`flex min-w-0 flex-1 flex-col ${!isProWorkspace ? "iriss-admin-scope" : ""}`}>
        {null}
          <AdminAuditDeadlineTickProvider>
            <AdminShellMainWithMobilePull
              isDetailScreen={isDetailScreen}
              pullToRefresh={pullToRefresh}
              notice={notice}
            >
              {showProBack ? <AdminMobileBackRow /> : null}
              {children}
            </AdminShellMainWithMobilePull>
          </AdminAuditDeadlineTickProvider>
      </div>
      {hideTabBar ? null : (
        <div className={ADMIN_MOBILE_TABBAR_DOCK_WRAPPER}>
          <AdminMobileTabBar workspace={workspace} />
          {/* Zonu maiņa (PRO / IRISS) ir "Vairāk" lapas augšā; šeit meklēšana kā iOS. */}
          <AdminMobileSearchButton />
        </div>
      )}
      <AdminGlobalSearch />
      <AdminOfflineBanner />
    </div>
    </AdminShellLayoutContext.Provider>
    </AdminVinHandoffProvider>
  );
}
