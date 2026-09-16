"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminNavCountBadge } from "@/components/admin/AdminNavCountBadge";

function navItemClass(active: boolean) {
  if (active) {
    return "relative inline-flex min-h-[38px] items-center rounded-lg border border-white/35 bg-white/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white";
  }
  return "relative inline-flex min-h-[38px] items-center rounded-lg border border-white/25 bg-transparent px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white/10";
}

type Props = {
  baseUrl?: string;
  orientation?: "vertical" | "horizontal";
};

export function AdminSidebarNav({ baseUrl, orientation = "vertical" }: Props) {
  const pathname = usePathname();
  const adminRoot = baseUrl ? `${baseUrl}/admin` : "";
  const horizontal = orientation === "horizontal";
  const [unseenPartners, setUnseenPartners] = useState(0);

  const refreshUnseen = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/partners/unseen-count", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as { unseenCount?: unknown };
      const n =
        typeof data.unseenCount === "number" && Number.isFinite(data.unseenCount) ? data.unseenCount : 0;
      setUnseenPartners(Math.max(0, Math.floor(n)));
    } catch {
      /* badge nav kritisks */
    }
  }, []);

  useEffect(() => {
    void refreshUnseen();
    const t = window.setInterval(() => void refreshUnseen(), 45_000);
    const onFocus = () => void refreshUnseen();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, refreshUnseen]);

  const consultationsActive = Boolean(pathname?.startsWith("/admin/konsultacijas"));
  const rekiniActive = Boolean(pathname?.startsWith("/admin/commission-invoice"));
  const partneriActive = Boolean(pathname?.startsWith("/admin/partneri"));
  const statistikaActive = Boolean(pathname?.startsWith("/admin/statistika"));
  const blogsActive = Boolean(pathname?.startsWith("/admin/blogs"));
  const peeksActive = Boolean(pathname?.startsWith("/admin/atras-vertesanas"));
  const zinasanasActive = Boolean(pathname?.startsWith("/admin/agregatu-zinasanas"));
  const sakumsActive =
    !consultationsActive &&
    !rekiniActive &&
    !partneriActive &&
    !statistikaActive &&
    !blogsActive &&
    !peeksActive &&
    !zinasanasActive &&
    (pathname === "/admin/dashboard" ||
      pathname === "/admin/dashboard/" ||
      Boolean(pathname?.startsWith("/admin/orders/")));

  return (
    <nav className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col items-stretch gap-1"}>
      <Link href="/admin/dashboard" className={navItemClass(sakumsActive)}>
        Sākums
      </Link>
      <Link href="/admin/atras-vertesanas" className={navItemClass(peeksActive)}>
        Ātrie vērtējumi
      </Link>
      <Link href="/admin/konsultacijas" className={navItemClass(consultationsActive)}>
        Konsultācijas
      </Link>
      <Link href="/admin/blogs" className={navItemClass(blogsActive)}>
        BLOGS
      </Link>
      <Link href="/admin/statistika" className={navItemClass(statistikaActive)}>
        Statistika
      </Link>
      <Link href="/admin/agregatu-zinasanas" className={navItemClass(zinasanasActive)}>
        Agregāti
      </Link>
      <Link href="/admin/commission-invoice" className={navItemClass(rekiniActive)}>
        RĒĶINI
      </Link>
      <Link
        href="/admin/partneri"
        className={navItemClass(partneriActive)}
        title={unseenPartners > 0 ? `Jauni partneri: ${unseenPartners}` : "Partneri"}
      >
        Partneri
        <AdminNavCountBadge count={unseenPartners} label={`Jauni partneri: ${unseenPartners}`} />
      </Link>
      {adminRoot && !horizontal ? (
        <p className="hidden w-full break-all pt-2 text-[10px] leading-snug text-[var(--color-provin-muted)] md:block">
          <span className="font-medium text-[var(--color-apple-text)]">Panelis:</span>{" "}
          <a href={adminRoot} className="text-[var(--color-provin-accent)] hover:underline">
            {adminRoot}
          </a>
        </p>
      ) : null}
    </nav>
  );
}
