import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

type Props = { children: ReactNode; baseUrl?: string; notice?: ReactNode };

export function AdminShell({ children, baseUrl, notice }: Props) {
  const adminRoot = baseUrl ? `${baseUrl}/admin` : "/admin";

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)] md:flex-row">
      <aside className="shrink-0 border-b border-slate-200/80 bg-white md:w-52 md:border-b-0 md:border-r md:border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 md:flex-col md:items-stretch md:p-4">
          <div>
            <Link
              href="/admin"
              className="text-base font-semibold tracking-tight text-[var(--color-provin-accent)]"
            >
              PROVIN
            </Link>
            <p className="text-[11px] leading-tight text-[var(--color-provin-muted)]">Administrēšana</p>
          </div>
          <nav className="flex flex-wrap items-center gap-1.5 md:flex-col md:items-stretch md:gap-2">
            <Link
              href="/admin"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[var(--color-apple-text)] hover:bg-[var(--color-provin-accent-soft)]"
            >
              Pasūtījumi
            </Link>
            <Link
              href="/"
              className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-provin-muted)] hover:bg-slate-100 hover:text-[var(--color-apple-text)]"
            >
              Uz lapu
            </Link>
            <LogoutButton />
          </nav>
          {baseUrl ? (
            <p className="hidden w-full break-all text-[10px] leading-snug text-[var(--color-provin-muted)] md:block">
              <span className="font-medium text-[var(--color-apple-text)]">Panelis:</span>{" "}
              <a href={adminRoot} className="text-[var(--color-provin-accent)] hover:underline">
                {adminRoot}
              </a>
            </p>
          ) : null}
        </div>
      </aside>
      <div className="min-w-0 flex-1 space-y-4 p-3 sm:p-4 md:p-5">
        {notice}
        {children}
      </div>
    </div>
  );
}
