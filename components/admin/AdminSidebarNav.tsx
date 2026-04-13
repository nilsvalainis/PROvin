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

  const ordersSectionActive =
    pathname === "/admin" || pathname === "/admin/" || Boolean(pathname?.startsWith("/admin/orders/"));
  const demoHubActive = Boolean(pathname && /\/demo\/?$/.test(pathname));
  const staticDemoActive = Boolean(pathname?.includes("static-concepts"));
  const marketingHeroDemoActive = Boolean(pathname?.includes("marketing-hero-concepts"));

  return (
    <nav className="flex flex-wrap items-center gap-1 md:flex-col md:items-stretch md:gap-1">
      <Link href="/admin" className={navItemClass(ordersSectionActive)}>
        Pasūtījumi
      </Link>
      <Link href="/" className={navItemClass(false)}>
        Uz lapu
      </Link>
      <p className="hidden pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-provin-muted)] md:block">
        Dizaina demo
      </p>
      <Link href="/demo" className={navItemClass(demoHubActive)}>
        Demo studija
      </Link>
      <Link href="/demo/static-concepts" className={navItemClass(staticDemoActive)}>
        Statiskie HTML (30)
      </Link>
      <Link href="/demo/marketing-hero-concepts" className={navItemClass(marketingHeroDemoActive)}>
        5 mārketinga hero
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
