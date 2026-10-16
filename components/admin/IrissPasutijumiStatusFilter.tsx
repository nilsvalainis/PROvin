"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusFilterChip, StatusFilterChipRow } from "@/components/shared/StatusFilterChips";
import {
  IRISS_PASUTIJUMS_LIST_STATUSES,
  IRISS_PASUTIJUMS_LIST_STATUS_LV,
  type IrissPasutijumsListStatus,
} from "@/lib/iriss-pasutijumi-types";
import type { StatusChipRowLayout } from "@/lib/iriss-status-chip";
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

type Props = {
  className?: string;
  counts?: Record<IrissPasutijumsListStatus, number>;
  trashCount?: number;
  /** scroll: one phone row. wrap: desktop toolbar and the filter sheet. */
  layout?: StatusChipRowLayout;
};

export function IrissPasutijumiStatusFilter({ className = "", counts, trashCount, layout = "wrap" }: Props) {
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
    <StatusFilterChipRow layout={layout} className={className}>
      {IRISS_PASUTIJUMS_LIST_STATUSES.map((key) => (
        <StatusFilterChip
          key={key}
          label={IRISS_PASUTIJUMS_LIST_STATUS_LV[key]}
          count={counts?.[key]}
          pressed={filter[key]}
          tone={key}
          onClick={() => toggle(key)}
        />
      ))}
      <StatusFilterChip label="Visi" pressed={isAllOn} tone="neutral" disabled={isAllOn} onClick={selectAll} />
      <StatusFilterChip
        label="Miskaste"
        count={trashCount}
        pressed={trashOn}
        tone="trash"
        onClick={() => {
          const next = !trashOn;
          setTrashOn(next);
          dispatchIrissListTrashFilter(next);
        }}
      />
    </StatusFilterChipRow>
  );
}
