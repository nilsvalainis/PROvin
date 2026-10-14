import {
  IRISS_PASUTIJUMS_LIST_STATUSES,
  isIrissPasutijumsListStatus,
  type IrissPasutijumsListStatus,
} from "@/lib/iriss-pasutijumi-types";

export const IRISS_LIST_STATUS_FILTER_KEY = "iriss-pasutijumi-list-status-filter-v2";
export const IRISS_LIST_STATUS_FILTER_EVENT = "iriss-pasutijumi-list-status-filter-change";

export type IrissListStatusFilterState = Record<IrissPasutijumsListStatus, boolean>;

export const IRISS_LIST_STATUS_DEFAULT_FILTER: IrissListStatusFilterState = {
  active: true,
  searching: true,
  offered: true,
  reserved: true,
  completed: false,
  inactive: false,
};

export const IRISS_LIST_STATUS_FILTER_ALL: IrissListStatusFilterState = {
  active: true,
  searching: true,
  offered: true,
  reserved: true,
  completed: true,
  inactive: true,
};

function emptyFilter(o: Partial<IrissListStatusFilterState>): IrissListStatusFilterState {
  return {
    active: o.active === true,
    searching: o.searching !== false,
    offered: o.offered !== false,
    reserved: o.reserved !== false,
    completed: o.completed === true,
    inactive: o.inactive === true,
  };
}

export function parseIrissListStatusFilter(raw: string | null): IrissListStatusFilterState {
  if (!raw) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  try {
    const o = JSON.parse(raw) as Partial<IrissListStatusFilterState>;
    const next = emptyFilter(o);
    if (!IRISS_PASUTIJUMS_LIST_STATUSES.some((k) => next[k])) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
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

export function irissStatusFilterKeys(): IrissPasutijumsListStatus[] {
  return [...IRISS_PASUTIJUMS_LIST_STATUSES];
}

export function isKnownFilterStatus(v: string): v is IrissPasutijumsListStatus {
  return isIrissPasutijumsListStatus(v);
}
