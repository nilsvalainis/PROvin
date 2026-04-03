import type { ReactNode } from "react";
import Link from "next/link";
import { AdminSidebarNav } from "./AdminSidebarNav";

type Props = { children: ReactNode; baseUrl?: string; notice?: ReactNode };

export function AdminShell({ children, baseUrl, notice }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)] md:flex-row">
      <aside className="shrink-0 border-b border-slate-200/70 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm md:w-56 md:border-b-0 md:border-r md:border-slate-200/70 md:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4 md:flex-col md:items-stretch">
          <div className="min-w-0">
            <Link
              href="/admin"
              className="text-[15px] font-semibold tracking-tight text-[var(--color-provin-accent)]"
            >
              PROVIN
            </Link>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
              Administrēšana
            </p>
          </div>
          <AdminSidebarNav baseUrl={baseUrl} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 space-y-5 p-3 sm:p-5 md:p-8 md:pl-6 lg:pl-10">
        {notice}
        {children}
      </main>
    </div>
  );
}
