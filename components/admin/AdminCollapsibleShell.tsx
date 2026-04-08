"use client";

import { useCallback, useEffect, useState } from "react";
import { TRAFFIC_HEADER_STRIP_CLASS, type TrafficFillLevel } from "@/lib/admin-block-traffic-status";

function accordionStorageKey(sessionId: string, blockId: string) {
  return `provin-admin-ui-accordion-v1-${sessionId}-${blockId}`;
}

function CaretIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
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
  header: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(accordionStorageKey(sessionId, blockId));
      if (raw === "1") setCollapsed(true);
      else if (raw === "0") setCollapsed(false);
      else setCollapsed(defaultCollapsed);
    } catch {
      setCollapsed(defaultCollapsed);
    }
  }, [sessionId, blockId, defaultCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(accordionStorageKey(sessionId, blockId), collapsed ? "1" : "0");
    } catch {
      /* quota */
    }
  }, [sessionId, blockId, collapsed]);

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

  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm ${strip} ${className}`}>
      <div className="flex min-w-0 items-stretch gap-0">
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
          className="flex shrink-0 flex-col items-stretch justify-center gap-1 border-l border-slate-200/80 bg-slate-50/50 px-2 py-1.5"
        >
          {headerActions ? (
            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">{headerActions}</div>
          ) : null}
          <button
            type="button"
            data-accordion-no-toggle
            className="flex h-8 w-full min-w-[2rem] items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/50 hover:text-slate-900"
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
      {!collapsed ? <div className="border-t border-slate-100/90">{children}</div> : null}
    </div>
  );
}
