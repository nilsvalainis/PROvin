import {
  IRISS_PASUTIJUMS_PICKER_STATUSES,
  type IrissPasutijumsPickerStatus,
} from "@/lib/iriss-pasutijumi-types";

export const IRISS_LIST_STATUS_FILTER_KEY = "iriss-pasutijumi-list-status-filter-v3";
export const IRISS_LIST_STATUS_FILTER_EVENT = "iriss-pasutijumi-list-status-filter-change";
export const IRISS_LIST_TRASH_KEY = "iriss-pasutijumi-list-trash-v1";
export const IRISS_LIST_TRASH_EVENT = "iriss-pasutijumi-list-trash-change";

export type IrissListStatusFilterState = Record<IrissPasutijumsPickerStatus, boolean>;

export const IRISS_LIST_STATUS_DEFAULT_FILTER: IrissListStatusFilterState = {
  active: true,
  reserved: true,
  completed: false,
  inactive: false,
};

export const IRISS_LIST_STATUS_FILTER_ALL: IrissListStatusFilterState = {
  active: true,
  reserved: true,
  completed: true,
  inactive: true,
};

function emptyFilter(o: Partial<IrissListStatusFilterState>): IrissListStatusFilterState {
  return {
    active: o.active !== false,
    reserved: o.reserved !== false,
    completed: o.completed === true,
    inactive: o.inactive === true,
  };
}

function migrateLegacyFilterObject(o: Record<string, unknown>): Partial<IrissListStatusFilterState> {
  const hasLegacy = "searching" in o || "offered" in o;
  const onlyV3 = IRISS_PASUTIJUMS_PICKER_STATUSES.every((k) => k in o) && !hasLegacy;
  if (onlyV3) return o as Partial<IrissListStatusFilterState>;

  const activeOn = o.active !== false || o.searching !== false || o.offered !== false;
  return {
    active: activeOn,
    reserved: o.reserved !== false,
    completed: o.completed === true,
    inactive: o.inactive === true,
  };
}

export function parseIrissListStatusFilter(raw: string | null): IrissListStatusFilterState {
  if (!raw) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const o = migrateLegacyFilterObject(parsed);
    const next = emptyFilter(o);
    if (!IRISS_PASUTIJUMS_PICKER_STATUSES.some((k) => next[k])) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
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

export function irissStatusFilterKeys(): IrissPasutijumsPickerStatus[] {
  return [...IRISS_PASUTIJUMS_PICKER_STATUSES];
}

export function isKnownFilterStatus(v: string): v is IrissPasutijumsPickerStatus {
  return (IRISS_PASUTIJUMS_PICKER_STATUSES as readonly string[]).includes(v);
}

export function readIrissListTrashFilter(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(IRISS_LIST_TRASH_KEY) === "1";
  } catch {
    return false;
  }
}

export function dispatchIrissListTrashFilter(next: boolean): void {
  try {
    localStorage.setItem(IRISS_LIST_TRASH_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(IRISS_LIST_TRASH_EVENT, { detail: next }));
}
