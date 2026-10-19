"use client";

import { createContext, useContext } from "react";
import type { AdminColorScheme, AdminWorkspaceId } from "@/lib/admin-chrome-attrs";

export type AdminShellLayoutValue = {
  sidebarCollapsed: boolean;
  expandSidebar: () => void;
  workspace: AdminWorkspaceId;
  theme: AdminColorScheme;
};

export const AdminShellLayoutContext = createContext<AdminShellLayoutValue | null>(null);

export function useAdminShellLayout() {
  return useContext(AdminShellLayoutContext);
}
