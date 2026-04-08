"use client";

import type { ReactNode } from "react";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";

const DOT: Record<TrafficFillLevel, string> = {
  empty: "bg-[#FF4D4D]",
  partial: "bg-[#FFC107]",
  complete: "bg-[#4CAF50]",
};

export type AdminProgressNavItem = {
  id: string;
  label: string;
  level: TrafficFillLevel;
  /** false — PDF izslēgts (blāvs). */
  pdfIncluded?: boolean;
};

function scrollToSection(id: string) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function NavButton({ item }: { item: AdminProgressNavItem }) {
  const faded = item.pdfIncluded === false;
  return (
    <button
      type="button"
      onClick={() => scrollToSection(item.id)}
      className={`flex w-full min-w-0 items-start gap-2 rounded-lg px-1.5 py-1 text-left text-[10px] font-medium leading-snug transition hover:bg-slate-100/90 ${
        faded ? "text-[var(--color-provin-muted)] opacity-45" : "text-[var(--color-apple-text)]"
      }`}
    >
      <span
        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${faded ? "opacity-40" : ""} ${DOT[item.level]}`}
        aria-hidden
      />
      <span className="min-w-0 break-words">{item.label}</span>
    </button>
  );
}

/** Vertikālā josla ar „luksoforu” un opcionālu kopsavilkuma paneli — tikai ≥1280px. */
export function AdminOrderProgressSidebar({
  items,
  summaryPanel,
}: {
  items: AdminProgressNavItem[];
  /** Integrēts zem Progress — viens sticky bloks. */
  summaryPanel?: ReactNode;
}) {
  const hasNav = items.length > 0;
  if (!hasNav && !summaryPanel) return null;

  if (!summaryPanel) {
    if (!hasNav) return null;
    return (
      <nav
        className="sticky top-3 z-10 hidden max-h-[calc(100dvh-1.5rem)] w-[10.5rem] shrink-0 overflow-y-auto overscroll-contain rounded-xl bg-white/90 py-2 pl-1 pr-1 shadow-[0_2px_22px_rgba(15,23,42,0.055)] ring-1 ring-slate-200/70 xl:block"
        aria-label="Sadaļu navigācija"
      >
        <p className="mb-1.5 px-1.5 text-[9px] font-bold uppercase tracking-wide text-[var(--color-provin-muted)]">
          Progress
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <NavButton item={item} />
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <div className="sticky top-3 z-10 hidden min-h-0 w-[12rem] shrink-0 flex-col xl:flex">
      <div className="flex max-h-[calc(100dvh-1.5rem)] min-h-0 w-full flex-col overflow-hidden rounded-xl bg-white/90 shadow-[0_2px_22px_rgba(15,23,42,0.055)] ring-1 ring-slate-200/70 backdrop-blur-sm">
        {hasNav ? (
          <nav
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 pl-1 pr-1"
            aria-label="Sadaļu navigācija"
          >
            <p className="mb-1.5 px-1.5 text-[9px] font-bold uppercase tracking-wide text-[var(--color-provin-muted)]">
              Progress
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.id}>
                  <NavButton item={item} />
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {summaryPanel && hasNav ? <div className="shrink-0 border-t border-slate-200/60" /> : null}
        {summaryPanel ? <div className="min-h-0 shrink-0 bg-white/95 p-2">{summaryPanel}</div> : null}
      </div>
    </div>
  );
}

/** Mobilā / &lt;1280px horizontāla josla. */
export function AdminOrderProgressNavStrip({ items }: { items: AdminProgressNavItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      className="sticky top-0 z-20 -mx-1 mb-2 flex gap-1 overflow-x-auto overscroll-x-contain rounded-xl bg-slate-50/95 px-1 py-1.5 shadow-sm ring-1 ring-slate-200/60 xl:hidden"
      aria-label="Sadaļu navigācija"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollToSection(item.id)}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2 py-1 text-[10px] font-medium shadow-sm ${
            item.pdfIncluded === false ? "text-[var(--color-provin-muted)] opacity-45" : "text-[var(--color-apple-text)]"
          }`}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${item.pdfIncluded === false ? "opacity-40" : ""} ${DOT[item.level]}`}
            aria-hidden
          />
          <span className="max-w-[9rem] truncate">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
