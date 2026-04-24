"use client";

import { useEffect, useState } from "react";

export type IrissOrderSortMode =
  | "created_desc"
  | "created_asc"
  | "brand_asc"
  | "brand_desc"
  | "budget_asc"
  | "budget_desc";

export const IRISS_ORDER_SORT_KEY = "iriss-order-sort-v1";
export const IRISS_ORDER_SORT_EVENT = "iriss-order-sort-change";

const SORT_MODES: readonly IrissOrderSortMode[] = [
  "created_desc",
  "created_asc",
  "brand_asc",
  "brand_desc",
  "budget_asc",
  "budget_desc",
];

function isSortMode(s: string): s is IrissOrderSortMode {
  return (SORT_MODES as readonly string[]).includes(s);
}

export function readIrissOrderSort(): IrissOrderSortMode {
  if (typeof window === "undefined") return "created_desc";
  const raw = localStorage.getItem(IRISS_ORDER_SORT_KEY);
  const legacy = raw === "manual" ? "created_desc" : raw;
  return legacy && isSortMode(legacy) ? legacy : "created_desc";
}

export function IrissOrderSortSelect({ className = "" }: { className?: string }) {
  const [value, setValue] = useState<IrissOrderSortMode>("created_desc");

  useEffect(() => {
    setValue(readIrissOrderSort());
  }, []);

  return (
    <label className={`inline-flex items-center gap-2 text-xs text-black ${className}`}>
      <span className="hidden lg:inline">Kārtot:</span>
      <select
        className="min-h-[38px] rounded-lg border border-black bg-transparent px-2.5 text-[12px] font-semibold text-black outline-none transition hover:bg-black/5 focus:border-black/60 focus:ring-2 focus:ring-black/20"
        value={value}
        onChange={(e) => {
          const next = e.target.value as IrissOrderSortMode;
          setValue(next);
          localStorage.setItem(IRISS_ORDER_SORT_KEY, next);
          window.dispatchEvent(new CustomEvent(IRISS_ORDER_SORT_EVENT, { detail: next }));
        }}
      >
        <option value="created_desc" className="text-black">
          Piev. datums (jaunākie)
        </option>
        <option value="created_asc" className="text-black">
          Piev. datums (vecākie)
        </option>
        <option value="brand_asc" className="text-black">
          Marka/modelis (A-Z)
        </option>
        <option value="brand_desc" className="text-black">
          Marka/modelis (Z-A)
        </option>
        <option value="budget_asc" className="text-black">
          Cena (zemākā)
        </option>
        <option value="budget_desc" className="text-black">
          Cena (augstākā)
        </option>
      </select>
    </label>
  );
}
