"use client";

import { ChevronDown, Search } from "lucide-react";
import { Reorder } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AdminCollapsedMenuButton } from "@/components/admin/AdminCollapsedMenuButton";
import { AdminIrissOrdersExportButton } from "@/components/admin/AdminIrissOrdersExportButton";
import { IrissGoogleContactsBackfillButton } from "@/components/admin/IrissGoogleContactsBackfillButton";
import { IrissOverflowItem, IrissOverflowLabel, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import { IrissPasutijumiListRow } from "@/components/admin/IrissPasutijumiListRow";
import {
  IRISS_ORDER_SORT_EVENT,
  IRISS_ORDER_SORT_KEY,
  type IrissOrderSortMode,
} from "@/components/admin/IrissOrderSortSelect";
import {
  countIrissListStatuses,
  irissListRowMatchesQuery,
  irissListRowPowerKwLabel,
  irissPasutijumsToListRow,
} from "@/lib/iriss-pasutijumi-list-row";
import { IRISS_LIST_SORT_LABEL } from "@/lib/iriss-pasutijumi-list-view";
import { IRISS_ORDERS_LIST_PAGE, irissNextWindowLimit, irissWindowSlice } from "@/lib/iriss-list-window";
import {
  canonicalIrissPasutijumsListStatus,
  IRISS_PASUTIJUMS_PICKER_STATUSES,
  IRISS_PASUTIJUMS_PICKER_STATUS_LV,
  type IrissPasutijumiListOrder,
  type IrissPasutijumsListRow,
  type IrissPasutijumsListStatus,
  type IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_LIST_STATUS_FILTER_EVENT,
  IrissPasutijumiStatusFilter,
  readIrissListStatusFilter,
  type IrissListStatusFilterState,
} from "@/components/admin/IrissPasutijumiStatusFilter";
import {
  dispatchIrissListStatusFilter,
  IRISS_LIST_TRASH_EVENT,
  parseIrissListStatusFilter,
  readIrissListTrashFilter,
} from "@/lib/iriss-pasutijumi-status-filter";
import { appendIrissStatusHistory, isIrissRecordDeleted } from "@/lib/iriss-pasutijumi-audit-fields";
import { AdminMobileSheet } from "@/components/admin/AdminMobileSheet";
import { AdminMobileRoundBtn, AdminMobileSearchField, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";

type SortMode = IrissOrderSortMode;

const SORT_MODES: readonly SortMode[] = [
  "created_desc",
  "created_asc",
  "brand_asc",
  "brand_desc",
  "budget_asc",
  "budget_desc",
];

function isSortMode(s: string): s is SortMode {
  return (SORT_MODES as readonly string[]).includes(s);
}

const LIST_ORDER_PERSIST_DEBOUNCE_MS = 380;

function useNarrowIrissSwipeViewport(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => undefined;
      const mq = window.matchMedia("(max-width: 767.98px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia("(max-width: 767.98px)").matches : false),
    () => false,
  );
}

function budgetToNumber(v: string): number {
  const m = v.replace(",", ".").match(/-?\d+(?:\.\d+)?/g);
  if (!m || m.length === 0) return Number.NaN;
  const parsed = Number.parseFloat(m.join(""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function sortCore(rows: IrissPasutijumsListRow[], mode: SortMode): IrissPasutijumsListRow[] {
  if (mode === "created_desc") return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  if (mode === "created_asc") return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  if (mode === "brand_asc")
    return [...rows].sort((a, b) => a.brandModel.localeCompare(b.brandModel, "lv", { sensitivity: "base" }));
  if (mode === "brand_desc")
    return [...rows].sort((a, b) => b.brandModel.localeCompare(a.brandModel, "lv", { sensitivity: "base" }));
  if (mode === "budget_asc")
    return [...rows].sort((a, b) => {
      const na = budgetToNumber(a.totalBudget);
      const nb = budgetToNumber(b.totalBudget);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      return na - nb;
    });
  return [...rows].sort((a, b) => {
    const na = budgetToNumber(a.totalBudget);
    const nb = budgetToNumber(b.totalBudget);
    if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
    if (!Number.isFinite(na)) return 1;
    if (!Number.isFinite(nb)) return -1;
    return nb - na;
  });
}

function orderPinnedByIds(pinned: IrissPasutijumsListRow[], orderIds: string[]): IrissPasutijumsListRow[] {
  const map = new Map(pinned.map((r) => [r.id, r]));
  const ordered: IrissPasutijumsListRow[] = [];
  const seen = new Set<string>();
  for (const id of orderIds) {
    const it = map.get(id);
    if (it) {
      ordered.push(it);
      seen.add(id);
    }
  }
  const missing = pinned.filter((r) => !seen.has(r.id));
  missing.sort((a, b) => (a.pinnedAt < b.pinnedAt ? 1 : a.pinnedAt > b.pinnedAt ? -1 : 0));
  return [...ordered, ...missing];
}

function orderUnpinnedByIds(unpinned: IrissPasutijumsListRow[], orderIds: string[], mode: SortMode): IrissPasutijumsListRow[] {
  const map = new Map(unpinned.map((r) => [r.id, r]));
  const ordered: IrissPasutijumsListRow[] = [];
  const seen = new Set<string>();
  for (const id of orderIds) {
    const it = map.get(id);
    if (it) {
      ordered.push(it);
      seen.add(id);
    }
  }
  const missing = unpinned.filter((r) => !seen.has(r.id));
  ordered.push(...sortCore(missing, mode));
  return ordered;
}

function buildDefaultListOrder(rows: IrissPasutijumsListRow[], mode: SortMode): IrissPasutijumiListOrder {
  const pinned = rows
    .filter((r) => Boolean(r.pinnedAt))
    .sort((a, b) => (a.pinnedAt < b.pinnedAt ? 1 : a.pinnedAt > b.pinnedAt ? -1 : 0));
  const unpinned = sortCore(
    rows.filter((r) => !r.pinnedAt),
    mode,
  );
  return { pinnedOrder: pinned.map((r) => r.id), unpinnedOrder: unpinned.map((r) => r.id) };
}

function rowMatchesStatusFilter(
  row: IrissPasutijumsListRow,
  f: IrissListStatusFilterState,
  trashOn: boolean,
): boolean {
  const deleted = isIrissRecordDeleted(row);
  if (trashOn) return deleted;
  if (deleted) return false;
  const st = canonicalIrissPasutijumsListStatus(row.listStatus ?? "active");
  return Boolean(f[st]);
}

async function persistListOrder(order: IrissPasutijumiListOrder): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/iriss-pasutijumi/list-order", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function IrissPasutijumiListClient({
  rows,
  initialListOrder,
  newHitsByOrder = {},
}: {
  rows: IrissPasutijumsListRow[];
  initialListOrder: IrissPasutijumiListOrder | null;
  newHitsByOrder?: Record<string, number>;
}) {
  const [localRows, setLocalRows] = useState<IrissPasutijumsListRow[]>(rows);
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [statusSheetId, setStatusSheetId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [listOrder, setListOrder] = useState<IrissPasutijumiListOrder>(() => {
    if (initialListOrder && (initialListOrder.pinnedOrder.length > 0 || initialListOrder.unpinnedOrder.length > 0)) {
      return {
        pinnedOrder: [...initialListOrder.pinnedOrder],
        unpinnedOrder: [...initialListOrder.unpinnedOrder],
      };
    }
    return buildDefaultListOrder(rows, "created_desc");
  });
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [ectBusy, setEctBusy] = useState(false);
  const [ectMsg, setEctMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IrissListStatusFilterState>(() => readIrissListStatusFilter());
  const [trashOn, setTrashOn] = useState(() => readIrissListTrashFilter());
  const [listLimit, setListLimit] = useState(IRISS_ORDERS_LIST_PAGE);
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const narrowSwipeViewport = useNarrowIrissSwipeViewport();
  const swipeClosersRef = useRef<Map<string, () => void>>(new Map());
  const persistTimerRef = useRef<number | null>(null);
  const latestOrderRef = useRef<IrissPasutijumiListOrder | null>(null);
  const localRowsRef = useRef(localRows);
  localRowsRef.current = localRows;

  const schedulePersistListOrder = useCallback((order: IrissPasutijumiListOrder) => {
    latestOrderRef.current = order;
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      const next = latestOrderRef.current;
      if (next) void persistListOrder(next);
    }, LIST_ORDER_PERSIST_DEBOUNCE_MS);
  }, []);

  const registerSwipeCloser = useCallback((id: string, closer: (() => void) | null) => {
    if (closer) swipeClosersRef.current.set(id, closer);
    else swipeClosersRef.current.delete(id);
  }, []);

  const closeOtherSwipes = useCallback((exceptId: string) => {
    for (const [id, close] of swipeClosersRef.current) {
      if (id === exceptId) continue;
      close();
    }
  }, []);

  useEffect(() => {
    setLocalRows(
      rows.map((r) => ({
        ...r,
        listStatus: r.listStatus ?? "active",
        clientFirstName: r.clientFirstName ?? "",
        clientLastName: r.clientLastName ?? "",
        orderDate: r.orderDate ?? "",
        productionYears: r.productionYears ?? "",
        engineType: r.engineType ?? "",
        transmission: r.transmission ?? "",
        bodyType: r.bodyType ?? "",
        driveType: r.driveType ?? "",
        seatCount: r.seatCount ?? "",
        maxMileage: r.maxMileage ?? "",
        preferredColors: r.preferredColors ?? "",
        nonPreferredColors: r.nonPreferredColors ?? "",
        interiorFinish: r.interiorFinish ?? "",
        equipmentRequired: r.equipmentRequired ?? "",
        equipmentDesired: r.equipmentDesired ?? "",
        notes: r.notes ?? "",
        email: r.email ?? "",
        powerKwLabel: r.powerKwLabel || irissListRowPowerKwLabel(r),
      })),
    );
  }, [rows]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IRISS_ORDER_SORT_KEY);
      const legacy = raw === "manual" ? "created_desc" : raw;
      if (legacy && isSortMode(legacy)) setSortMode(legacy);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(IRISS_ORDER_SORT_KEY, sortMode);
    } catch {
      /* ignore */
    }
  }, [sortMode]);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<IrissListStatusFilterState>).detail;
      if (!d || typeof d !== "object") return;
      setStatusFilter(parseIrissListStatusFilter(JSON.stringify(d)));
    };
    window.addEventListener(IRISS_LIST_STATUS_FILTER_EVENT, handler as EventListener);
    const onTrash = (e: Event) => {
      const d = (e as CustomEvent<boolean>).detail;
      if (typeof d === "boolean") setTrashOn(d);
    };
    window.addEventListener(IRISS_LIST_TRASH_EVENT, onTrash as EventListener);
    return () => {
      window.removeEventListener(IRISS_LIST_STATUS_FILTER_EVENT, handler as EventListener);
      window.removeEventListener(IRISS_LIST_TRASH_EVENT, onTrash as EventListener);
    };
  }, []);

  const applySort = useCallback(
    (next: SortMode) => {
      setSortMode(next);
      try {
        localStorage.setItem(IRISS_ORDER_SORT_KEY, next);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent(IRISS_ORDER_SORT_EVENT, { detail: next }));
      const lr = localRowsRef.current;
      const sortedIds = sortCore(
        lr.filter((r) => !r.pinnedAt),
        next,
      ).map((r) => r.id);
      setListOrder((prev) => {
        const merged = { ...prev, unpinnedOrder: sortedIds };
        schedulePersistListOrder(merged);
        return merged;
      });
    },
    [schedulePersistListOrder],
  );

  useEffect(() => {
    const onSortChange = (ev: Event) => {
      const next = (ev as CustomEvent<SortMode>).detail;
      if (!next || !isSortMode(next)) return;
      setSortMode(next);
      const lr = localRowsRef.current;
      const sortedIds = sortCore(
        lr.filter((r) => !r.pinnedAt),
        next,
      ).map((r) => r.id);
      setListOrder((prev) => {
        const merged = { ...prev, unpinnedOrder: sortedIds };
        schedulePersistListOrder(merged);
        return merged;
      });
    };
    window.addEventListener(IRISS_ORDER_SORT_EVENT, onSortChange as EventListener);
    return () => window.removeEventListener(IRISS_ORDER_SORT_EVENT, onSortChange as EventListener);
  }, [schedulePersistListOrder]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const liveRows = useMemo(() => localRows.filter((r) => !isIrissRecordDeleted(r)), [localRows]);
  const trashCount = useMemo(() => localRows.filter((r) => isIrissRecordDeleted(r)).length, [localRows]);
  const statusCounts = useMemo(() => countIrissListStatuses(liveRows), [liveRows]);

  const allStatusesInFilter = useMemo(
    () => statusFilter.active && statusFilter.reserved && statusFilter.completed && statusFilter.inactive,
    [statusFilter],
  );

  const searching = searchQuery.trim().length > 0;

  const visibleRows = useMemo(
    () =>
      localRows.filter((r) => rowMatchesStatusFilter(r, statusFilter, trashOn) && irissListRowMatchesQuery(r, searchQuery)),
    [localRows, statusFilter, searchQuery, trashOn],
  );

  const dragReorderEnabled = allStatusesInFilter && !searching;

  const { pinnedRows, unpinnedRows } = useMemo(() => {
    const pinned = visibleRows.filter((r) => Boolean(r.pinnedAt));
    const unpinned = visibleRows.filter((r) => !r.pinnedAt);
    return {
      pinnedRows: orderPinnedByIds(pinned, listOrder.pinnedOrder),
      unpinnedRows: orderUnpinnedByIds(unpinned, listOrder.unpinnedOrder, sortMode),
    };
  }, [visibleRows, listOrder, sortMode]);

  const orderedRows = useMemo(() => [...pinnedRows, ...unpinnedRows], [pinnedRows, unpinnedRows]);
  const listWindow = irissWindowSlice(orderedRows, listLimit, !dragReorderEnabled);
  const shownPinnedRows = dragReorderEnabled ? pinnedRows : listWindow.items.filter((r) => Boolean(r.pinnedAt));
  const shownUnpinnedRows = dragReorderEnabled ? unpinnedRows : listWindow.items.filter((r) => !r.pinnedAt);

  useEffect(() => {
    setListLimit(IRISS_ORDERS_LIST_PAGE);
  }, [searchQuery, statusFilter, trashOn, sortMode]);

  useEffect(() => {
    if (dragReorderEnabled || !listWindow.hasMore) return;
    const el = listSentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setListLimit((current) => irissNextWindowLimit(current, orderedRows.length, IRISS_ORDERS_LIST_PAGE));
      },
      { root: null, rootMargin: "700px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [dragReorderEnabled, listWindow.hasMore, orderedRows.length]);

  useEffect(() => {
    setListOrder((prev) => {
      const ids = new Set(localRows.map((r) => r.id));
      const p = prev.pinnedOrder.filter((id) => ids.has(id));
      const u = prev.unpinnedOrder.filter((id) => ids.has(id));
      const known = new Set<string>([...p, ...u]);
      for (const r of localRows) {
        if (known.has(r.id)) continue;
        if (r.pinnedAt) p.push(r.id);
        else u.push(r.id);
        known.add(r.id);
      }
      if (p.length === prev.pinnedOrder.length && u.length === prev.unpinnedOrder.length && p.every((id, i) => id === prev.pinnedOrder[i]) && u.every((id, i) => id === prev.unpinnedOrder[i])) {
        return prev;
      }
      const next = { pinnedOrder: p, unpinnedOrder: u };
      schedulePersistListOrder(next);
      return next;
    });
  }, [localRows, schedulePersistListOrder]);

  const rowMap = useMemo(() => new Map(localRows.map((r) => [r.id, r])), [localRows]);

  const patchRow = useCallback(async (id: string, mutator: (record: IrissPasutijumsRecord) => IrissPasutijumsRecord) => {
    setActionBusy(id);
    try {
      const getRes = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}`, { credentials: "include" });
      if (!getRes.ok) return;
      const getData = (await getRes.json()) as { record?: IrissPasutijumsRecord };
      if (!getData?.record) return;
      const nextRecord = mutator(getData.record);
      const patchRes = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextRecord),
      });
      if (!patchRes.ok) return;
      const patchData = (await patchRes.json()) as { record?: IrissPasutijumsRecord };
      if (!patchData?.record) return;
      const nextRow = irissPasutijumsToListRow(patchData.record);
      setLocalRows((prev) => prev.map((r) => (r.id === id ? nextRow : r)));
      setListOrder((prev) => {
        const wasPinned = prev.pinnedOrder.includes(id);
        const nowPinned = Boolean(nextRow.pinnedAt);
        if (wasPinned === nowPinned) return prev;
        let p = prev.pinnedOrder.filter((x) => x !== id);
        let u = prev.unpinnedOrder.filter((x) => x !== id);
        if (nowPinned) p = [...p, id];
        else u = [...u, id];
        const next = { pinnedOrder: p, unpinnedOrder: u };
        schedulePersistListOrder(next);
        return next;
      });
    } finally {
      setActionBusy(null);
    }
  }, [schedulePersistListOrder]);

  const onPin = useCallback((id: string) => {
    void patchRow(id, (record) => ({
      ...record,
      pinnedAt: record.pinnedAt ? "" : new Date().toISOString(),
    }));
  }, [patchRow]);

  const onSetStatus = useCallback(
    (id: string, status: IrissPasutijumsListStatus) => {
      const filterKey = canonicalIrissPasutijumsListStatus(status);
      setStatusFilter((prev) => {
        if (prev[filterKey]) return prev;
        const next = { ...prev, [filterKey]: true };
        dispatchIrissListStatusFilter(next);
        return next;
      });
      void patchRow(id, (record) =>
        appendIrissStatusHistory(record, status, { at: new Date().toISOString() }),
      );
    },
    [patchRow],
  );

  const onConfirmDelete = useCallback(async () => {
    const id = deleteTargetId;
    if (!id) return;
    setActionBusy(id);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      setLocalRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, deletedAt: new Date().toISOString() } : r)),
      );
      setDeleteTargetId(null);
      closeOtherSwipes("");
    } finally {
      setActionBusy(null);
    }
  }, [closeOtherSwipes, deleteTargetId]);

  const onRestore = useCallback(async (id: string) => {
    setActionBusy(id);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { record?: IrissPasutijumsRecord };
      if (data.record) {
        const nextRow = irissPasutijumsToListRow(data.record);
        setLocalRows((prev) => prev.map((r) => (r.id === id ? nextRow : r)));
      } else {
        setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, deletedAt: "" } : r)));
      }
    } finally {
      setActionBusy(null);
    }
  }, []);

  const onReorderPinned = useCallback((ids: string[]) => {
    setListOrder((prev) => {
      const next = { ...prev, pinnedOrder: ids };
      schedulePersistListOrder(next);
      return next;
    });
  }, [schedulePersistListOrder]);

  async function appendEcarstradeLinks() {
    if (ectBusy) return;
    setEctBusy(true);
    setEctMsg(null);
    try {
      const res = await fetch("/api/admin/iriss-pasutijumi/ecarstrade-links", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, replace: true }),
      });
      const data = (await res.json()) as {
        error?: string;
        updatedCount?: number;
        saved?: IrissPasutijumsListRow[];
      };
      if (!res.ok) {
        setEctMsg(data.error === "store_disabled" ? "Krātuve nav pieejama" : "eCarsTrade saišu atjaunošana neizdevās");
        return;
      }
      if (data.saved?.length) {
        const byId = new Map(data.saved.map((r) => [r.id, r]));
        setLocalRows((prev) => prev.map((row) => (byId.has(row.id) ? { ...row, ...byId.get(row.id)! } : row)));
      }
      const updated = data.updatedCount ?? data.saved?.length ?? 0;
      setEctMsg(updated === 0 ? "eCarsTrade saites jau ir aktuālas" : `Aizstātas eCarsTrade saites: ${updated} pasūtījumi`);
    } finally {
      setEctBusy(false);
    }
  }

  const onReorderUnpinned = useCallback((ids: string[]) => {
    setListOrder((prev) => {
      const next = { ...prev, unpinnedOrder: ids };
      schedulePersistListOrder(next);
      return next;
    });
  }, [schedulePersistListOrder]);

  const renderRow = (row: IrissPasutijumsListRow) => (
    <IrissPasutijumiListRow
      key={row.id}
      row={rowMap.get(row.id) ?? row}
      newHits={newHitsByOrder[row.id] ?? 0}
      onPin={onPin}
      onAskDelete={setDeleteTargetId}
      onSetStatus={onSetStatus}
      onRestore={onRestore}
      onAskStatus={setStatusSheetId}
      actionBusy={actionBusy}
      registerSwipeCloser={registerSwipeCloser}
      closeOtherSwipes={closeOtherSwipes}
      narrowSwipeViewport={narrowSwipeViewport}
      dragReorderEnabled={dragReorderEnabled}
    />
  );

  useEffect(() => {
    if (!sortMenuOpen) return;
    const onDoc = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node) || !sortMenuRef.current?.contains(t)) setSortMenuOpen(false);
    };
    const timer = window.setTimeout(() => document.addEventListener("pointerdown", onDoc, true), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onDoc, true);
    };
  }, [sortMenuOpen]);

  const sortButton = (
    <div ref={sortMenuRef} className="relative hidden md:inline-flex">
      <button
        type="button"
        onClick={() => setSortMenuOpen((v) => !v)}
        className="iriss-pas-sort inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--s1)] px-3 text-[13px] font-semibold text-[var(--ink)] shadow-[var(--sh)]"
        aria-label={`Kārtot: ${IRISS_LIST_SORT_LABEL[sortMode]}`}
        aria-expanded={sortMenuOpen}
        aria-haspopup="listbox"
      >
        {IRISS_LIST_SORT_LABEL[sortMode]}
        <ChevronDown className="h-3.5 w-3.5 opacity-55" aria-hidden />
      </button>
      {sortMenuOpen ? (
        <div
          role="listbox"
          className="iriss-ov-menu absolute right-0 top-[calc(100%+6px)] z-50 min-w-[14rem] overflow-hidden rounded-2xl bg-[var(--s1)] py-1 shadow-[var(--gsh)]"
        >
          {SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="option"
              aria-selected={sortMode === mode}
              onClick={() => {
                applySort(mode);
                setSortMenuOpen(false);
              }}
              className="flex min-h-11 w-full items-center justify-between px-3.5 text-left text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--fill)]"
            >
              {IRISS_LIST_SORT_LABEL[mode]}
              {sortMode === mode ? <span className="text-[var(--acc)]">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const toolbarMenu = (
    <IrissOverflowMenu label="Vairāk">
      <IrissOverflowLabel>Saraksts</IrissOverflowLabel>
      <IrissOverflowItem disabled={ectBusy} onClick={() => void appendEcarstradeLinks()}>
        {ectBusy ? "Atjauno eCarsTrade saites…" : "Atjaunot eCarsTrade saites"}
      </IrissOverflowItem>
      <IrissOverflowItem href="/admin/iriss/atskaite">Mēneša atskaite</IrissOverflowItem>
      <IrissOverflowLabel>Eksports</IrissOverflowLabel>
      <AdminIrissOrdersExportButton menu />
      <IrissOverflowLabel>Klienti</IrissOverflowLabel>
      <IrissGoogleContactsBackfillButton menu />
    </IrissOverflowMenu>
  );

  return (
    <div className="iriss-pasutijumi-view">
      <div className="md:hidden">
        <AdminMobileTopBar
          title="Pasūtījumi"
          trailing={
            <>
              <AdminMobileRoundBtn name="kartot" label={`Kārtot: ${IRISS_LIST_SORT_LABEL[sortMode]}`} onClick={() => setSortSheetOpen(true)} />
              <AdminMobileRoundBtn name="vairak" label="Vairāk" onClick={() => setMoreSheetOpen(true)} />
              <AdminMobileRoundBtn name="pievienot" primary label="Jauns pasūtījums" href="/admin/iriss/pasutijumi/new" />
            </>
          }
        >
          <AdminMobileSearchField value={searchQuery} onChange={setSearchQuery} placeholder="Vārds, tālrunis, marka" />
          <div className="iriss-pas-seg">
            <IrissPasutijumiStatusFilter layout="scroll" counts={statusCounts} trashCount={trashCount} />
          </div>
        </AdminMobileTopBar>
      </div>

      <div className="iriss-pas-toolbar mb-3 hidden md:block">
        <div className="flex items-center gap-2">
          <AdminCollapsedMenuButton className="mt-0.5" />
          <h1 className="iriss-list-title shrink-0 text-[22px] font-bold tracking-tight text-[var(--ink)]">Pasūtījumi</h1>
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink3)]" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Vārds, tālrunis, marka"
              aria-label="Meklēt pasūtījumus"
              className="am-search-desk h-10 w-full rounded-full border-0 bg-[var(--s1)] pl-9 pr-3 text-[14px] text-[var(--ink)] shadow-[var(--sh)] outline-none placeholder:text-[var(--ink3)]"
            />
          </label>
          {sortButton}
          {toolbarMenu}
          <Link
            href="/admin/iriss/pasutijumi/new"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--chip-active-bg)] px-4 text-[14px] font-semibold text-[var(--chip-active-fg)]"
          >
            + Jauns pasūtījums
          </Link>
        </div>
        <div className="iriss-pas-seg mt-2">
          <IrissPasutijumiStatusFilter layout="wrap" counts={statusCounts} trashCount={trashCount} />
        </div>
        {ectMsg ? <p className="mt-1 text-[12px] text-[var(--ink2)]">{ectMsg}</p> : null}
      </div>

      {ectMsg ? <p className="mb-2 px-4 text-[12px] text-[var(--ink2)] md:hidden">{ectMsg}</p> : null}

      <AdminMobileSheet open={sortSheetOpen} title="Kārtot" onClose={() => setSortSheetOpen(false)}>
        <div className="mb-3 overflow-hidden rounded-xl bg-[var(--s1)]">
          {SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                applySort(mode);
                setSortSheetOpen(false);
              }}
              className="flex min-h-12 w-full items-center justify-between border-b border-[var(--hair)] px-4 text-[17px] last:border-b-0"
            >
              {IRISS_LIST_SORT_LABEL[mode]}
              {sortMode === mode ? <span className="text-[var(--acc)]">✓</span> : null}
            </button>
          ))}
        </div>
      </AdminMobileSheet>

      <AdminMobileSheet
        open={moreSheetOpen}
        title="Vairāk"
        onClose={() => setMoreSheetOpen(false)}
      >
        <div className="overflow-hidden rounded-xl bg-[var(--s1)]">
          <button
            type="button"
            onClick={() => void appendEcarstradeLinks()}
            disabled={ectBusy}
            className="flex min-h-12 w-full items-center px-4 text-left text-[17px] disabled:opacity-40"
          >
            {ectBusy ? "eCarsTrade…" : "Atjaunot eCarsTrade saites"}
          </button>
          <Link href="/admin/iriss/atskaite" className="flex min-h-12 items-center border-t border-[var(--hair)] px-4 text-[17px] text-[var(--ink)]">
            Mēneša atskaite
          </Link>
          <div className="border-t border-[var(--hair)] px-4 py-2">
            <IrissGoogleContactsBackfillButton compact />
          </div>
        </div>
      </AdminMobileSheet>

      <AdminMobileSheet
        open={Boolean(statusSheetId)}
        title="Statuss"
        onClose={() => setStatusSheetId(null)}
      >
        <div className="overflow-hidden rounded-xl bg-[var(--s1)]">
          {IRISS_PASUTIJUMS_PICKER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (statusSheetId) onSetStatus(statusSheetId, s);
                setStatusSheetId(null);
              }}
              className="flex min-h-12 w-full items-center border-b border-[var(--hair)] px-4 text-[17px] last:border-b-0"
            >
              {IRISS_PASUTIJUMS_PICKER_STATUS_LV[s]}
            </button>
          ))}
        </div>
      </AdminMobileSheet>

      <div className="hidden px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)] md:grid md:grid-cols-[24px_minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_5.5rem_minmax(0,1.1fr)_9.5rem] md:gap-3 md:px-4">
        <span />
        <span>Auto</span>
        <span>Klients</span>
        <span>Budžets</span>
        <span>Jaunie</span>
        <span>Nākamā darbība</span>
        <span className="text-right">WhatsApp · statuss</span>
      </div>

      <div className="flex flex-col gap-2 max-md:px-4">
        {visibleRows.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-[var(--hair)] bg-[var(--s1)] px-3 py-8 text-center text-[13px] text-[var(--ink2)]">
            {searching ? "Nekas neatbilst meklējumam." : "Nav pasūtījumu šajā filtrā."}
          </p>
        ) : null}

        {shownPinnedRows.length > 0 ? (
          <>
            <p className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">
              Piespraustie
            </p>
            {dragReorderEnabled ? (
              <Reorder.Group axis="y" values={shownPinnedRows.map((r) => r.id)} onReorder={onReorderPinned} className="flex flex-col gap-2">
                {shownPinnedRows.map(renderRow)}
              </Reorder.Group>
            ) : (
              <div className="flex flex-col gap-2">{shownPinnedRows.map(renderRow)}</div>
            )}
            {shownUnpinnedRows.length > 0 ? <div className="mx-1 h-px bg-[var(--hair)]" aria-hidden /> : null}
          </>
        ) : null}

        {shownUnpinnedRows.length > 0 ? (
          dragReorderEnabled ? (
            <Reorder.Group axis="y" values={shownUnpinnedRows.map((r) => r.id)} onReorder={onReorderUnpinned} className="flex flex-col gap-2">
              {shownUnpinnedRows.map(renderRow)}
            </Reorder.Group>
          ) : (
            <div className="flex flex-col gap-2">{shownUnpinnedRows.map(renderRow)}</div>
          )
        ) : null}
        {listWindow.hasMore ? <div ref={listSentinelRef} className="h-px w-full" aria-hidden /> : null}
      </div>

      {deleteTargetId ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => !actionBusy && setDeleteTargetId(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[var(--hair)] bg-[var(--s1)] p-4 shadow-[var(--gsh)] sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--ink)]">
              Vai tiešām vēlaties neatgriezeniski dzēst šo pasūtījumu?
            </h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={Boolean(actionBusy)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--hair)] bg-[var(--s1)] px-4 text-[13px] font-medium text-[var(--ink)] disabled:opacity-50"
              >
                Atcelt
              </button>
              <button
                type="button"
                onClick={() => void onConfirmDelete()}
                disabled={Boolean(actionBusy)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--bad)] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {actionBusy ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
