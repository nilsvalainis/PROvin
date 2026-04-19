"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useAdminNavInteraction } from "@/components/admin/AdminNavInteractionContext";

function pillPro(active: boolean) {
  const touch =
    "touch-manipulation select-none transition-[transform,colors,opacity] active:scale-[0.97] active:opacity-90 motion-reduce:active:scale-100";
  return active
    ? `rounded-lg border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-provin-accent)] ${touch} inline-flex min-h-9 items-center justify-center gap-1.5`
    : `rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] transition hover:bg-slate-100/80 dark:hover:bg-white/[0.06] ${touch} inline-flex min-h-9 items-center justify-center gap-1.5`;
}

function pillIriss(active: boolean) {
  const touch =
    "touch-manipulation select-none transition-[transform,colors,opacity] active:scale-[0.97] active:opacity-90 motion-reduce:active:scale-100";
  return active
    ? `rounded-lg border border-[#EF7D1A]/40 bg-[#EF7D1A]/12 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#EF7D1A] ${touch} inline-flex min-h-9 items-center justify-center gap-1.5`
    : `rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] transition hover:bg-slate-100/80 dark:hover:bg-white/[0.06] ${touch} inline-flex min-h-9 items-center justify-center gap-1.5`;
}

function pendingPill(pending: boolean) {
  return pending ? "ring-2 ring-[var(--color-provin-accent)]/30 ring-offset-1 ring-offset-white" : "";
}

/** Pārslēdzējs starp PRO (pasūtījumi u.tml.) un IRISS admin zonām. */
export function AdminWorkspaceSwitcher() {
  const pathname = usePathname() || "";
  const isIriss = pathname.startsWith("/admin/iriss");
  const proActive = !isIriss;
  const navIx = useAdminNavInteraction();
  const pPro = Boolean(navIx?.isPending("/admin"));
  const pIriss = Boolean(navIx?.isPending("/admin/iriss/pasutijumi"));

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 md:justify-start"
      role="navigation"
      aria-label="Projekta zona"
    >
      <Link
        href="/admin"
        className={`${pillPro(proActive)} ${pendingPill(pPro)}`}
        aria-current={proActive ? "page" : undefined}
        aria-busy={pPro ? true : undefined}
        onClick={() => navIx?.beginNav("/admin")}
      >
        <span>PRO</span>
        {pPro ? <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-80" strokeWidth={2.5} aria-hidden /> : null}
      </Link>
      <ArrowLeftRight
        className={`h-4 w-4 shrink-0 opacity-80 ${isIriss ? "text-[#EF7D1A]" : "text-[var(--color-provin-muted)]"}`}
        aria-hidden
      />
      <Link
        href="/admin/iriss/pasutijumi"
        className={`${pillIriss(isIriss)} ${pIriss ? "ring-2 ring-[#EF7D1A]/35 ring-offset-1 ring-offset-white" : ""}`}
        aria-current={isIriss ? "page" : undefined}
        aria-busy={pIriss ? true : undefined}
        onClick={() => navIx?.beginNav("/admin/iriss/pasutijumi")}
      >
        <span>IRISS</span>
        {pIriss ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-80" strokeWidth={2.5} aria-hidden />
        ) : null}
      </Link>
    </div>
  );
}
