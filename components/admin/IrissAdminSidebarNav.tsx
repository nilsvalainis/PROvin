"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navItemClass(active: boolean) {
  if (active) {
    return "rounded-xl bg-[var(--color-provin-accent-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/20";
  }
  return "rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-apple-text)] transition-colors hover:bg-slate-100/90";
}

export function IrissAdminSidebarNav() {
  const pathname = usePathname() || "";
  const pasutijumiActive = pathname.startsWith("/admin/iriss/pasutijumi");

  return (
    <nav className="flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">IRISS</p>
      <Link href="/admin/iriss/pasutijumi" className={navItemClass(pasutijumiActive)}>
        PASŪTĪJUMI
      </Link>
    </nav>
  );
}
