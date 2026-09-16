"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNavCountBadge } from "@/components/admin/AdminNavCountBadge";

function pill(active: boolean) {
  return active
    ? "relative inline-flex min-h-[34px] items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-black sm:min-h-[38px] sm:px-3 sm:py-1.5 sm:text-[12px]"
    : "relative inline-flex min-h-[34px] items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-black/80 transition hover:text-black sm:min-h-[38px] sm:px-3 sm:py-1.5 sm:text-[12px]";
}

/** Pārslēdzējs: PRO (auditi), IRISS, FAST (ātrie pasūtījumi). */
export function AdminWorkspaceSwitcher() {
  const pathname = usePathname() || "";
  const isIriss = pathname.startsWith("/admin/iriss");
  const isFast = pathname.startsWith("/admin/atras-vertesanas");
  const proActive = !isIriss && !isFast;
  const [fastOpen, setFastOpen] = useState(0);

  const refreshFast = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/listing-peeks/open-count", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { openCount?: unknown };
      const n = typeof data.openCount === "number" && Number.isFinite(data.openCount) ? data.openCount : 0;
      setFastOpen(Math.max(0, Math.floor(n)));
    } catch {
      /* badge nav kritisks */
    }
  }, []);

  useEffect(() => {
    void refreshFast();
    const t = window.setInterval(() => void refreshFast(), 45_000);
    const onFocus = () => void refreshFast();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, refreshFast]);

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 md:justify-start"
      role="navigation"
      aria-label="Projekta zona"
    >
      <Link href="/admin/dashboard" className={pill(proActive)} aria-current={proActive ? "page" : undefined}>
        PRO
      </Link>
      <Link
        href="/admin/iriss/pasutijumi"
        className={pill(isIriss)}
        aria-current={isIriss ? "page" : undefined}
      >
        IRISS
      </Link>
      <Link
        href="/admin/atras-vertesanas"
        className={pill(isFast)}
        aria-current={isFast ? "page" : undefined}
        title={fastOpen > 0 ? `Neapstrādāti ātrie: ${fastOpen}` : "Ātrie pasūtījumi"}
      >
        FAST
        <AdminNavCountBadge count={fastOpen} label={`Neapstrādāti ātrie pasūtījumi: ${fastOpen}`} />
      </Link>
    </div>
  );
}
