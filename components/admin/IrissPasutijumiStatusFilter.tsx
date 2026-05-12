"use client";

import { useCallback, useEffect, useState } from "react";
import type { IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

export const IRISS_LIST_STATUS_FILTER_KEY = "iriss-pasutijumi-list-status-filter-v1";
export const IRISS_LIST_STATUS_FILTER_EVENT = "iriss-pasutijumi-list-status-filter-change";

export type IrissListStatusFilterState = Record<IrissPasutijumsListStatus, boolean>;

const DEFAULT_FILTER: IrissListStatusFilterState = {
  active: true,
  completed: true,
  inactive: true,
};

const LABELS: Record<IrissPasutijumsListStatus, string> = {
  active: "Aktīvs",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

function parseFilter(raw: string | null): IrissListStatusFilterState {
  if (!raw) return { ...DEFAULT_FILTER };
  try {
    const o = JSON.parse(raw) as Partial<IrissListStatusFilterState>;
    return {
      active: o.active !== false,
      completed: o.completed !== false,
      inactive: o.inactive !== false,
    };
  } catch {
    return { ...DEFAULT_FILTER };
  }
}

export function readIrissListStatusFilter(): IrissListStatusFilterState {
  if (typeof window === "undefined") return { ...DEFAULT_FILTER };
  return parseFilter(localStorage.getItem(IRISS_LIST_STATUS_FILTER_KEY));
}

function dispatchFilter(next: IrissListStatusFilterState) {
  try {
    localStorage.setItem(IRISS_LIST_STATUS_FILTER_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(IRISS_LIST_STATUS_FILTER_EVENT, { detail: next }));
}

type Props = {
  className?: string;
  /** `stacked` — mobilajam (etiķetes virs ķekšiem). */
  variant?: "inline" | "stacked";
};

export function IrissPasutijumiStatusFilter({ className = "", variant = "inline" }: Props) {
  const [filter, setFilter] = useState<IrissListStatusFilterState>(() => readIrissListStatusFilter());

  useEffect(() => {
    setFilter(readIrissListStatusFilter());
  }, []);

  useEffect(() => {
    const onEv = (e: Event) => {
      const d = (e as CustomEvent<IrissListStatusFilterState>).detail;
      if (!d || typeof d !== "object") return;
      setFilter({
        active: d.active !== false,
        completed: d.completed !== false,
        inactive: d.inactive !== false,
      });
    };
    window.addEventListener(IRISS_LIST_STATUS_FILTER_EVENT, onEv as EventListener);
    return () => window.removeEventListener(IRISS_LIST_STATUS_FILTER_EVENT, onEv as EventListener);
  }, []);

  const toggle = useCallback((key: IrissPasutijumsListStatus) => {
    setFilter((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const countOn = (["active", "completed", "inactive"] as const).filter((k) => next[k]).length;
      if (countOn === 0) return prev;
      dispatchFilter(next);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const next = { ...DEFAULT_FILTER };
    dispatchFilter(next);
    setFilter(next);
  }, []);

  const isAllOn = filter.active && filter.completed && filter.inactive;

  const boxes = (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${variant === "stacked" ? "justify-start" : ""}`}>
      {(["active", "completed", "inactive"] as const).map((key) => (
        <label
          key={key}
          className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-black/15 bg-white/90 px-2 py-1 text-[11px] font-semibold text-black shadow-sm transition hover:border-black/25 hover:bg-white sm:text-[12px]"
        >
          <input
            type="checkbox"
            checked={filter[key]}
            onChange={() => toggle(key)}
            className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-black accent-black"
          />
          <span>{LABELS[key]}</span>
        </label>
      ))}
      <button
        type="button"
        onClick={selectAll}
        disabled={isAllOn}
        className="rounded-lg border border-dashed border-black/20 px-2 py-1 text-[11px] font-semibold text-black/70 transition hover:border-black/35 hover:bg-black/[0.04] hover:text-black disabled:cursor-default disabled:opacity-40 sm:text-[12px]"
      >
        Visi
      </button>
    </div>
  );

  if (variant === "stacked") {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-black/55">Rādīt sarakstā</p>
        {boxes}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-black ${className}`}>
      <span className="hidden shrink-0 font-semibold lg:inline">Rādīt:</span>
      {boxes}
    </div>
  );
}
