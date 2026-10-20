"use client";

import {
  CalendarRange,
  Car,
  FileText,
  List,
  LogOut,
  Map,
  Radar,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IRISS_SECTION_LABELS, irissSectionMeta, type IrissSection } from "@/lib/staff-roles";

const SECTION_ICON: Record<IrissSection, LucideIcon> = {
  pasutijumi: Car,
  sludinajumi: List,
  radars: Radar,
  logistika: Map,
  pavadzimes: FileText,
  vin: ScanLine,
  atskaite: CalendarRange,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

export function IrissStaffAppShell({
  name,
  sections,
  children,
}: {
  name: string;
  sections: IrissSection[];
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const home = sections[0] ? irissSectionMeta(sections[0]).pagePrefixes[0] : "/admin/iriss/logistika";

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="iriss-admin-scope flex h-dvh flex-col bg-[#F4F6F9] text-[#111827] md:flex-row">
      <aside className="relative hidden w-[220px] shrink-0 flex-col border-r border-[#ececf2] bg-[#F4F6F9] px-3 py-4 md:flex">
        <div className="mb-5 flex items-center gap-2 px-2">
          <span className="text-[15px] font-semibold tracking-tight">IRISS</span>
          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d5bd9]">
            IRISS
          </span>
        </div>
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EEF2FF] text-[11px] font-semibold text-[#3d5bd9]">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{name}</p>
            <p className="text-[11px] text-[#9aa3b2]">
              {sections.length} {sections.length === 1 ? "sadaļa" : "sadaļas"}
            </p>
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1">
          {sections.map((id) => {
            const href = irissSectionMeta(id).pagePrefixes[0] ?? home;
            const Icon = SECTION_ICON[id];
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={id}
                href={href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-medium ${
                  active ? "bg-[#ececf3] text-[#111827]" : "text-[#4b5563] hover:bg-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {IRISS_SECTION_LABELS[id]}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-[#111827] hover:bg-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Iziet
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
        <nav className="relative z-10 border-t border-[#ececf2] bg-[#F4F6F9] px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 md:hidden">
          <div className="mx-auto flex max-w-md items-stretch gap-1 rounded-full bg-white p-1 shadow-sm">
            {sections.map((id) => {
              const href = irissSectionMeta(id).pagePrefixes[0] ?? home;
              const Icon = SECTION_ICON[id];
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={id}
                  href={href}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-medium ${
                    active ? "bg-[#ececf3] text-[#111827]" : "text-[#6b7280]"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">{IRISS_SECTION_LABELS[id]}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-medium text-[#6b7280]"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Iziet
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
