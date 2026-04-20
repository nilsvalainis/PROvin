"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navItemClass(active: boolean) {
  if (active) {
    return "rounded-lg bg-[var(--color-provin-accent-soft)] px-2.5 py-2 text-[13px] font-semibold text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/20";
  }
  return "rounded-lg px-2.5 py-2 text-[13px] font-medium text-[var(--color-apple-text)] transition-colors hover:bg-slate-100/90";
}

type Props = {
  orientation?: "vertical" | "horizontal";
};

export function IrissAdminSidebarNav({ orientation = "vertical" }: Props) {
  const pathname = usePathname() || "";
  const pasutijumiActive = pathname.startsWith("/admin/iriss/pasutijumi");
  const horizontal = orientation === "horizontal";

  return (
    <nav className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-1.5"}>
      <Link href="/admin/iriss/pasutijumi" className={navItemClass(pasutijumiActive)}>
        PASŪTĪJUMI
      </Link>
      {!horizontal ? (
        <Link
          href="/admin"
          className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-center text-[12px] font-medium text-[var(--color-provin-accent)] transition hover:bg-slate-100/90 md:hidden"
        >
          PRO administrēšana
        </Link>
      ) : null}
    </nav>
  );
}
