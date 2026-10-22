"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { MenuGrid } from "@/components/admin/mobile/MenuGrid";
import { renderIrissWidget } from "@/components/admin/mobile/MenuWidgetContent";
import { IRISS_DEFAULT_LAYOUT_IDS, irissMenuCatalog } from "@/lib/admin-menu-catalog";
import { IrissWaybillGauges } from "@/components/admin/IrissWaybillGauges";
import { useIrissWaybillPlateStrip } from "@/components/admin/useIrissWaybillPlateStrip";
import {
  cheapIrissMenuCount,
  IRISS_DESKTOP_MEDIA,
  irissDesktopHomeHref,
  irissMobileMenuItemsFor,
  type IrissMobileMenuItem,
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
  const catalog = useMemo(() => irissMenuCatalog(sections, isAdmin), [sections, isAdmin]);
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
      <AdminMobileTopBar title="IRISS" />
      <div className="md:hidden">
        {canReadWaybills ? (
          <div className="px-4">
            <IrissWaybillGauges />
          </div>
        ) : null}
        <MenuGrid
          workspace="iriss"
          catalog={catalog}
          defaultIds={IRISS_DEFAULT_LAYOUT_IDS}
          badgeOf={(item) => (item.badge ? cheapIrissMenuCount({ badge: item.badge } as IrissMobileMenuItem, counts) : 0)}
          renderWidget={(item, size) =>
            renderIrissWidget(item, size, {
              irissLogistics: badges.irissLogistics,
              irissMatches: badges.irissMatches,
              waybills: plates.items,
              waybillsLoaded: plates.loaded,
              pro: null,
              openCount: 0,
            })
          }
        />
      </div>
      {items.length === 0 ? (
        <p className="hidden px-6 py-8 text-[14px] text-[var(--label-secondary,#5e636e)] md:block">Nav pieejamu sadaļu.</p>
      ) : null}
    </div>
  );
}
