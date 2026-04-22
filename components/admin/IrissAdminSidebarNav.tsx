"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IrissNewOfferMenuButton } from "@/components/admin/IrissNewOfferMenuButton";

function navItemClass(active: boolean) {
  if (active) {
    return "rounded-xl border border-white/20 bg-white/70 px-3 py-2.5 text-[13px] font-semibold text-[var(--color-provin-accent)] shadow-sm backdrop-blur-xl";
  }
  return "rounded-xl border border-white/20 bg-white/50 px-3 py-2.5 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm backdrop-blur-xl transition-colors hover:bg-white/80";
}

type Props = {
  orientation?: "vertical" | "horizontal";
};

export function IrissAdminSidebarNav({ orientation = "vertical" }: Props) {
  const pathname = usePathname() || "";
  const pasutijumiActive = pathname.startsWith("/admin/iriss/pasutijumi");
  const sludinajumiActive = pathname.startsWith("/admin/iriss/sludinajumi");
  const horizontal = orientation === "horizontal";

  return (
    <nav className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-1.5"}>
      <Link href="/admin/iriss/pasutijumi" className={navItemClass(pasutijumiActive)}>
        PASŪTĪJUMI
      </Link>
      <Link href="/admin/iriss/sludinajumi" className={navItemClass(sludinajumiActive)}>
        SLUDINĀJUMI
      </Link>
      <IrissNewOfferMenuButton compact={horizontal} />
      {!horizontal ? (
        <Link href="/admin" className="rounded-xl border border-white/20 bg-white/60 px-3 py-2.5 text-center text-[12px] font-medium text-[var(--color-provin-accent)] shadow-sm backdrop-blur-xl transition hover:bg-white/80 md:hidden">
          PRO administrēšana
        </Link>
      ) : null}
    </nav>
  );
}
