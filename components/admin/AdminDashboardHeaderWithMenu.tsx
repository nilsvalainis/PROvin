"use client";

import type { ReactNode } from "react";
import { AdminCollapsedMenuButton } from "@/components/admin/AdminCollapsedMenuButton";

/** Apvieno „Izvēlne” ar saraksta lapas virsrakstu vienā rindā, ja sānjosla ir sakļauta. */
export function AdminDashboardHeaderWithMenu({ children }: { children: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start gap-2 border-b border-slate-200/70 pb-5">
      <AdminCollapsedMenuButton className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </header>
  );
}
