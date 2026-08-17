"use client";

import { ChevronDown, Pin, Search, Trash2 } from "lucide-react";
import { motion, Reorder, useDragControls } from "framer-motion";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { AdminIrissOrdersExportButton } from "@/components/admin/AdminIrissOrdersExportButton";
import { IrissPasutijumiNewFab } from "@/components/admin/IrissPasutijumiNewFab";
import { IRISS_ORDER_SORT_EVENT, IRISS_ORDER_SORT_KEY, type IrissOrderSortMode } from "@/components/admin/IrissOrderSortSelect";
import {
  buildListingPlatformChips,
  IR_LISTING_ALL_CHIP_STYLE,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_COMPACT_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_COMPACT_CLASS,
} from "@/lib/iriss-listing-links";
import {
  countIrissListStatuses,
  formatIrissClientName,
  formatIrissListDate,
  formatIrissListSpecSummary,
  irissListRowMatchesQuery,
  irissPasutijumsToListRow,
  irissPhoneTelHref,
} from "@/lib/iriss-pasutijumi-list-row";
import { irissBrandFallbackLabel, irissBrandLogoSrc } from "@/lib/iriss-brand-logo";
import type {
  IrissPasutijumiListOrder,
  IrissPasutijumsListRow,
  IrissPasutijumsListStatus,
  IrissPasutijumsRecord,
} from "@/lib/iriss-pasutijumi-types";
import {
  IRISS_LIST_STATUS_FILTER_EVENT,
  IrissPasutijumiStatusFilter,
  readIrissListStatusFilter,
  type IrissListStatusFilterState,
} from "@/components/admin/IrissPasutijumiStatusFilter";
import { IrissOrderSortSelect } from "@/components/admin/IrissOrderSortSelect";

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

const SWIPE_ACTION_BLOCK_WIDTH = 72;
const SWIPE_ACTION_WIDTH = SWIPE_ACTION_BLOCK_WIDTH * 2;
const SWIPE_CLOSE_THRESHOLD = SWIPE_ACTION_WIDTH * 0.4;
const SWIPE_OPEN_THRESHOLD = SWIPE_ACTION_WIDTH * 0.5;
const SWIPE_VELOCITY_OPEN = -620;
const SWIPE_VELOCITY_CLOSE = 620;
const SWIPE_SPRING = { type: "spring" as const, stiffness: 1000, damping: 60, mass: 0.45 };
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_LONG_PRESS_PX = 10;
const SWIPE_AXIS_MIN = 14;
const SWIPE_AXIS_BIAS = 8;
const LIST_ORDER_PERSIST_DEBOUNCE_MS = 380;

const STATUS_LABEL: Record<IrissPasutijumsListStatus, string> = {
  active: "Aktīvs",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

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

function rowMatchesStatusFilter(row: IrissPasutijumsListRow, f: IrissListStatusFilterState): boolean {
  const st = row.listStatus ?? "active";
  return Boolean(f[st]);
}

function statusBarClass(row: IrissPasutijumsListRow): string {
  const st = row.listStatus ?? "active";
  if (st === "completed") return "bg-emerald-500";
  if (st === "inactive") return "bg-red-500";
  if (row.pinnedAt) return "bg-emerald-600";
  return "bg-slate-400";
}

function statusBadgeClass(st: IrissPasutijumsListStatus): string {
  if (st === "completed") return "bg-emerald-100 text-emerald-950";
  if (st === "inactive") return "bg-red-100 text-red-950";
  return "bg-slate-100 text-slate-800";
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

const IrissRowCard = memo(function IrissRowCard({
  row,
  onPin,
  onAskDelete,
  onSetStatus,
  actionBusy,
  registerSwipeCloser,
  closeOtherSwipes,
  narrowSwipeViewport,
  dragReorderEnabled,
}: {
  row: IrissPasutijumsListRow;
  onPin: (id: string) => void;
  onAskDelete: (id: string) => void;
  onSetStatus: (id: string, status: IrissPasutijumsListStatus) => void;
  actionBusy: string | null;
  registerSwipeCloser: (id: string, closer: (() => void) | null) => void;
  closeOtherSwipes: (exceptId: string) => void;
  narrowSwipeViewport: boolean;
  dragReorderEnabled: boolean;
}) {
  const reorderDragControls = useDragControls();
  const swipeDragControls = useDragControls();
  const swipeAxisRef = useRef<"idle" | "vertical" | "horizontal">("idle");
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const chips = buildListingPlatformChips(
    {
      listingLinkMobile: row.listingLinkMobile,
      listingLinkAutobid: row.listingLinkAutobid,
      listingLinkOpenline: row.listingLinkOpenline,
      listingLinkAuto1: row.listingLinkAuto1,
      listingLinksOther: row.listingLinksOther,
    },
    5,
  );
  const brandFallback = irissBrandFallbackLabel(row.brandModel);
  const brandLogoSrc = irissBrandLogoSrc(row.brandModel);
  const specSummary = formatIrissListSpecSummary(row);
  const equipmentRequired = (row.equipmentRequired ?? "").trim();
  const isPinned = Boolean(row.pinnedAt);
  const statusBusy = actionBusy === row.id;
  const curStatus = row.listStatus ?? "active";
  const clientName = formatIrissClientName(row);
  const listDate = formatIrissListDate(row);
  const telHref = irissPhoneTelHref(row.phone);

  const openAllListings = () => {
    for (const chip of chips) {
      window.open(chip.href, "_blank", "noopener,noreferrer");
    }
  };

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onFrontPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipeAxisRef.current = "idle";
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    clearLongPressTimer();
    closeOtherSwipes(row.id);
    setStatusMenuOpen(false);

    const startEv = e;
    if (!dragReorderEnabled) return;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      reorderDragControls.start(startEv);
    }, LONG_PRESS_MS);
  };

  const onFrontPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX > MOVE_CANCEL_LONG_PRESS_PX || absY > MOVE_CANCEL_LONG_PRESS_PX) {
      clearLongPressTimer();
    }

    if (narrowSwipeViewport && swipeAxisRef.current === "idle") {
      if (absY > SWIPE_AXIS_MIN && absY > absX + SWIPE_AXIS_BIAS) {
        swipeAxisRef.current = "vertical";
      } else if (absX > SWIPE_AXIS_MIN && absX > absY + SWIPE_AXIS_BIAS) {
        swipeAxisRef.current = "horizontal";
        swipeDragControls.start(e.nativeEvent);
      }
    }
  };

  const onFrontPointerEnd = () => {
    clearLongPressTimer();
    pointerStartRef.current = null;
    swipeAxisRef.current = "idle";
  };

  const closeSwipe = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    registerSwipeCloser(row.id, closeSwipe);
    return () => registerSwipeCloser(row.id, null);
  }, [closeSwipe, registerSwipeCloser, row.id]);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const close = () => setStatusMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [statusMenuOpen]);

  const chipsRow =
    chips.length > 0 ? (
      <div
        role="group"
        aria-label="Sludinājumu platformu saites"
        className={LISTING_PLATFORM_CHIPS_SCROLL_ROW_COMPACT_CLASS}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {chips.map((c, i) => (
          <a
            key={`${c.href}-${i}`}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            title={c.title}
            className={LISTING_PLATFORM_CHIP_ANCHOR_COMPACT_CLASS}
            style={c.chipStyle}
          >
            {c.letter}
          </a>
        ))}
        <button
          type="button"
          onClick={openAllListings}
          title="Atvērt visas saites"
          aria-label="Atvērt visas saites"
          className={LISTING_PLATFORM_CHIP_ANCHOR_COMPACT_CLASS}
          style={IR_LISTING_ALL_CHIP_STYLE}
        >
          ALL
        </button>
      </div>
    ) : null;

  const frontInner = (
    <div className="relative flex min-h-[76px] items-center gap-2.5 py-2 pl-3 pr-2 md:min-h-[82px]">
      <Link
        href={`/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`}
        prefetch
        aria-label={`Atvērt pasūtījumu: ${row.brandModel}`}
        className="absolute inset-0 z-0 rounded-lg"
      />
      <span className={`absolute inset-y-0 left-0 z-10 w-[3px] ${statusBarClass(row)}`} aria-hidden />
      <div className="relative z-10 shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={statusBusy}
          onClick={(e) => {
            e.stopPropagation();
            setStatusMenuOpen((v) => !v);
          }}
          className={`inline-flex h-7 items-center gap-0.5 rounded px-1.5 text-[11px] font-semibold ${statusBadgeClass(curStatus)}`}
          aria-haspopup="menu"
          aria-expanded={statusMenuOpen}
        >
          {STATUS_LABEL[curStatus]}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </button>
        {statusMenuOpen ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-20 mt-1 min-w-[7.5rem] overflow-hidden rounded-md border border-slate-200 bg-white py-0.5 shadow-lg"
          >
            {(["active", "completed", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="menuitem"
                disabled={statusBusy}
                onClick={() => {
                  setStatusMenuOpen(false);
                  onSetStatus(row.id, s);
                }}
                className={`flex w-full px-2.5 py-1.5 text-left text-[11px] font-semibold ${
                  curStatus === s ? "bg-slate-100 text-black" : "text-black/80 hover:bg-slate-50"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-start gap-2.5">
        {brandLogoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brandLogoSrc}
            alt=""
            width={36}
            height={36}
            className="mt-0.5 h-9 w-9 shrink-0 rounded-md border border-slate-200/90 bg-white object-contain p-[3px]"
          />
        ) : (
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-slate-50 text-[11px] font-bold text-slate-600">
            {brandFallback}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[16px] font-semibold leading-snug text-[var(--color-apple-text)] sm:text-[17px]">
              {row.brandModel}
            </span>
            {isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-black" aria-hidden /> : null}
          </span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[12px] leading-snug text-[var(--color-provin-muted)]">
            <span className="truncate">{clientName}</span>
            <span className="tabular-nums">{listDate}</span>
            <span className="truncate">{row.totalBudget}</span>
            {telHref ? (
              <a
                href={telHref}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto font-medium text-[var(--color-provin-accent)] hover:underline md:hidden"
              >
                {row.phone}
              </a>
            ) : row.phone && row.phone !== "—" ? (
              <span className="md:hidden">{row.phone}</span>
            ) : null}
          </span>
          {equipmentRequired ? (
            <span className="mt-0.5 block truncate text-[12px] font-medium leading-snug text-[var(--color-apple-text)]">
              <span className="text-[var(--color-provin-muted)]">Obligāti: </span>
              {equipmentRequired}
            </span>
          ) : null}
          {specSummary ? (
            <span className={`mt-0.5 block truncate text-[12px] leading-snug text-[var(--color-provin-muted)]`}>
              {specSummary}
            </span>
          ) : null}
        </span>
      </div>
      {telHref ? (
        <a
          href={telHref}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative z-10 hidden shrink-0 text-[12px] font-medium text-[var(--color-provin-accent)] hover:underline md:inline"
        >
          {row.phone}
        </a>
      ) : row.phone && row.phone !== "—" ? (
        <span className="relative z-10 hidden shrink-0 text-[12px] text-[var(--color-provin-muted)] md:inline">{row.phone}</span>
      ) : null}
      {chipsRow ? <div className="relative z-10 hidden min-w-0 max-w-[11rem] shrink md:block">{chipsRow}</div> : null}
      <div className="relative z-10 hidden shrink-0 items-center md:flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onPin(row.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-black"
          aria-label={isPinned ? "Noņemt piespraušanu" : "Piespraust augšā"}
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onAskDelete(row.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
          aria-label="Dzēst pasūtījumu"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const cardInner = (
    <div className="group relative overflow-x-clip overflow-y-visible rounded-lg border border-[#E5E7EB] bg-white shadow-none transition hover:border-slate-300">
      {narrowSwipeViewport ? (
        <div className="absolute inset-y-0 right-0 z-0 flex bg-[#E5E7EB]" style={{ width: SWIPE_ACTION_WIDTH }}>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onPin(row.id);
            }}
            className="flex h-full w-[72px] items-center justify-center bg-[#8E8E93] text-white transition active:brightness-95"
            aria-label={isPinned ? "Noņemt piespraušanu" : "Piespraust augšā"}
          >
            <Pin className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onAskDelete(row.id);
            }}
            className="flex h-full w-[72px] items-center justify-center bg-[#FF3B30] text-white transition active:brightness-95"
            aria-label="Dzēst pasūtījumu"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      {narrowSwipeViewport ? (
        <motion.div
          drag="x"
          dragControls={swipeDragControls}
          dragListener={false}
          dragConstraints={{ left: -SWIPE_ACTION_WIDTH, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          dragDirectionLock
          onDirectionLock={(axis) => {
            if (axis === "x") closeOtherSwipes(row.id);
          }}
          animate={{ x: isOpen ? -SWIPE_ACTION_WIDTH : 0 }}
          transition={SWIPE_SPRING}
          onPointerDown={onFrontPointerDown}
          onPointerMove={onFrontPointerMove}
          onPointerUp={onFrontPointerEnd}
          onPointerCancel={onFrontPointerEnd}
          onPanStart={clearLongPressTimer}
          onDragEnd={(_, info) => {
            const dragBase = isOpen ? -SWIPE_ACTION_WIDTH : 0;
            const finalX = Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, dragBase + info.offset.x));
            const velocityX = info.velocity.x;
            const revealed = Math.abs(finalX);
            let shouldOpen = false;
            if (velocityX <= SWIPE_VELOCITY_OPEN) shouldOpen = true;
            else if (velocityX >= SWIPE_VELOCITY_CLOSE) shouldOpen = false;
            else if (revealed >= SWIPE_OPEN_THRESHOLD) shouldOpen = true;
            else if (revealed < SWIPE_CLOSE_THRESHOLD) shouldOpen = false;
            else {
              const projected = finalX + velocityX * 0.18;
              shouldOpen = Math.abs(projected) >= SWIPE_OPEN_THRESHOLD;
            }
            setIsOpen(shouldOpen);
            if (shouldOpen) closeOtherSwipes(row.id);
          }}
          className="relative z-10 touch-pan-y overscroll-x-contain bg-white will-change-transform"
          style={{ transform: "translateZ(0)", touchAction: "pan-y pinch-zoom" }}
        >
          {frontInner}
          {chipsRow ? <div className="border-t border-slate-100 px-3 pb-1.5 pt-1 md:hidden">{chipsRow}</div> : null}
        </motion.div>
      ) : (
        <div
          className="relative z-10 bg-white"
          onPointerDown={onFrontPointerDown}
          onPointerMove={onFrontPointerMove}
          onPointerUp={onFrontPointerEnd}
          onPointerCancel={onFrontPointerEnd}
        >
          {frontInner}
        </div>
      )}
    </div>
  );

  if (dragReorderEnabled) {
    return (
      <Reorder.Item value={row.id} dragListener={false} dragControls={reorderDragControls} className="list-none">
        {cardInner}
      </Reorder.Item>
    );
  }
  return <div className="list-none">{cardInner}</div>;
});

export function IrissPasutijumiListClient({
  rows,
  initialListOrder,
}: {
  rows: IrissPasutijumsListRow[];
  initialListOrder: IrissPasutijumiListOrder | null;
}) {
  const [localRows, setLocalRows] = useState<IrissPasutijumsListRow[]>(rows);
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [searchQuery, setSearchQuery] = useState("");
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
  const [statusFilter, setStatusFilter] = useState<IrissListStatusFilterState>(() => readIrissListStatusFilter());
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
        maxMileage: r.maxMileage ?? "",
        preferredColors: r.preferredColors ?? "",
        nonPreferredColors: r.nonPreferredColors ?? "",
        interiorFinish: r.interiorFinish ?? "",
        equipmentRequired: r.equipmentRequired ?? "",
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
      setStatusFilter({
        active: Boolean(d.active),
        completed: Boolean(d.completed),
        inactive: Boolean(d.inactive),
      });
    };
    window.addEventListener(IRISS_LIST_STATUS_FILTER_EVENT, handler as EventListener);
    return () => window.removeEventListener(IRISS_LIST_STATUS_FILTER_EVENT, handler as EventListener);
  }, []);

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

  const statusCounts = useMemo(() => countIrissListStatuses(localRows), [localRows]);

  const allStatusesInFilter = useMemo(
    () => statusFilter.active && statusFilter.completed && statusFilter.inactive,
    [statusFilter],
  );

  const searching = searchQuery.trim().length > 0;

  const visibleRows = useMemo(
    () =>
      localRows.filter((r) => rowMatchesStatusFilter(r, statusFilter) && irissListRowMatchesQuery(r, searchQuery)),
    [localRows, statusFilter, searchQuery],
  );

  const dragReorderEnabled = allStatusesInFilter && !searching && !narrowSwipeViewport;

  const { pinnedRows, unpinnedRows } = useMemo(() => {
    const pinned = visibleRows.filter((r) => Boolean(r.pinnedAt));
    const unpinned = visibleRows.filter((r) => !r.pinnedAt);
    return {
      pinnedRows: orderPinnedByIds(pinned, listOrder.pinnedOrder),
      unpinnedRows: orderUnpinnedByIds(unpinned, listOrder.unpinnedOrder, sortMode),
    };
  }, [visibleRows, listOrder, sortMode]);

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
      void patchRow(id, (record) => ({ ...record, listStatus: status }));
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
      setLocalRows((prev) => prev.filter((r) => r.id !== id));
      setListOrder((prev) => {
        const next = {
          pinnedOrder: prev.pinnedOrder.filter((x) => x !== id),
          unpinnedOrder: prev.unpinnedOrder.filter((x) => x !== id),
        };
        schedulePersistListOrder(next);
        return next;
      });
      setDeleteTargetId(null);
      closeOtherSwipes("");
    } finally {
      setActionBusy(null);
    }
  }, [closeOtherSwipes, deleteTargetId, schedulePersistListOrder]);

  const onReorderPinned = useCallback((ids: string[]) => {
    setListOrder((prev) => {
      const next = { ...prev, pinnedOrder: ids };
      schedulePersistListOrder(next);
      return next;
    });
  }, [schedulePersistListOrder]);

  const onReorderUnpinned = useCallback((ids: string[]) => {
    setListOrder((prev) => {
      const next = { ...prev, unpinnedOrder: ids };
      schedulePersistListOrder(next);
      return next;
    });
  }, [schedulePersistListOrder]);

  const renderRow = (row: IrissPasutijumsListRow) => (
    <IrissRowCard
      key={row.id}
      row={rowMap.get(row.id) ?? row}
      onPin={onPin}
      onAskDelete={setDeleteTargetId}
      onSetStatus={onSetStatus}
      actionBusy={actionBusy}
      registerSwipeCloser={registerSwipeCloser}
      closeOtherSwipes={closeOtherSwipes}
      narrowSwipeViewport={narrowSwipeViewport}
      dragReorderEnabled={dragReorderEnabled}
    />
  );

  return (
    <>
      <div className="sticky top-0 z-30 mb-2 border-b border-slate-200/80 bg-[#F8F8F9]/95 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[10rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Meklēt (vārds, tālrunis, marka)"
              aria-label="Meklēt pasūtījumus"
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-[12px] text-black outline-none ring-[var(--color-provin-accent)]/25 placeholder:text-slate-400 focus:ring-2"
            />
          </label>
          <IrissPasutijumiStatusFilter counts={statusCounts} />
          <IrissOrderSortSelect compact />
          <div className="ml-auto">
            <AdminIrissOrdersExportButton compact />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {visibleRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-[13px] text-black/60">
            {searching ? "Nekas neatbilst meklējumam." : "Nav pasūtījumu šajā filtrā."}
          </p>
        ) : null}

        {pinnedRows.length > 0 ? (
          dragReorderEnabled ? (
            <Reorder.Group axis="y" values={pinnedRows.map((r) => r.id)} onReorder={onReorderPinned} className="flex flex-col gap-2">
              {pinnedRows.map(renderRow)}
            </Reorder.Group>
          ) : (
            <div className="flex flex-col gap-2">{pinnedRows.map(renderRow)}</div>
          )
        ) : null}

        {unpinnedRows.length > 0 ? (
          dragReorderEnabled ? (
            <Reorder.Group axis="y" values={unpinnedRows.map((r) => r.id)} onReorder={onReorderUnpinned} className="flex flex-col gap-2">
              {unpinnedRows.map(renderRow)}
            </Reorder.Group>
          ) : (
            <div className="flex flex-col gap-2">{unpinnedRows.map(renderRow)}</div>
          )
        ) : null}
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
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">
              Vai tiešām vēlaties neatgriezeniski dzēst šo pasūtījumu?
            </h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={Boolean(actionBusy)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Atcelt
              </button>
              <button
                type="button"
                onClick={() => void onConfirmDelete()}
                disabled={Boolean(actionBusy)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
              >
                {actionBusy ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <IrissPasutijumiNewFab />
    </>
  );
}
