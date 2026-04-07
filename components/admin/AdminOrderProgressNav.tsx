"use client";

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
};

function scrollToSection(id: string) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function NavButton({ item }: { item: AdminProgressNavItem }) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection(item.id)}
      className="flex w-full min-w-0 items-start gap-2 rounded-lg px-1.5 py-1 text-left text-[10px] font-medium leading-snug text-[var(--color-apple-text)] transition hover:bg-slate-100/90"
    >
      <span
        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${DOT[item.level]}`}
        aria-hidden
      />
      <span className="min-w-0 break-words">{item.label}</span>
    </button>
  );
}

/** Šaura vertikālā josla ar „luksoforu” — tikai ≥1280px. */
export function AdminOrderProgressSidebar({ items }: { items: AdminProgressNavItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      className="sticky top-3 z-10 hidden max-h-[calc(100dvh-1.5rem)] w-[10.5rem] shrink-0 overflow-y-auto overscroll-contain rounded-xl bg-white/90 py-2 pl-1 pr-1 shadow-sm ring-1 ring-slate-200/70 xl:block"
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
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2 py-1 text-[10px] font-medium text-[var(--color-apple-text)] shadow-sm"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[item.level]}`} aria-hidden />
          <span className="max-w-[9rem] truncate">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
