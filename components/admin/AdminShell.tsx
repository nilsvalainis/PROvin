import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

type Props = { children: ReactNode; baseUrl?: string };

export function AdminShell({ children, baseUrl }: Props) {
  const adminRoot = baseUrl ? `${baseUrl}/admin` : "/admin";

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-provin-surface)] md:flex-row">
      <aside className="shrink-0 border-b border-slate-200/80 bg-white md:w-56 md:border-b-0 md:border-r md:border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:flex-col md:items-stretch md:p-6">
          <div>
            <Link
              href="/admin"
              className="text-lg font-semibold tracking-tight text-[var(--color-provin-accent)]"
            >
              PROVIN
            </Link>
            <p className="text-xs text-[var(--color-provin-muted)]">Administrēšana</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 md:flex-col md:items-stretch md:gap-3">
            <Link
              href="/admin"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-apple-text)] hover:bg-[var(--color-provin-accent-soft)]"
            >
              Pasūtījumi
            </Link>
            <Link
              href="/"
              className="rounded-lg px-3 py-2 text-sm text-[var(--color-provin-muted)] hover:bg-slate-100 hover:text-[var(--color-apple-text)]"
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
      <div className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</div>
    </div>
  );
}
