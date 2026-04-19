"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAdminNavInteraction } from "@/components/admin/AdminNavInteractionContext";

function navItemClass(active: boolean) {
  const base =
    "inline-flex w-full touch-manipulation select-none items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-[transform,colors,opacity] active:scale-[0.98] active:opacity-90 motion-reduce:transition-none motion-reduce:active:scale-100";
  if (active) {
    return `${base} bg-[var(--color-provin-accent-soft)] font-semibold text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/15`;
  }
  return `${base} font-medium text-[var(--color-apple-text)] hover:bg-slate-100/90`;
}

function pendingRing(pending: boolean) {
  return pending ? "ring-2 ring-[var(--color-provin-accent)]/35 ring-offset-1 ring-offset-white" : "";
}

export function AdminSidebarNav({ baseUrl }: { baseUrl?: string }) {
  const pathname = usePathname();
  const adminRoot = baseUrl ? `${baseUrl}/admin` : "";
  const navIx = useAdminNavInteraction();

  const consultationsActive = Boolean(pathname?.startsWith("/admin/konsultacijas"));
  const sakumsActive =
    !consultationsActive &&
    (pathname === "/admin" || pathname === "/admin/" || Boolean(pathname?.startsWith("/admin/orders/")));
  const rekiniActive = Boolean(pathname?.startsWith("/admin/commission-invoice"));

  return (
    <nav className="flex flex-wrap items-center gap-1 md:flex-col md:items-stretch md:gap-1">
      <Link
        href="/admin"
        className={`${navItemClass(sakumsActive)} ${pendingRing(Boolean(navIx?.isPending("/admin")))}`}
        aria-busy={navIx?.isPending("/admin") ? true : undefined}
        onClick={() => navIx?.beginNav("/admin")}
      >
        <span className="min-w-0">Sākums</span>
        {navIx?.isPending("/admin") ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" strokeWidth={2.5} aria-hidden />
        ) : null}
      </Link>
      <Link
        href="/admin/konsultacijas"
        className={`${navItemClass(consultationsActive)} ${pendingRing(Boolean(navIx?.isPending("/admin/konsultacijas")))}`}
        aria-busy={navIx?.isPending("/admin/konsultacijas") ? true : undefined}
        onClick={() => navIx?.beginNav("/admin/konsultacijas")}
      >
        <span className="min-w-0">Konsultācijas</span>
        {navIx?.isPending("/admin/konsultacijas") ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" strokeWidth={2.5} aria-hidden />
        ) : null}
      </Link>
      <Link
        href="/admin/commission-invoice"
        className={`${navItemClass(rekiniActive)} ${pendingRing(Boolean(navIx?.isPending("/admin/commission-invoice")))}`}
        aria-busy={navIx?.isPending("/admin/commission-invoice") ? true : undefined}
        onClick={() => navIx?.beginNav("/admin/commission-invoice")}
      >
        <span className="min-w-0">RĒĶINI</span>
        {navIx?.isPending("/admin/commission-invoice") ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-80" strokeWidth={2.5} aria-hidden />
        ) : null}
      </Link>
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
