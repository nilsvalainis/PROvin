"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function navItemClass(active: boolean) {
  if (active) {
    return "rounded-xl bg-[var(--color-provin-accent-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/15";
  }
  return "rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-apple-text)] transition-colors hover:bg-slate-100/90";
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
    (pathname === "/admin" || pathname === "/admin/" || Boolean(pathname?.startsWith("/admin/orders/")));
  const rekiniActive = Boolean(pathname?.startsWith("/admin/commission-invoice"));

  return (
    <nav className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col items-stretch gap-1"}>
      <Link href="/admin" className={navItemClass(sakumsActive)}>
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
