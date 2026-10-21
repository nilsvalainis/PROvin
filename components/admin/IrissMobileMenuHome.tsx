"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminMobileCountBadge, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { IrissWaybillGauges } from "@/components/admin/IrissWaybillGauges";
import { useIrissWaybillPlateStrip } from "@/components/admin/useIrissWaybillPlateStrip";
import {
  cheapIrissMenuCount,
  IRISS_DESKTOP_MEDIA,
  irissDesktopHomeHref,
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

/** Izvēlne ir tikai telefonam. Datorā (md+) uzreiz atver pirmo sadaļu (parasti Pasūtījumi). */
function useDesktopRedirect(href: string | null) {
  const router = useRouter();
  useEffect(() => {
    if (!href) return;
    const mq = window.matchMedia(IRISS_DESKTOP_MEDIA);
    const go = () => {
      if (mq.matches) router.replace(href);
    };
    go();
    mq.addEventListener("change", go);
    return () => mq.removeEventListener("change", go);
  }, [href, router]);
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
  useDesktopRedirect(irissDesktopHomeHref(items));
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
        {canReadWaybills ? <IrissWaybillGauges /> : null}
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
      {items.length === 0 ? (
        <p className="hidden px-6 py-8 text-[14px] text-[var(--label-secondary,#5e636e)] md:block">Nav pieejamu sadaļu.</p>
      ) : null}
    </div>
  );
}
