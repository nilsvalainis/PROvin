"use client";

import { useCallback, useEffect, useState } from "react";
import type { IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";
import {
  dispatchIrissListStatusFilter,
  IRISS_LIST_STATUS_FILTER_ALL,
  IRISS_LIST_STATUS_FILTER_EVENT,
  readIrissListStatusFilter,
  type IrissListStatusFilterState,
} from "@/lib/iriss-pasutijumi-status-filter";

export {
  IRISS_LIST_STATUS_DEFAULT_FILTER,
  IRISS_LIST_STATUS_FILTER_ALL,
  IRISS_LIST_STATUS_FILTER_EVENT,
  IRISS_LIST_STATUS_FILTER_KEY,
  parseIrissListStatusFilter,
  readIrissListStatusFilter,
  type IrissListStatusFilterState,
} from "@/lib/iriss-pasutijumi-status-filter";

const LABELS: Record<IrissPasutijumsListStatus, string> = {
  active: "Aktīvi",
  completed: "Izpildīti",
  inactive: "Neaktīvi",
};

type Props = {
  className?: string;
  counts?: { active: number; completed: number; inactive: number };
};

export function IrissPasutijumiStatusFilter({ className = "", counts }: Props) {
  const [filter, setFilter] = useState<IrissListStatusFilterState>(() => readIrissListStatusFilter());

  useEffect(() => {
    setFilter(readIrissListStatusFilter());
  }, []);

  useEffect(() => {
    const onEv = (e: Event) => {
      const d = (e as CustomEvent<IrissListStatusFilterState>).detail;
      if (!d || typeof d !== "object") return;
      setFilter({
        active: Boolean(d.active),
        completed: Boolean(d.completed),
        inactive: Boolean(d.inactive),
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
      dispatchIrissListStatusFilter(next);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    dispatchIrissListStatusFilter(IRISS_LIST_STATUS_FILTER_ALL);
    setFilter(IRISS_LIST_STATUS_FILTER_ALL);
  }, []);

  const isAllOn = filter.active && filter.completed && filter.inactive;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`} role="group" aria-label="Statusa filtrs">
      {(["active", "completed", "inactive"] as const).map((key) => {
        const on = filter[key];
        const n = counts?.[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-pressed={on}
            className={`inline-flex h-8 items-center rounded-md px-2 text-[11px] font-semibold tabular-nums transition ${
              on
                ? key === "completed"
                  ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-700/30"
                  : key === "inactive"
                    ? "bg-red-100 text-red-950 ring-1 ring-red-700/30"
                    : "bg-slate-900 text-white"
                : "bg-black/[0.04] text-black/70 hover:bg-black/[0.08] hover:text-black"
            }`}
          >
            {LABELS[key]}
            {typeof n === "number" ? <span className="ml-1 opacity-80">{n}</span> : null}
          </button>
        );
      })}
      <button
        type="button"
        onClick={selectAll}
        disabled={isAllOn}
        className="inline-flex h-8 items-center rounded-md px-2 text-[11px] font-semibold text-black/60 transition hover:bg-black/[0.06] hover:text-black disabled:cursor-default disabled:opacity-40"
      >
        Visi
      </button>
    </div>
  );
}
