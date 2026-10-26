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
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  IRISS_SECTION_LABELS,
  irissSectionMeta,
  isWaybillOnlyStaff,
  staffNavSections,
  staffTabbarItems,
  type IrissSection,
} from "@/lib/staff-roles";

const SECTION_ICON: Record<IrissSection, LucideIcon> = {
  pasutijumi: Car,
  sludinajumi: List,
  radars: Radar,
  logistika: Map,
  gramatvede: Wallet,
  serviss: Wrench,
  pavadzimes: FileText,
  vin: ScanLine,
  atskaite: CalendarRange,
  ap_pamatdati: Warehouse,
  ap_iegade: Warehouse,
  ap_serviss: Warehouse,
  ap_izdevumi: Warehouse,
  ap_cenu_lapa: Warehouse,
  ap_summas: Warehouse,
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}

export function IrissStaffAppShell({
  name,
  sections,
  autoparksV2Visible = false,
  children,
}: {
  name: string;
  sections: IrissSection[];
  /** Autoparks v2 darbiniekiem ieslēgts (karogs); citādi `ap_*` navigācijā nerāda. */
  autoparksV2Visible?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const home = "/admin/iriss";
  const navSections = staffNavSections(sections, autoparksV2Visible);
  const tabItems = staffTabbarItems(sections, autoparksV2Visible);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
    router.refresh();
  }

  // Partneris (tikai Pavadzīmes): nekādas navigācijas - Arhīvs un Iziet ir pašā sākumskatā.
  // min-h-dvh (nevis h-dvh): dokuments ritina (admin-ios-theme main overflow-y: visible), tāpēc fons aug līdz ar saturu
  // un garā saraksta apakšā neparādās tumšais body fons (j22).
  if (isWaybillOnlyStaff(sections)) {
    return (
      <div className="iriss-admin-scope flex min-h-dvh flex-col text-[#111827]">
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
      </div>
    );
  }

  // Telefonā ritina dokuments (admin-ios-theme main overflow-y: visible), tāpēc čaula ir min-h (nevis h-dvh, kas
  // vecākā iOS Safari atstāja joslu ekrāna vidū virs laukiem un zem tās tumšo body fonu); apakšējā josla ir fixed.
  // Datorā (md+) paliek pilna augstuma rinda ar sānu joslu (j69).
  return (
    <div data-iriss-staff-shell="" className="iriss-admin-scope iriss-staff-shell flex flex-col text-[#111827] md:h-dvh md:flex-row">
      <aside data-iriss-nav="" className="relative hidden w-[220px] shrink-0 flex-col border-r border-[#ececf2] bg-[#F4F6F9] px-3 py-4 md:flex">
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
              {navSections.length} {navSections.length === 1 ? "sadaļa" : "sadaļas"}
            </p>
          </div>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1">
          <Link
            href={home}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-medium ${
              pathname === home || pathname === `${home}/` ? "bg-[#ececf3] text-[#111827]" : "text-[#4b5563] hover:bg-white"
            }`}
          >
            Sākums
          </Link>
          {navSections.map((id) => {
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
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
        <nav
          data-iriss-staff-tabbar=""
          className="iriss-staff-tabbar fixed inset-x-0 bottom-0 z-[30] border-t border-[#ececf2] bg-[#F4F6F9] px-2 pt-1 pb-[max(20px,calc(8px+env(safe-area-inset-bottom)))] md:hidden"
        >
          <div className="mx-auto flex max-w-lg items-stretch gap-0.5">
            {tabItems.map((item) => {
              if (item.kind === "home") {
                const active = pathname === item.href || pathname === `${item.href}/`;
                return (
                  <Link
                    key="home"
                    href={item.href}
                    className={`iriss-staff-tab flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium ${
                      active ? "bg-[#ececf3] text-[#111827]" : "text-[#6b7280]"
                    }`}
                  >
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              }
              if (item.kind === "logout") {
                return (
                  <button
                    key="logout"
                    type="button"
                    onClick={() => void logout()}
                    className="iriss-staff-tab flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-[#6b7280]"
                  >
                    <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {item.label}
                  </button>
                );
              }
              const Icon = SECTION_ICON[item.id];
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`iriss-staff-tab flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium ${
                    active ? "bg-[#ececf3] text-[#111827]" : "text-[#6b7280]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="max-w-full truncate whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
