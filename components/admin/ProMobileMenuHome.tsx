"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminPushToggle } from "@/components/admin/AdminPushToggle";
import { MenuGrid } from "@/components/admin/mobile/MenuGrid";
import { renderProWidget } from "@/components/admin/mobile/MenuWidgetContent";
import { PRO_DEFAULT_LAYOUT_IDS, proMenuCatalog } from "@/lib/admin-menu-catalog";
import type { MenuCatalogItem } from "@/lib/admin-menu-layout";
import { ADMIN_ORDERS_DEADLINE_PARAM } from "@/lib/admin-orders-deadline-filter";
import type { ProHomeSummary } from "@/lib/admin-pro-home";

type Counts = { proHome: ProHomeSummary; openCount: number; unseenCount: number; activeCount: number };

const DESKTOP_MQ = "(min-width: 768px)";

/** PRO sākums (3.0): logrīki un ikonas, ko var kārtot un izmērot. Datorā uzreiz Pasūtījumi. */
export function ProMobileMenuHome() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);
  const catalog = useMemo(() => proMenuCatalog(), []);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const go = () => {
      if (mq.matches) router.replace("/admin/dashboard");
    };
    go();
    mq.addEventListener("change", go);
    return () => mq.removeEventListener("change", go);
  }, [router]);

  useEffect(() => {
    let off = false;
    void fetch("/api/admin/badges", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: Partial<Counts> | null) => {
        if (off || !json?.proHome) return;
        setCounts({
          proHome: json.proHome,
          openCount: Number(json.openCount) || 0,
          unseenCount: Number(json.unseenCount) || 0,
          activeCount: Number(json.activeCount) || 0,
        });
      })
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, []);

  const badgeOf = (item: MenuCatalogItem) =>
    !counts || !item.badge
      ? 0
      : item.badge === "orders"
        ? counts.activeCount
        : item.badge === "fast"
          ? counts.openCount
          : counts.unseenCount;

  /** Ja ir kavētie, MINI logrīks atver tikai tos (augšā poga "Rādīt visus"). */
  const hrefOf = (item: MenuCatalogItem) =>
    item.id === "w-pro-mini" && counts && counts.proHome.orders.overdue > 0
      ? `/admin/dashboard?${ADMIN_ORDERS_DEADLINE_PARAM}=nokavets`
      : item.href;

  return (
    <div className="pro-mobile-menu-home menu-gradient-bg pb-4 md:hidden">
      <AdminMobileTopBar title="PRO" />
      <MenuGrid
        workspace="pro"
        catalog={catalog}
        defaultIds={PRO_DEFAULT_LAYOUT_IDS}
        badgeOf={badgeOf}
        hrefOf={hrefOf}
        renderWidget={(item, size) =>
          renderProWidget(item, size, {
            irissLogistics: 0,
            irissMatches: 0,
            waybills: [],
            waybillsLoaded: true,
            pro: counts?.proHome ?? null,
            openCount: counts?.openCount ?? 0,
          })
        }
      />
      <div className="px-4 pt-4">
        <AdminPushToggle />
      </div>
    </div>
  );
}
