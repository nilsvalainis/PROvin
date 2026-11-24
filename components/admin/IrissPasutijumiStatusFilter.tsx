"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusFilterChip, StatusFilterChipRow } from "@/components/shared/StatusFilterChips";
import { IRISS_ORDER_STAGES, IRISS_ORDER_STAGE_LV, type IrissOrderStage } from "@/lib/iriss-pasutijumi-types";
import { IRISS_ORDER_STAGE_TONE, type StatusChipRowLayout } from "@/lib/iriss-status-chip";
import {
  dispatchIrissListSearchOnFilter,
  dispatchIrissListStatusFilter,
  dispatchIrissListTrashFilter,
  IRISS_LIST_SEARCH_ON_EVENT,
  IRISS_LIST_STATUS_FILTER_ALL,
  IRISS_LIST_STATUS_FILTER_EVENT,
  IRISS_LIST_TRASH_EVENT,
  readIrissListSearchOnFilter,
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
  counts?: Record<IrissOrderStage, number>;
  trashCount?: number;
  /** Pasūtījumi ar faktiski ieslēgtu meklēšanu (čips «Meklē»). */
  searchOnCount?: number;
  /** scroll: one phone row. wrap: desktop toolbar and the filter sheet. */
  layout?: StatusChipRowLayout;
};

export function IrissPasutijumiStatusFilter({ className = "", counts, trashCount, searchOnCount, layout = "wrap" }: Props) {
  const [filter, setFilter] = useState<IrissListStatusFilterState>(() => readIrissListStatusFilter());
  const [trashOn, setTrashOn] = useState(() => readIrissListTrashFilter());
  const [searchOn, setSearchOn] = useState(() => readIrissListSearchOnFilter());

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
    const onSearchOn = (e: Event) => {
      const d = (e as CustomEvent<boolean>).detail;
      if (typeof d === "boolean") setSearchOn(d);
    };
    window.addEventListener(IRISS_LIST_SEARCH_ON_EVENT, onSearchOn as EventListener);
    return () => {
      window.removeEventListener(IRISS_LIST_SEARCH_ON_EVENT, onSearchOn as EventListener);
      window.removeEventListener(IRISS_LIST_STATUS_FILTER_EVENT, onEv as EventListener);
      window.removeEventListener(IRISS_LIST_TRASH_EVENT, onTrash as EventListener);
    };
  }, []);

  const toggle = useCallback((key: IrissOrderStage) => {
    setFilter((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const countOn = IRISS_ORDER_STAGES.filter((k) => next[k]).length;
      if (countOn === 0) return prev;
      dispatchIrissListStatusFilter(next);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    dispatchIrissListStatusFilter(IRISS_LIST_STATUS_FILTER_ALL);
    setFilter(IRISS_LIST_STATUS_FILTER_ALL);
  }, []);

  const isAllOn = IRISS_ORDER_STAGES.every((k) => filter[k]);
  const allCount = counts
    ? IRISS_ORDER_STAGES.reduce((n, key) => n + (counts[key] ?? 0), 0)
    : undefined;

  return (
    <StatusFilterChipRow layout={layout} className={className}>
      {IRISS_ORDER_STAGES.map((key) => (
        <StatusFilterChip
          key={key}
          label={IRISS_ORDER_STAGE_LV[key]}
          count={counts?.[key]}
          pressed={filter[key]}
          tone={IRISS_ORDER_STAGE_TONE[key]}
          onClick={() => toggle(key)}
        />
      ))}
      <StatusFilterChip label="Visi" count={allCount} pressed={isAllOn} tone="neutral" disabled={isAllOn} onClick={selectAll} />
      <StatusFilterChip
        label="Miskaste"
        count={trashCount}
        pressed={trashOn}
        tone="trash"
        onClick={() => {
          const next = !trashOn;
          setTrashOn(next);
          dispatchIrissListTrashFilter(next);
          // Miskaste un «Meklē» ir atsevišķi skati - vienlaikus ieslēgts tikai viens.
          if (next && searchOn) {
            setSearchOn(false);
            dispatchIrissListSearchOnFilter(false);
          }
        }}
      />
      <span className="ml-3 inline-flex shrink-0">
        <StatusFilterChip
          label="Meklē"
          count={searchOnCount}
          pressed={searchOn}
          tone="neutral"
          onClick={() => {
            const next = !searchOn;
            setSearchOn(next);
            dispatchIrissListSearchOnFilter(next);
            if (next && trashOn) {
              setTrashOn(false);
              dispatchIrissListTrashFilter(false);
            }
          }}
        />
      </span>
    </StatusFilterChipRow>
  );
}
