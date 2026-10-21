"use client";

import Link from "next/link";
import { useAdminShellLayout } from "@/components/admin/AdminShellLayoutContext";

/**
 * Telefona galvenē: "IRISS | PRO". Viens pieskāriens atver otras zonas sākumu (Nils 21.10).
 * Darbiniekiem (bez admin čaulas) nerāda: PRO viņiem nav pieejams.
 */
export function AdminWorkspaceSwitch() {
  const shell = useAdminShellLayout();
  if (!shell) return null;
  const iriss = shell.workspace === "iriss";
  const target = iriss ? "pro" : "iriss";
  return (
    <Link
      href={iriss ? "/admin/pro" : "/admin/iriss"}
      prefetch
      onClick={() => {
        document.cookie = `admin_ws=${target}; Path=/admin; Max-Age=31536000; SameSite=Lax`;
      }}
      aria-label={`Pārslēgties uz ${iriss ? "PRO" : "IRISS"}`}
      className="admin-nav-link am-ws-switch shrink-0"
      data-ws={shell.workspace}
    >
      <span className={iriss ? "on" : ""}>IRISS</span>
      <span className={iriss ? "" : "on"}>PRO</span>
    </Link>
  );
}
