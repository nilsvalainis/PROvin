"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function pillPro(active: boolean) {
  return active
    ? "inline-flex min-h-[38px] items-center rounded-lg border border-black/35 bg-[var(--color-provin-accent)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-black"
    : "inline-flex min-h-[38px] items-center rounded-lg border border-black/35 bg-[var(--color-provin-accent)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-black opacity-95";
}

function pillIriss(active: boolean) {
  return active
    ? "inline-flex min-h-[38px] items-center rounded-lg border border-black/35 bg-black/5 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-black"
    : "inline-flex min-h-[38px] items-center rounded-lg border border-black/35 bg-transparent px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-black transition hover:bg-black/5";
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
