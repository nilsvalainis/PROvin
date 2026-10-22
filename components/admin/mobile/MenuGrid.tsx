"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { MenuIcon } from "@/components/admin/mobile/MenuIcons";
import {
  MENU_SIZE_LABEL,
  addMenuEntry,
  defaultMenuLayout,
  menuLayoutStorageKey,
  menuSpan,
  missingMenuItems,
  moveMenuEntry,
  nextMenuSize,
  normalizeMenuLayout,
  parseMenuLayout,
  removeMenuEntry,
  setMenuEntrySize,
  type MenuCatalogItem,
  type MenuLayout,
  type MenuSize,
} from "@/lib/admin-menu-layout";

/** Cik ilgi jātur nospiestu, lai ieslēgtos kārtošana (kā iOS). */
const LONG_PRESS_MS = 420;
/** Ja pirksts pārvietojas vairāk, tā ir ritināšana, nevis nospiešana. */
const MOVE_CANCEL_PX = 10;

type Props = {
  workspace: "iriss" | "pro";
  catalog: MenuCatalogItem[];
  defaultIds: readonly string[];
  /** Skaits nozīmītē: ikonai un arī logrīkam, kas samazināts līdz ikonai. */
  badgeOf: (item: MenuCatalogItem) => number;
  /** Logrīks sarkanā tonī (piem. ir kavētie). */
  alertOf?: (item: MenuCatalogItem) => boolean;
  /** Ja saite atkarīga no datiem (piem. tikai kavētie). Noklusējums: item.href. */
  hrefOf?: (item: MenuCatalogItem) => string;
  renderWidget: (item: MenuCatalogItem, size: MenuSize) => ReactNode;
};

/**
 * iOS stila sākuma režģis: nospied un tur, lai kārtotu, noņemtu vai mainītu izmēru;
 * "+ Pievienot" atver visu, ko vēl nav režģī.
 */
export function MenuGrid({ workspace, catalog, defaultIds, badgeOf, alertOf, hrefOf, renderWidget }: Props) {
  const fallback = useMemo(() => defaultMenuLayout(catalog, defaultIds), [catalog, defaultIds]);
  const byId = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const [layout, setLayout] = useState<MenuLayout>(fallback);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const pressRef = useRef<{ x: number; y: number; timer: number } | null>(null);
  const suppressClickRef = useRef(false);
  const dragIndexRef = useRef(-1);
  const skipNextSyncRef = useRef(false);
  const userChangedRef = useRef(false);
  const edit = (fn: (prev: MenuLayout) => MenuLayout) => {
    userChangedRef.current = true;
    setLayout(fn);
  };
  const storageKey = menuLayoutStorageKey(workspace);

  // Ielādē saglabāto izkārtojumu tikai pēc montāžas (serverī un pārlūkā tas pats HTML, nav hydration atšķirību).
  useEffect(() => {
    let raw: unknown = null;
    try {
      raw = parseMenuLayout(localStorage.getItem(storageKey));
    } catch {
      raw = null;
    }
    setLayout(normalizeMenuLayout(raw, catalog, fallback));
    setReady(true);
    // Servera izkārtojums (kopīgs iPhone un datoram) aizstāj vietējo, ja tāds ir.
    let stop = false;
    void fetch(`/api/admin/menu-layout?ws=${workspace}`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { layout?: unknown } | null) => {
        if (stop || !data || !Array.isArray(data.layout) || data.layout.length === 0) return;
        skipNextSyncRef.current = true;
        setLayout(normalizeMenuLayout(data.layout, catalog, fallback));
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
    // Katalogs un noklusējums nemainās starp renderēšanām; izmaiņa ir apzināta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      // nav krātuves (privātais režīms): izkārtojums paliek tikai šajā sesijā
    }
    // Uz serveri tikai lietotāja izmaiņas (ne pirmo ielādi un ne paša servera atbildi).
    if (skipNextSyncRef.current || !userChangedRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void fetch("/api/admin/menu-layout", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ws: workspace, layout }),
      }).catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(t);
  }, [layout, ready, storageKey, workspace]);

  function cancelPress() {
    if (pressRef.current) window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, id: string, index: number) {
    if (editing) {
      dragIndexRef.current = index;
      setDragId(id);
      const move = (ev: PointerEvent) => {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-menu-idx]") as HTMLElement | null;
        if (!el) return;
        const to = Number(el.dataset.menuIdx);
        if (!Number.isFinite(to) || to === dragIndexRef.current) return;
        const from = dragIndexRef.current;
        dragIndexRef.current = to;
        edit((prev) => moveMenuEntry(prev, from, to));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        dragIndexRef.current = -1;
        setDragId(null);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      return;
    }
    cancelPress();
    const x = e.clientX;
    const y = e.clientY;
    const timer = window.setTimeout(() => {
      suppressClickRef.current = true;
      setEditing(true);
      pressRef.current = null;
      try {
        navigator.vibrate?.(12);
      } catch {
        // nav vibrācijas
      }
    }, LONG_PRESS_MS);
    pressRef.current = { x, y, timer };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const p = pressRef.current;
    if (!p) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_CANCEL_PX) cancelPress();
  }

  function removeItem(id: string) {
    edit((prev) => removeMenuEntry(prev, id));
  }

  function cycleSize(id: string) {
    const item = byId.get(id);
    if (!item) return;
    edit((prev) => {
      const cur = prev.find((e) => e.id === id);
      if (!cur) return prev;
      return setMenuEntrySize(prev, catalog, id, nextMenuSize(item, cur.size));
    });
  }

  const missing = missingMenuItems(layout, catalog);

  return (
    <div className="menu-home">
      {editing ? (
        <div className="menu-edit-bar" role="toolbar" aria-label="Kārtošana">
          <button type="button" className="menu-edit-btn" onClick={() => setAddOpen(true)} disabled={missing.length === 0}>
            + Pievienot
          </button>
          <span className="menu-edit-hint">Velc, lai kārtotu</span>
          <button type="button" className="menu-edit-btn menu-edit-done" onClick={() => setEditing(false)}>
            Gatavs
          </button>
        </div>
      ) : null}

      <div className={`menu-grid${editing ? " is-editing" : ""}`}>
        {layout.map((entry, index) => {
          const item = byId.get(entry.id);
          if (!item) return null;
          const span = menuSpan(entry.size);
          // Logrīks, kas samazināts līdz ikonai, izskatās un uzvedas kā ikona (skaits nozīmītē).
          const isWidget = item.kind === "widget" && entry.size !== "app";
          const badge = isWidget ? 0 : badgeOf(item);
          const alert = Boolean(alertOf?.(item));
          return (
            <div
              key={entry.id}
              data-menu-idx={index}
              className={`menu-tile ${isWidget ? "menu-widget" : "menu-app"}${alert ? " menu-alert" : ""}${dragId === entry.id ? " is-dragging" : ""}`}
              style={{
                gridColumn: `span ${span.cols}`,
                gridRow: `span ${span.rows}`,
                ["--menu-tone" as string]: item.tone,
                animationDelay: `${-((index % 5) * 0.09)}s`,
              }}
              onPointerDown={(e) => onPointerDown(e, entry.id, index)}
              onPointerMove={onPointerMove}
              onPointerUp={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
            >
              <Link
                href={hrefOf ? hrefOf(item) : item.href}
                className="menu-tile-link"
                aria-label={item.title}
                tabIndex={editing ? -1 : 0}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (editing || suppressClickRef.current) {
                    e.preventDefault();
                    suppressClickRef.current = false;
                  }
                }}
              >
                {isWidget ? (
                  <>
                    <span className="menu-widget-head">
                      <MenuIcon name={item.icon} size={14} />
                      {item.title}
                    </span>
                    <span className="menu-widget-body">{renderWidget(item, entry.size)}</span>
                  </>
                ) : (
                  <>
                    <span className="menu-app-icon">
                      <MenuIcon name={item.icon} size={28} />
                    </span>
                    <span className="menu-app-label">{item.title}</span>
                    {badge > 0 ? <span className="menu-badge">{badge > 99 ? "99+" : badge}</span> : null}
                  </>
                )}
              </Link>

              {editing ? (
                <button
                  type="button"
                  className="menu-remove"
                  aria-label={`Noņemt: ${item.title}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeItem(entry.id)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                    <path d="M6 12h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
              {editing && item.sizes.length > 1 ? (
                <button
                  type="button"
                  className="menu-size"
                  aria-label={`Izmērs ${MENU_SIZE_LABEL[entry.size]}, mainīt`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => cycleSize(entry.id)}
                >
                  {MENU_SIZE_LABEL[entry.size]}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {!editing ? <p className="menu-hint">Nospied un tur, lai kārtotu vai pievienotu</p> : null}

      <AdminMobileSheet open={addOpen} title="Pievienot" subtitle="Izvēlies, ko likt sākumā un kādā izmērā" onClose={() => setAddOpen(false)}>
        <ul className="menu-gallery">
          {missing.length === 0 ? <li className="menu-gallery-empty">Viss jau ir sākumā.</li> : null}
          {missing.map((item) => (
            <li key={item.id} className="menu-gallery-row">
              <span className="menu-gallery-icon" style={{ ["--menu-tone" as string]: item.tone }}>
                <MenuIcon name={item.icon} size={20} />
              </span>
              <span className="menu-gallery-text">
                <span className="menu-gallery-title">{item.title}</span>
                <span className="menu-gallery-kind">{item.kind === "widget" ? "Logrīks" : "Ikona"}</span>
              </span>
              <span className="menu-gallery-sizes">
                {item.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="menu-gallery-size"
                    onClick={() => {
                      edit((prev) => addMenuEntry(prev, item, s));
                      setAddOpen(false);
                    }}
                  >
                    {s === "app" ? (item.kind === "widget" ? "Ikona" : "Pievienot") : s}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </AdminMobileSheet>
    </div>
  );
}
