"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function pillPro(active: boolean) {
  return active
    ? "rounded-xl border border-white/20 bg-white/65 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-accent)] shadow-sm backdrop-blur-xl"
    : "rounded-xl border border-white/20 bg-white/45 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] shadow-sm backdrop-blur-xl transition hover:bg-white/70";
}

function pillIriss(active: boolean) {
  return active
    ? "rounded-xl border border-white/20 bg-white/65 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-accent)] shadow-sm backdrop-blur-xl"
    : "rounded-xl border border-white/20 bg-white/45 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-provin-muted)] shadow-sm backdrop-blur-xl transition hover:bg-white/70";
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
