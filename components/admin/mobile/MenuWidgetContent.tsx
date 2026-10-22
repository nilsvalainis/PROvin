import type { ReactNode } from "react";
import { menuRowsFor, type MenuCatalogItem, type MenuSize } from "@/lib/admin-menu-layout";
import type { ProHomeSummary, ProHomeTile } from "@/lib/admin-pro-home";
import { formatAdminMobileDeadlineTag } from "@/lib/admin-mobile-ds";
import type { IrissMobilePlateStripItem } from "@/lib/iriss-mobile-plate-strip";

export type MenuWidgetData = {
  irissLogistics: number;
  irissMatches: number;
  waybills: IrissMobilePlateStripItem[];
  waybillsLoaded: boolean;
  pro: ProHomeSummary | null;
  openCount: number;
};

function Big({ n, label, tone }: { n: number | null; label: string; tone?: "warn" | "ok" }) {
  return (
    <span className="mw-big">
      <span className="mw-num">{n == null ? "…" : n}</span>
      <span className={`mw-label${tone ? ` mw-${tone}` : ""}`}>{label}</span>
    </span>
  );
}

function deadlineText(tile: ProHomeTile | undefined): string {
  if (!tile || tile.nextDeadlineFromUnix == null) return "";
  return `tuvākais ${formatAdminMobileDeadlineTag(tile.nextDeadlineFromUnix).label.replace(/^Atlikušas /, "")}`;
}

/** Pavadzīmju termiņi: rindu skaits seko izmēram (S 2, M 4, L 6), pārējie kā "+N". */
function WaybillRows({ item, size, data }: { item: MenuCatalogItem; size: MenuSize; data: MenuWidgetData }) {
  const rows = menuRowsFor(item, size);
  if (!data.waybillsLoaded) return <span className="mw-muted">Ielādē…</span>;
  if (data.waybills.length === 0) return <span className="mw-muted">Nav aktīvu numuru</span>;
  const shown = data.waybills.slice(0, rows);
  const rest = data.waybills.length - shown.length;
  return (
    <span className="mw-rows">
      {shown.map((w) => (
        <span key={w.plate} className={`mw-row${w.busy ? " mw-row-busy" : ""}`}>
          <span className="mw-plate">{w.plate}</span>
          <span className="mw-row-val">{w.statusLabel}</span>
        </span>
      ))}
      {rest > 0 ? <span className="mw-more">+{rest}</span> : null}
    </span>
  );
}

export function renderIrissWidget(item: MenuCatalogItem, size: MenuSize, data: MenuWidgetData): ReactNode {
  switch (item.id) {
    case "w-logistika":
      return (
        <>
          <Big n={data.irissLogistics} label="auto loģistikā" />
          {size !== "S" ? <span className="mw-sub">Nākošā un aiznākošā krava, maršruts</span> : null}
        </>
      );
    case "w-pavadzimes":
      return <WaybillRows item={item} size={size} data={data} />;
    case "w-sludinajumi":
      return <Big n={data.irissMatches} label="jauni sakritieni" />;
    case "w-radars":
      return <span className="mw-sub">Atvērt radaru</span>;
    case "w-autoparks":
      return <span className="mw-sub">Auto laukumā</span>;
    default:
      return null;
  }
}

export function renderProWidget(item: MenuCatalogItem, size: MenuSize, data: MenuWidgetData): ReactNode {
  const pro = data.pro;
  switch (item.id) {
    case "w-pro-mini": {
      const t = pro?.orders;
      return (
        <>
          <Big n={t ? t.count : null} label="gaida" />
          {t && t.overdue > 0 ? <span className="mw-warn-line">{t.overdue} kavē</span> : null}
          {size !== "S" && t ? <span className="mw-sub">{deadlineText(t) || "nav termiņu"}</span> : null}
        </>
      );
    }
    case "w-pro-dileri": {
      const t = pro?.dealers;
      return (
        <>
          <Big n={t ? t.count : null} label="gaida" />
          {t && t.overdue > 0 ? <span className="mw-warn-line">{t.overdue} kavē</span> : null}
        </>
      );
    }
    case "w-pro-atrie":
      return <Big n={pro ? data.openCount : null} label={data.openCount > 0 ? "neatbildēti" : "viss atbildēts"} tone={data.openCount > 0 ? "warn" : "ok"} />;
    case "w-pro-rits":
      return <span className="mw-sub">Kas jādara šodien</span>;
    default:
      return null;
  }
}
