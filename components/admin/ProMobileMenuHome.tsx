"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminPushToggle } from "@/components/admin/AdminPushToggle";
import { MenuGrid } from "@/components/admin/mobile/MenuGrid";
import { renderProWidget } from "@/components/admin/mobile/MenuWidgetContent";
import { PRO_DEFAULT_LAYOUT_IDS, proMenuCatalog } from "@/lib/admin-menu-catalog";
import type { MenuCatalogItem, MenuLayout } from "@/lib/admin-menu-layout";
import { ADMIN_ORDERS_DEADLINE_PARAM } from "@/lib/admin-orders-deadline-filter";
import type { ProHomeSummary } from "@/lib/admin-pro-home";

type Counts = { proHome: ProHomeSummary; openCount: number; unseenCount: number; activeCount: number };

const DESKTOP_MQ = "(min-width: 768px)";

/** PRO sākums (3.0): logrīki un ikonas, ko var kārtot un izmērot. Datorā uzreiz Pasūtījumi. */
export function ProMobileMenuHome({ initialLayout }: { initialLayout?: MenuLayout | null } = {}) {
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

  // Skaitļi atjaunojas paši: atgriežoties lietotnē un ik minūti, kamēr lapa atvērta.
  useEffect(() => {
    let off = false;
    const load = () =>
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
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => {
      off = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  const badgeOf = (item: MenuCatalogItem): number => {
    if (!counts) return 0;
    switch (item.id) {
      case "w-pro-mini":
        return counts.proHome.orders.count;
      case "w-pro-dileri":
        return counts.proHome.dealers.count;
      case "w-pro-atrie":
        return counts.openCount;
      case "w-pro-ienemumi":
        return counts.proHome.today?.count ?? 0;
    }
    return !item.badge ? 0 : item.badge === "orders" ? counts.activeCount : item.badge === "fast" ? counts.openCount : counts.unseenCount;
  };

  /** Sarkans, ja ir kavētie. */
  const alertOf = (item: MenuCatalogItem): boolean =>
    Boolean(
      counts &&
        ((item.id === "w-pro-mini" && counts.proHome.orders.overdue > 0) ||
          (item.id === "w-pro-dileri" && counts.proHome.dealers.overdue > 0)),
    );

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
        initialLayout={initialLayout}
        badgeOf={badgeOf}
        alertOf={alertOf}
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
