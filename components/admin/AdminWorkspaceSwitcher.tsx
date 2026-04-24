"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function pillPro(active: boolean) {
  return active
    ? "inline-flex min-h-[38px] items-center rounded-lg border border-[var(--color-provin-accent-hover)] bg-[var(--color-provin-accent)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white"
    : "inline-flex min-h-[38px] items-center rounded-lg border border-[var(--color-provin-accent-hover)] bg-[var(--color-provin-accent)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white opacity-95";
}

function pillIriss(active: boolean) {
  return active
    ? "inline-flex min-h-[38px] items-center rounded-lg border border-white/35 bg-white/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white"
    : "inline-flex min-h-[38px] items-center rounded-lg border border-white/25 bg-transparent px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white/10";
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
      <Link href="/admin/dashboard" className={pillPro(proActive)} aria-current={proActive ? "page" : undefined}>
        PRO
      </Link>
      <Link
        href="/admin/iriss/pasutijumi"
        className={pillIriss(isIriss)}
        aria-current={isIriss ? "page" : undefined}
      >
        ORDERS
      </Link>
    </div>
  );
}
