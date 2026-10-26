"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function IrissLogisticsAppShell({ name, children }: { name: string; children: ReactNode }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="iriss-admin-scope min-h-dvh text-[var(--iriss-ink)]">
      <header className="iriss-log-no-print relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[15px] font-semibold tracking-tight">Loģistika</span>
          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--iriss-info)]">
            IRISS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="max-w-[12rem] truncate text-[13px] text-[var(--iriss-ink-2)]">{name}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-[var(--iriss-ink)] hover:bg-white"
          >
            Iziet
          </button>
        </div>
      </header>
      <div className="px-3 pb-6 sm:px-6">{children}</div>
    </div>
  );
}
