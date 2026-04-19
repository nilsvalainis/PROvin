"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

function navItemClass(active: boolean) {
  if (active) {
    return "rounded-xl bg-[var(--color-provin-accent-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/15";
  }
  return "rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-apple-text)] transition-colors hover:bg-slate-100/90";
}

export function AdminSidebarNav({ baseUrl }: { baseUrl?: string }) {
  const pathname = usePathname();
  const adminRoot = baseUrl ? `${baseUrl}/admin` : "";

  const consultationsActive = Boolean(pathname?.startsWith("/admin/konsultacijas"));
  const ordersSectionActive =
    !consultationsActive &&
    (pathname === "/admin" || pathname === "/admin/" || Boolean(pathname?.startsWith("/admin/orders/")));
  const pkdInvoiceActive = Boolean(pathname?.startsWith("/admin/commission-invoice"));
  const statistikaActive = Boolean(pathname?.startsWith("/admin/statistika"));

  return (
    <nav className="flex flex-wrap items-center gap-1 md:flex-col md:items-stretch md:gap-1">
      <Link href="/admin" className={navItemClass(ordersSectionActive)}>
        Pasūtījumi
      </Link>
      <Link href="/admin/konsultacijas" className={navItemClass(consultationsActive)}>
        Konsultācijas
      </Link>
      <Link href="/" className={navItemClass(false)}>
        Uz lapu
      </Link>
      <Link href="/admin/statistika" className={navItemClass(statistikaActive)}>
        Statistika
      </Link>
      <p className="hidden pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-provin-muted)] md:block">
        PKD / AutoDNA
      </p>
      <Link href="/admin/commission-invoice" className={navItemClass(pkdInvoiceActive)}>
        Komisijas rēķins PDF
      </Link>
      <div className="md:pt-1">
        <LogoutButton />
      </div>
      {adminRoot ? (
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
