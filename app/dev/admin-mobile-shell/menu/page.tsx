"use client";

import { useMemo, useState } from "react";
import { MenuGrid } from "@/components/admin/mobile/MenuGrid";
import { renderIrissWidget, renderProWidget } from "@/components/admin/mobile/MenuWidgetContent";
import { IRISS_DEFAULT_LAYOUT_IDS, irissMenuCatalog, PRO_DEFAULT_LAYOUT_IDS, proMenuCatalog } from "@/lib/admin-menu-catalog";

/** Vizuālais tests sākuma režģim (bez pieslēgšanās). Nav produkcijas izvēlnē. */
export default function MenuGridTestPage() {
  const [ws, setWs] = useState<"iriss" | "pro">("iriss");
  const iriss = useMemo(() => irissMenuCatalog([], true), []);
  const pro = useMemo(() => proMenuCatalog(), []);
  const data = {
    irissLogistics: 9,
    irissMatches: 25,
    waybills: [
      { plate: "LV-1234", busy: true, hoursLeft: 6, statusLabel: "6 h atlikušas" },
      { plate: "LV-5678", busy: false, hoursLeft: 40, statusLabel: "brīvs" },
      { plate: "LV-9012", busy: true, hoursLeft: 20, statusLabel: "20 h atlikušas" },
    ] as never,
    waybillsLoaded: true,
    pro: {
      orders: { count: 7, overdue: 2, nextDeadlineFromUnix: Math.floor(Date.now() / 1000) - 40 * 3600 },
      dealers: { count: 3, overdue: 0, nextDeadlineFromUnix: null },
    },
    openCount: 4,
  };
  return (
    <div className="menu-gradient-bg min-h-dvh pt-6" data-testid="menu-grid-test">
      <div className="flex items-center justify-between px-4 pb-3">
        <h1 className="text-[34px] font-bold tracking-tight">{ws === "iriss" ? "IRISS" : "PRO"}</h1>
        <button type="button" className="am-ws-switch" onClick={() => setWs(ws === "iriss" ? "pro" : "iriss")} data-ws={ws}>
          <span className={ws === "iriss" ? "on" : ""}>IRISS</span>
          <span className={ws === "pro" ? "on" : ""}>PRO</span>
        </button>
      </div>
      {ws === "iriss" ? (
        <MenuGrid
          key="iriss"
          workspace="iriss"
          catalog={iriss}
          defaultIds={IRISS_DEFAULT_LAYOUT_IDS}
          badgeOf={(item) => (item.badge === "irissMatches" ? 25 : item.badge === "irissLogistics" ? 9 : item.badge === "waybills" ? 2 : 0)}
          renderWidget={(item, size) => renderIrissWidget(item, size, data)}
        />
      ) : (
        <MenuGrid
          key="pro"
          workspace="pro"
          catalog={pro}
          defaultIds={PRO_DEFAULT_LAYOUT_IDS}
          badgeOf={(item) => (item.badge === "orders" ? 7 : item.badge === "fast" ? 4 : 0)}
          renderWidget={(item, size) => renderProWidget(item, size, data)}
        />
      )}
    </div>
  );
}
