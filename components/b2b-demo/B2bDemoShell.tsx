"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { B2B_DEMO_APP_PREFIX } from "@/lib/b2b-demo-host";
import type { B2bDemoRole } from "@/lib/b2b-demo-types";

const ACCENT = "#F26522";

function navClass(active: boolean) {
  return active
    ? "inline-flex min-h-9 items-center rounded-lg px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-black"
    : "inline-flex min-h-9 items-center rounded-lg px-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600 transition hover:text-black";
}

type Props = {
  children: ReactNode;
  tenantName: string;
  userName: string;
  role: B2bDemoRole;
};

export function B2bDemoShell({ children, tenantName, userName, role }: Props) {
  const pathname = usePathname() || "";
  const base = B2B_DEMO_APP_PREFIX;
  const items = [
    { href: `${base}/pasutijumi`, label: "Pasūtījumi", match: `${base}/pasutijumi` },
    { href: `${base}/list`, label: "Klientu filtri", match: `${base}/list` },
    { href: `${base}/radars`, label: "Radars", match: `${base}/radars` },
    { href: `${base}/izsoles`, label: "Izsoļu sesijas", match: `${base}/izsoles` },
    { href: `${base}/settings`, label: "Iestatījumi", match: `${base}/settings` },
    ...(role === "owner" ? [{ href: `${base}/users`, label: "Lietotāji", match: `${base}/users` }] : []),
  ];

  async function logout() {
    await fetch("/api/b2b-demo/logout", { method: "POST", credentials: "include" });
    window.location.href = `${base}/login`;
  }

  return (
    <div className="min-h-dvh bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
              IRISS B2B
            </p>
            <p className="text-sm font-semibold">{tenantName}</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {userName}{" "}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase">
                {role === "owner" ? "īpašnieks" : "darbinieks"}
              </span>
            </span>
            <button type="button" onClick={() => void logout()} className="text-[13px] font-medium text-slate-500 hover:text-black">
              Iziet
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-1 px-3 pb-2">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className={navClass(pathname.startsWith(item.match))}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
