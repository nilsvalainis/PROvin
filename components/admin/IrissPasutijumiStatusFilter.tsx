"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IRISS_PASUTIJUMS_LIST_STATUSES,
  IRISS_PASUTIJUMS_LIST_STATUS_LV,
  type IrissPasutijumsListStatus,
} from "@/lib/iriss-pasutijumi-types";
import {
  dispatchIrissListStatusFilter,
  dispatchIrissListTrashFilter,
  IRISS_LIST_STATUS_FILTER_ALL,
  IRISS_LIST_STATUS_FILTER_EVENT,
  IRISS_LIST_TRASH_EVENT,
  readIrissListStatusFilter,
  readIrissListTrashFilter,
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

const CHIP_ON: Record<IrissPasutijumsListStatus, string> = {
  active: "bg-slate-900 text-white",
  searching: "bg-sky-100 text-sky-950 ring-1 ring-sky-700/30",
  offered: "bg-amber-100 text-amber-950 ring-1 ring-amber-700/30",
  reserved: "bg-violet-100 text-violet-950 ring-1 ring-violet-700/30",
  completed: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-700/30",
  inactive: "bg-red-100 text-red-950 ring-1 ring-red-700/30",
};

type Props = {
  className?: string;
  counts?: Record<IrissPasutijumsListStatus, number>;
  trashCount?: number;
};

export function IrissPasutijumiStatusFilter({ className = "", counts, trashCount }: Props) {
  const [filter, setFilter] = useState<IrissListStatusFilterState>(() => readIrissListStatusFilter());
  const [trashOn, setTrashOn] = useState(() => readIrissListTrashFilter());

  useEffect(() => {
    setFilter(readIrissListStatusFilter());
  }, []);

  useEffect(() => {
    const onEv = (e: Event) => {
      const d = (e as CustomEvent<IrissListStatusFilterState>).detail;
      if (!d || typeof d !== "object") return;
      setFilter(readIrissListStatusFilter());
    };
    window.addEventListener(IRISS_LIST_STATUS_FILTER_EVENT, onEv as EventListener);
    const onTrash = (e: Event) => {
      const d = (e as CustomEvent<boolean>).detail;
      if (typeof d === "boolean") setTrashOn(d);
    };
    window.addEventListener(IRISS_LIST_TRASH_EVENT, onTrash as EventListener);
    return () => {
      window.removeEventListener(IRISS_LIST_STATUS_FILTER_EVENT, onEv as EventListener);
      window.removeEventListener(IRISS_LIST_TRASH_EVENT, onTrash as EventListener);
    };
  }, []);

  const toggle = useCallback((key: IrissPasutijumsListStatus) => {
    setFilter((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const countOn = IRISS_PASUTIJUMS_LIST_STATUSES.filter((k) => next[k]).length;
      if (countOn === 0) return prev;
      dispatchIrissListStatusFilter(next);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    dispatchIrissListStatusFilter(IRISS_LIST_STATUS_FILTER_ALL);
    setFilter(IRISS_LIST_STATUS_FILTER_ALL);
  }, []);

  const isAllOn = IRISS_PASUTIJUMS_LIST_STATUSES.every((k) => filter[k]);

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`} role="group" aria-label="Statusa filtrs">
      {IRISS_PASUTIJUMS_LIST_STATUSES.map((key) => {
        const on = filter[key];
        const n = counts?.[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-pressed={on}
            className={`inline-flex h-8 items-center rounded-md px-2 text-[11px] font-semibold tabular-nums transition ${
              on ? CHIP_ON[key] : "bg-black/[0.04] text-black/70 hover:bg-black/[0.08] hover:text-black"
            }`}
          >
            {IRISS_PASUTIJUMS_LIST_STATUS_LV[key]}
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
      <button
        type="button"
        onClick={() => {
          const next = !trashOn;
          setTrashOn(next);
          dispatchIrissListTrashFilter(next);
        }}
        aria-pressed={trashOn}
        className={`inline-flex h-8 items-center rounded-md px-2 text-[11px] font-semibold tabular-nums transition ${
          trashOn ? "bg-neutral-800 text-white" : "bg-black/[0.04] text-black/70 hover:bg-black/[0.08] hover:text-black"
        }`}
      >
        Miskaste
        {typeof trashCount === "number" ? <span className="ml-1 opacity-80">{trashCount}</span> : null}
      </button>
    </div>
  );
}
