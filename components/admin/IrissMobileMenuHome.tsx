"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminMobileCountBadge, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { IrissPavadzimesPlateStrip } from "@/components/admin/IrissPavadzimesPlateStrip";
import { useIrissWaybillPlateStrip } from "@/components/admin/useIrissWaybillPlateStrip";
import {
  cheapIrissMenuCount,
  irissMobileMenuGroups,
  irissMobileMenuItemsFor,
} from "@/lib/iriss-mobile-menu";
import type { IrissSection } from "@/lib/staff-roles";

function useCheapIrissBadgeCounts(enabled: boolean): { irissMatches: number; irissLogistics: number } {
  const [counts, setCounts] = useState({ irissMatches: 0, irissLogistics: 0 });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch("/api/admin/badges", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          irissMatchCount?: number;
          irissLogisticsCount?: number;
        } | null;
        if (cancelled || !res.ok || !json) return;
        setCounts({
          irissMatches: Number(json.irissMatchCount) || 0,
          irissLogistics: Number(json.irissLogisticsCount) || 0,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return counts;
}

export function IrissMobileMenuHome({
  sections,
  isAdmin,
}: {
  sections: readonly IrissSection[];
  isAdmin: boolean;
}) {
  const items = irissMobileMenuItemsFor(sections, isAdmin);
  const groups = irissMobileMenuGroups(items);
  const canReadWaybills = isAdmin || sections.includes("pavadzimes");
  const badges = useCheapIrissBadgeCounts(isAdmin);
  const plates = useIrissWaybillPlateStrip(canReadWaybills);
  const counts = {
    irissMatches: badges.irissMatches,
    irissLogistics: badges.irissLogistics,
    waybills: plates.busyCount,
  };

  return (
    <div className="iriss-mobile-menu-home pb-4">
      <AdminMobileTopBar title="IRISS" subtitle="Izvēlies sadaļu. Dati ielādējas tikai pēc pieskāriena." />
      <div className="px-4 md:hidden">
        {canReadWaybills ? <IrissPavadzimesPlateStrip enabled embedded /> : null}
        <div className="flex flex-col gap-3 pt-3">
          {groups.map((group) => (
            <div key={group[0]!.id} className="overflow-hidden rounded-[14px] bg-[var(--surface,#fff)] shadow-[var(--am-card-shadow)]">
              {group.map((item) => {
                const n = cheapIrissMenuCount(item, counts);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="admin-nav-link flex min-h-11 items-center gap-3 border-b border-[var(--line,#e5e5ea)] px-4 last:border-b-0"
                  >
                    <AdminMobileIcon name={item.icon} className="h-5 w-5 text-[var(--label-secondary)]" />
                    <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[var(--label)]">{item.label}</span>
                    {n > 0 ? <AdminMobileCountBadge n={n} /> : null}
                    <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--am-ink3)]" />
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="hidden px-6 py-8 md:block">
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--label,#0b0c10)]">IRISS</h1>
        <p className="mt-1 text-[14px] text-[var(--label-secondary,#5e636e)]">Izvēlies sadaļu sānjoslā vai zemāk.</p>
        <div className="mt-6 grid max-w-xl grid-cols-1 gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex min-h-11 items-center justify-between rounded-[10px] bg-[var(--surface,#fff)] px-4 text-[15px] font-medium text-[var(--label,#0b0c10)]"
            >
              {item.label}
              <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--am-ink3)]" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
