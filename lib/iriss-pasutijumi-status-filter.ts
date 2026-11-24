import { IRISS_ORDER_STAGES, type IrissOrderStage } from "@/lib/iriss-pasutijumi-types";

/** P5: filtrs pa posmiem. v3 (Aktīvs/Rezervēts/Izpildīts/Neaktīvs) tiek pārnests uz posmiem. */
export const IRISS_LIST_STATUS_FILTER_KEY = "iriss-pasutijumi-list-status-filter-v4";
const LEGACY_FILTER_KEY = "iriss-pasutijumi-list-status-filter-v3";
export const IRISS_LIST_STATUS_FILTER_EVENT = "iriss-pasutijumi-list-status-filter-change";
export const IRISS_LIST_TRASH_KEY = "iriss-pasutijumi-list-trash-v1";
export const IRISS_LIST_TRASH_EVENT = "iriss-pasutijumi-list-trash-change";

export type IrissListStatusFilterState = Record<IrissOrderStage, boolean>;

/** Noklusēti ieslēgti darbā esošie: Meklējam, Piedāvāts, Rezervēts, Ceļā. */
export const IRISS_LIST_STATUS_DEFAULT_FILTER: IrissListStatusFilterState = {
  searching: true,
  offered: true,
  reserved: true,
  transit: true,
  sold: false,
  inactive: false,
};

export const IRISS_LIST_STATUS_FILTER_ALL: IrissListStatusFilterState = {
  searching: true,
  offered: true,
  reserved: true,
  transit: true,
  sold: true,
  inactive: true,
};

function fromStageObject(o: Record<string, unknown>): IrissListStatusFilterState {
  const next = { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  for (const k of IRISS_ORDER_STAGES) if (typeof o[k] === "boolean") next[k] = o[k] as boolean;
  return next;
}

/** v3 -> v4: Aktīvs -> Meklējam+Piedāvāts, Rezervēts -> Rezervēts+Ceļā, Izpildīts -> Pārdots. */
function fromLegacyObject(o: Record<string, unknown>): IrissListStatusFilterState {
  const active = o.active !== false && o.searching !== false && o.offered !== false;
  const reserved = o.reserved !== false;
  return {
    searching: active,
    offered: active,
    reserved,
    transit: reserved,
    sold: o.completed === true,
    inactive: o.inactive === true,
  };
}

export function parseIrissListStatusFilter(raw: string | null, legacyRaw: string | null = null): IrissListStatusFilterState {
  const src = raw ?? legacyRaw;
  if (!src) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  try {
    const parsed = JSON.parse(src) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
    const isStage = "transit" in parsed || "sold" in parsed;
    const next = isStage ? fromStageObject(parsed) : fromLegacyObject(parsed);
    if (!IRISS_ORDER_STAGES.some((k) => next[k])) return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
    return next;
  } catch {
    return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  }
}

export function readIrissListStatusFilter(): IrissListStatusFilterState {
  if (typeof window === "undefined") return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  try {
    return parseIrissListStatusFilter(localStorage.getItem(IRISS_LIST_STATUS_FILTER_KEY), localStorage.getItem(LEGACY_FILTER_KEY));
  } catch {
    return { ...IRISS_LIST_STATUS_DEFAULT_FILTER };
  }
}

export function dispatchIrissListStatusFilter(next: IrissListStatusFilterState): void {
  try {
    localStorage.setItem(IRISS_LIST_STATUS_FILTER_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(IRISS_LIST_STATUS_FILTER_EVENT, { detail: next }));
}

export function irissStatusFilterKeys(): IrissOrderStage[] {
  return [...IRISS_ORDER_STAGES];
}

export function isKnownFilterStatus(v: string): v is IrissOrderStage {
  return (IRISS_ORDER_STAGES as readonly string[]).includes(v);
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

/** Filtrs «Meklē» (Nils 24.11): tikai pasūtījumi ar faktiski ieslēgtu meklēšanu, neatkarīgi no statusa. */
export const IRISS_LIST_SEARCH_ON_KEY = "iriss-pasutijumi-list-search-on-v1";
export const IRISS_LIST_SEARCH_ON_EVENT = "iriss-pasutijumi-list-search-on-change";

export function readIrissListSearchOnFilter(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(IRISS_LIST_SEARCH_ON_KEY) === "1";
  } catch {
    return false;
  }
}

export function dispatchIrissListSearchOnFilter(next: boolean): void {
  try {
    localStorage.setItem(IRISS_LIST_SEARCH_ON_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(IRISS_LIST_SEARCH_ON_EVENT, { detail: next }));
}
