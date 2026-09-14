"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { TRAFFIC_HEADER_STRIP_CLASS, type TrafficFillLevel } from "@/lib/admin-block-traffic-status";

function accordionStorageKey(sessionId: string, blockId: string) {
  return `provin-admin-ui-accordion-v1-${sessionId}-${blockId}`;
}

function CaretIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 opacity-50 transition-opacity duration-200 hover:opacity-100 group-hover:opacity-100 ${expanded ? "rotate-0" : "-rotate-90"}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Universāla admin bloka sakļaušana — tikai UI; neietekmē PDF ne saglabāto JSON.
 * Kreisajā pusē paliek `header` (t.sk. luksofors, ja iekš AdminSourceBlockHeader).
 * Labajā — PDF rīki un bultiņa.
 */
export function AdminCollapsibleShell({
  sessionId,
  blockId,
  trafficLevel,
  defaultCollapsed = false,
  disableCollapse = true,
  header,
  headerActions,
  children,
  className = "",
}: {
  sessionId: string;
  blockId: string;
  /** Ja norādīts, papildus kreisā „luksofora” josla uz visa apvalka (meta blokiem bez iekšējā header). */
  trafficLevel?: TrafficFillLevel;
  defaultCollapsed?: boolean;
  /** Ja true — bloks vienmēr atvērts, bez sakļaušanas (wizard / bez akordeoniem). */
  disableCollapse?: boolean;
  header: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  /**
   * Telefonā bloku var izvērst pilnekrānā. Apzināti maināma tikai apvalka klase,
   * nevis koka pozīcija: tā bloka iekšējais stāvoklis un fokuss saglabājas.
   */
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    // Ja logs izaug līdz darbvirsmas platumam, pilnekrāns vairs nav pareizais režīms.
    const onResize = () => {
      if (window.innerWidth >= 768) setFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [fullscreen]);

  const fullscreenShellClass = fullscreen
    ? "max-md:fixed max-md:inset-0 max-md:z-[65] max-md:m-0 max-md:overflow-y-auto max-md:rounded-none max-md:bg-[var(--admin-surface-elevated)] max-md:pb-28 max-md:shadow-none"
    : "";

  const fullscreenToggle = (
    <button
      type="button"
      data-accordion-no-toggle
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/40 hover:text-slate-800 md:hidden"
      aria-label={fullscreen ? "Aizvērt pilnekrānu" : "Atvērt bloku pilnekrānā"}
      aria-pressed={fullscreen}
      onClick={(e) => {
        e.stopPropagation();
        setFullscreen((v) => !v);
      }}
    >
      {fullscreen ? (
        <Minimize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      ) : (
        <Maximize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );

  useEffect(() => {
    if (disableCollapse) return;
    try {
      const raw = localStorage.getItem(accordionStorageKey(sessionId, blockId));
      if (raw === "1") setCollapsed(true);
      else if (raw === "0") setCollapsed(false);
      else setCollapsed(defaultCollapsed);
    } catch {
      setCollapsed(defaultCollapsed);
    }
  }, [sessionId, blockId, defaultCollapsed, disableCollapse]);

  useEffect(() => {
    if (disableCollapse) return;
    try {
      localStorage.setItem(accordionStorageKey(sessionId, blockId), collapsed ? "1" : "0");
    } catch {
      /* quota */
    }
  }, [sessionId, blockId, collapsed, disableCollapse]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const onHeaderClick = useCallback(
    (e: React.MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("a, button, input, textarea, select, label, [data-accordion-no-toggle]")) return;
      toggle();
    },
    [toggle],
  );

  const strip = trafficLevel ? TRAFFIC_HEADER_STRIP_CLASS[trafficLevel] : "";

  if (disableCollapse) {
    return (
      <div
        className={`overflow-hidden rounded-xl border-0 bg-transparent shadow-[0_2px_22px_rgba(15,23,42,0.055)] ${strip} ${fullscreenShellClass} ${className}`}
      >
        <div
          className={`flex min-w-0 flex-wrap items-start justify-between gap-2 px-2 py-2 ${
            fullscreen
              ? "max-md:sticky max-md:top-0 max-md:z-10 max-md:border-b max-md:border-[var(--admin-border-subtle)] max-md:bg-[var(--admin-surface-elevated)]"
              : ""
          }`}
        >
          <div className="min-w-0 flex-1">{header}</div>
          <div
            data-accordion-no-toggle
            className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1"
          >
            {headerActions}
            {fullscreenToggle}
          </div>
        </div>
        <div className="border-t-0 px-2 pb-2 pt-0">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border-0 bg-transparent shadow-[0_2px_22px_rgba(15,23,42,0.055)] ${strip} ${fullscreenShellClass} ${className}`}
    >
      <div
        className={`flex min-w-0 items-stretch gap-0 ${
          fullscreen
            ? "max-md:sticky max-md:top-0 max-md:z-10 max-md:border-b max-md:border-[var(--admin-border-subtle)] max-md:bg-[var(--admin-surface-elevated)]"
            : ""
        }`}
      >
        <div
          className="min-w-0 flex-1 cursor-pointer select-none"
          onClick={onHeaderClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={!collapsed}
        >
          {header}
        </div>
        <div
          data-accordion-no-toggle
          className="group flex shrink-0 flex-col items-stretch justify-center gap-0.5 border-l-0 bg-transparent px-1.5 py-1"
        >
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 opacity-70 transition-opacity hover:opacity-100">
            {headerActions}
            {fullscreenToggle}
          </div>
          <button
            type="button"
            data-accordion-no-toggle
            className={`flex h-7 w-full min-w-[1.75rem] items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/40 hover:text-slate-800 ${
              fullscreen ? "max-md:hidden" : ""
            }`}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Atvērt bloku" : "Sakļaut bloku"}
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
          >
            <CaretIcon expanded={!collapsed} />
          </button>
        </div>
      </div>
      {/* Pilnekrānā bloks vienmēr ir atvērts, citādi operators redzētu tukšu ekrānu. */}
      {!collapsed || fullscreen ? <div className="border-t-0 pt-0">{children}</div> : null}
    </div>
  );
}
