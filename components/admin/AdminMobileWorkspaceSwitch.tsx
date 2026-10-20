"use client";

import Link from "next/link";
import { useAdminWorkspace, writeWsCookie } from "@/components/admin/AdminSidebar";

/** Viens pieskāriens IRISS / PRO. Meklēšana paliek augšējā laukā. */
export function AdminMobileWorkspaceSwitch() {
  const workspace = useAdminWorkspace();
  const toIriss = workspace !== "iriss";
  const href = toIriss ? "/admin/iriss" : "/admin/dashboard";
  const next = toIriss ? "iriss" : "pro";
  const current = workspace === "iriss" ? "IRISS" : "PRO";
  const other = workspace === "iriss" ? "PRO" : "IRISS";
  return (
    <Link
      href={href}
      onClick={() => writeWsCookie(next)}
      aria-label={`Pārslēgt uz ${other}`}
      data-ws={workspace}
      className="admin-ws-switch am-press pointer-events-auto"
    >
      <small>{other}</small>
      <b>{current}</b>
    </Link>
  );
}
