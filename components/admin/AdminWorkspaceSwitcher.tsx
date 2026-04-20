"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function pillPro(active: boolean) {
  return active
    ? "rounded-lg border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-provin-accent)]"
    : "rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] transition hover:bg-slate-100/80 dark:hover:bg-white/[0.06]";
}

function pillIriss(active: boolean) {
  return active
    ? "rounded-lg border border-[#EF7D1A]/40 bg-[#EF7D1A]/12 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#EF7D1A]"
    : "rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] transition hover:bg-slate-100/80 dark:hover:bg-white/[0.06]";
}

/** Pārslēdzējs starp PRO (pasūtījumi u.tml.) un IRISS admin zonām. */
export function AdminWorkspaceSwitcher() {
  const pathname = usePathname() || "";
  const isIriss = pathname.startsWith("/admin/iriss");
  const proActive = !isIriss;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 md:justify-start"
      role="navigation"
      aria-label="Projekta zona"
    >
      <Link href="/admin" className={pillPro(proActive)} aria-current={proActive ? "page" : undefined}>
        PRO
      </Link>
      <Link
        href="/admin/iriss/pasutijumi"
        className={pillIriss(isIriss)}
        aria-current={isIriss ? "page" : undefined}
      >
        IRISS
      </Link>
    </div>
  );
}
