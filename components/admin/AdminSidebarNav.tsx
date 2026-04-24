"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navItemClass(active: boolean) {
  if (active) {
    return "inline-flex min-h-[38px] items-center rounded-lg border border-white/35 bg-white/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white";
  }
  return "inline-flex min-h-[38px] items-center rounded-lg border border-white/25 bg-transparent px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white/10";
}

type Props = {
  baseUrl?: string;
  orientation?: "vertical" | "horizontal";
};

export function AdminSidebarNav({ baseUrl, orientation = "vertical" }: Props) {
  const pathname = usePathname();
  const adminRoot = baseUrl ? `${baseUrl}/admin` : "";
  const horizontal = orientation === "horizontal";

  const consultationsActive = Boolean(pathname?.startsWith("/admin/konsultacijas"));
  const sakumsActive =
    !consultationsActive &&
    (pathname === "/admin/dashboard" ||
      pathname === "/admin/dashboard/" ||
      Boolean(pathname?.startsWith("/admin/orders/")));
  const rekiniActive = Boolean(pathname?.startsWith("/admin/commission-invoice"));

  return (
    <nav className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col items-stretch gap-1"}>
      <Link href="/admin/dashboard" className={navItemClass(sakumsActive)}>
        Sākums
      </Link>
      <Link href="/admin/konsultacijas" className={navItemClass(consultationsActive)}>
        Konsultācijas
      </Link>
      <Link href="/admin/commission-invoice" className={navItemClass(rekiniActive)}>
        RĒĶINI
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
