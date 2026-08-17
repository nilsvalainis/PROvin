import type { IrissPasutijumsListStatus } from "@/lib/iriss-pasutijumi-types";

export const IRISS_LIST_STATUS_FILTER_KEY = "iriss-pasutijumi-list-status-filter-v2";
export const IRISS_LIST_STATUS_FILTER_EVENT = "iriss-pasutijumi-list-status-filter-change";

export type IrissListStatusFilterState = Record<IrissPasutijumsListStatus, boolean>;

export const IRISS_LIST_STATUS_DEFAULT_FILTER: IrissListStatusFilterState = {
  active: true,
  completed: false,
  inactive: false,
};

export const IRISS_LIST_STATUS_FILTER_ALL: IrissListStatusFilterState = {
  active: true,
  completed: true,
  inactive: true,
};

export function parseIrissListStatusFilter(raw: string | null): IrissListStatusFilterState {
  if (!raw) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  try {
    const o = JSON.parse(raw) as Partial<IrissListStatusFilterState>;
    const next: IrissListStatusFilterState = {
      active: o.active === true,
      completed: o.completed === true,
      inactive: o.inactive === true,
    };
    if (!next.active && !next.completed && !next.inactive) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
    return next;
  } catch {
    return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  }
}

export function readIrissListStatusFilter(): IrissListStatusFilterState {
  if (typeof window === "undefined") return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  return parseIrissListStatusFilter(localStorage.getItem(IRISS_LIST_STATUS_FILTER_KEY));
}

export function dispatchIrissListStatusFilter(next: IrissListStatusFilterState): void {
  try {
    localStorage.setItem(IRISS_LIST_STATUS_FILTER_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(IRISS_LIST_STATUS_FILTER_EVENT, { detail: next }));
}
