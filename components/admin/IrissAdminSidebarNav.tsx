"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAdminNavInteraction } from "@/components/admin/AdminNavInteractionContext";

function navItemClass(active: boolean) {
  const base =
    "inline-flex w-full touch-manipulation select-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-[transform,colors,opacity] active:scale-[0.98] active:opacity-90 motion-reduce:transition-none motion-reduce:active:scale-100";
  if (active) {
    return `${base} bg-[var(--color-provin-accent-soft)] font-semibold text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/20`;
  }
  return `${base} font-medium text-[var(--color-apple-text)] hover:bg-slate-100/90`;
}

function pendingRing(pending: boolean) {
  return pending ? "ring-2 ring-[var(--color-provin-accent)]/35 ring-offset-1 ring-offset-white" : "";
}

export function IrissAdminSidebarNav() {
  const pathname = usePathname() || "";
  const pasutijumiActive = pathname.startsWith("/admin/iriss/pasutijumi");
  const navIx = useAdminNavInteraction();
  const pPas = Boolean(navIx?.isPending("/admin/iriss/pasutijumi"));
  const pPro = Boolean(navIx?.isPending("/admin"));

  return (
    <nav className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">IRISS</p>
      <Link
        href="/admin/iriss/pasutijumi"
        className={`${navItemClass(pasutijumiActive)} ${pendingRing(pPas)}`}
        aria-busy={pPas ? true : undefined}
        onClick={() => navIx?.beginNav("/admin/iriss/pasutijumi")}
      >
        <span className="min-w-0">PASŪTĪJUMI</span>
        {pPas ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" strokeWidth={2.5} aria-hidden />
        ) : null}
      </Link>
      <Link
        href="/admin"
        className={`mt-2 inline-flex touch-manipulation select-none items-center justify-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-center text-[12px] font-medium text-[var(--color-provin-accent)] transition hover:bg-slate-100/90 active:scale-[0.98] active:opacity-90 md:hidden ${pendingRing(pPro)}`}
        aria-busy={pPro ? true : undefined}
        onClick={() => navIx?.beginNav("/admin")}
      >
        <span>PRO administrēšana</span>
        {pPro ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" strokeWidth={2.5} aria-hidden />
        ) : null}
      </Link>
    </nav>
  );
}
