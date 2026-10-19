"use client";

import { ArrowUpDown, ChevronDown, Pin, Search, Trash2 } from "lucide-react";
import { motion, Reorder, useDragControls } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { IrissAuctionLogo } from "@/components/admin/IrissAuctionLogo";
import { AdminIrissOrdersExportButton } from "@/components/admin/AdminIrissOrdersExportButton";
import { IrissGoogleContactsBackfillButton } from "@/components/admin/IrissGoogleContactsBackfillButton";
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
  irissListRowPowerKwLabel,
  irissPasutijumsToListRow,
  irissPhoneTelHref,
} from "@/lib/iriss-pasutijumi-list-row";
import { IrissBrandLogoSlot } from "@/components/admin/IrissBrandLogoSlot";
import { IRISS_ORDERS_LIST_PAGE, irissNextWindowLimit, irissWindowSlice } from "@/lib/iriss-list-window";
import {
  canonicalIrissPasutijumsListStatus,
  displayIrissPasutijumsListStatusLabel,
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
import { IrissOrderSortSelect } from "@/components/admin/IrissOrderSortSelect";
import { AdminMobileSheet } from "@/components/admin/AdminMobileSheet";
import { AdminMobileRoundBtn, AdminMobileSearchField, AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";

type SortMode = IrissOrderSortMode;

const SORT_LABEL: Record<SortMode, string> = {
  created_desc: "Jaunākie vispirms",
  created_asc: "Vecākie vispirms",
  brand_asc: "Marka A-Z",
  brand_desc: "Marka Z-A",
  budget_asc: "Budžets: zemākā",
  budget_desc: "Budžets: augstākā",
};

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

function statusBadgeClass(st: IrissPasutijumsListStatus): string {
  const canon = canonicalIrissPasutijumsListStatus(st);
  if (canon === "completed") return "bg-emerald-100 text-emerald-950";
  if (canon === "inactive") return "bg-red-100 text-red-950";
  if (canon === "reserved") return "bg-violet-100 text-violet-950";
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
  onRestore,
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
  onRestore?: (id: string) => void;
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
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const chips = buildListingPlatformChips({
    listingLinkMobile: row.listingLinkMobile,
    listingLinkAutobid: row.listingLinkAutobid,
    listingLinkOpenline: row.listingLinkOpenline,
    listingLinkAuto1: row.listingLinkAuto1,
    listingLinkEcarstrade: row.listingLinkEcarstrade,
    listingLinksOther: row.listingLinksOther,
  });
  const specSummary = formatIrissListSpecSummary(row);
  const powerKwLabel = irissListRowPowerKwLabel(row);
  const equipmentRequired = (row.equipmentRequired ?? "").trim();
  const isPinned = Boolean(row.pinnedAt);
  const statusBusy = actionBusy === row.id;
  const curStatus = row.listStatus ?? "active";
  const clientName = formatIrissClientName(row);
  const listDate = formatIrissListDate(row);
  const telHref = irissPhoneTelHref(row.phone);
  const router = useRouter();
  const href = `/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`;
  const prefetchedRef = useRef(false);
  const prefetchRow = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    void router.prefetch(href);
  }, [href, router]);

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
    const onDoc = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) {
        setStatusMenuOpen(false);
        return;
      }
      if (statusBtnRef.current?.contains(t) || statusMenuRef.current?.contains(t)) return;
      setStatusMenuOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDoc, true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onDoc, true);
    };
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
            <IrissAuctionLogo platform={c.logoKey} fallback={c.letter} size="sm" />
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
    <div className="relative flex min-h-[88px] items-center gap-2.5 py-2.5 pl-3 pr-2 md:min-h-[82px]">
      <Link
        href={href}
        prefetch={false}
        onPointerEnter={prefetchRow}
        onPointerDown={prefetchRow}
        onFocus={prefetchRow}
        aria-label={`Atvērt pasūtījumu: ${row.brandModel}`}
        className="absolute inset-0 z-0 rounded-lg"
      />
      <div className="relative z-10 shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <button
          ref={statusBtnRef}
          type="button"
          disabled={statusBusy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setStatusMenuOpen((v) => !v);
          }}
          className={`iriss-row-status inline-flex h-8 items-center gap-0.5 rounded-md px-2 text-[13px] font-semibold md:h-7 md:rounded md:px-1.5 md:text-[11px] ${
            narrowSwipeViewport ? "bg-[var(--am-fill)] font-medium text-[var(--am-ink2)]" : statusBadgeClass(curStatus)
          }`}
          aria-haspopup="menu"
          aria-expanded={statusMenuOpen}
        >
          {displayIrissPasutijumsListStatusLabel(curStatus)}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </button>
      </div>
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-start gap-2.5">
        <IrissBrandLogoSlot brandModel={row.brandModel} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[16px] font-semibold leading-snug text-[var(--color-apple-text)] sm:text-[17px]">
              {row.brandModel}
            </span>
            {powerKwLabel ? (
              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--color-apple-text)] sm:text-[14px]">
                {powerKwLabel}
              </span>
            ) : null}
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
                className="pointer-events-auto font-normal text-[var(--label-secondary)] hover:underline md:hidden"
              >
                {row.phone}
              </a>
            ) : row.phone && row.phone !== "-" && row.phone !== "\u2014" ? (
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
          {row.hasExpiredOffer ? (
            <span className="mt-0.5 inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Piedāvājums beidzies
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
      ) : row.phone && row.phone !== "-" && row.phone !== "\u2014" ? (
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
        {isIrissRecordDeleted(row) && onRestore ? (
          <button
            type="button"
            onClick={() => onRestore(row.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex h-7 items-center rounded-md px-1.5 text-[10px] font-semibold text-[var(--color-provin-accent)] hover:bg-slate-100"
          >
            Atjaunot
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAskDelete(row.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700"
            aria-label="Dzēst pasūtījumu"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  const statusMenu = statusMenuOpen ? (
    <div
      ref={statusMenuRef}
      role="menu"
      className="absolute left-3 top-[2.55rem] z-50 min-w-[7.5rem] overflow-hidden rounded-md border border-slate-200 bg-white py-0.5 shadow-lg"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {IRISS_PASUTIJUMS_PICKER_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="menuitem"
          disabled={statusBusy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setStatusMenuOpen(false);
            onSetStatus(row.id, s);
          }}
          className={`flex w-full px-2.5 py-1.5 text-left text-[11px] font-semibold ${
            canonicalIrissPasutijumsListStatus(curStatus) === s ? "bg-slate-100 text-black" : "text-black/80 hover:bg-slate-50"
          }`}
        >
          {IRISS_PASUTIJUMS_PICKER_STATUS_LV[s]}
        </button>
      ))}
    </div>
  ) : null;

  const cardInner = (
    <div
      className={`group relative overflow-visible rounded-lg border border-[#E5E7EB] bg-white shadow-none transition hover:border-slate-300 [content-visibility:auto] [contain-intrinsic-size:1px_92px] ${
        statusMenuOpen ? "z-40" : ""
      }`}
    >
      <div className="relative overflow-x-clip rounded-lg">
      {narrowSwipeViewport ? (
        <div className="absolute inset-y-0 right-0 z-0 flex bg-[#E5E7EB]" style={{ width: SWIPE_ACTION_WIDTH }}>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onPin(row.id);
            }}
            className="flex h-full w-[72px] flex-col items-center justify-center gap-0.5 bg-[#8E8E93] text-white transition active:brightness-95"
            aria-label={isPinned ? "Noņemt piespraušanu" : "Piespraust augšā"}
          >
            <Pin className="h-5 w-5" />
            <span className="text-[11px] font-semibold leading-none">{isPinned ? "Noņemt" : "Piespraust"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              if (isIrissRecordDeleted(row) && onRestore) onRestore(row.id);
              else onAskDelete(row.id);
            }}
            className={`flex h-full w-[72px] flex-col items-center justify-center gap-0.5 text-white transition active:brightness-95 ${isIrissRecordDeleted(row) ? "bg-[#34C759]" : "bg-[#FF3B30]"}`}
            aria-label={isIrissRecordDeleted(row) ? "Atjaunot pasūtījumu" : "Dzēst pasūtījumu"}
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-[11px] font-semibold leading-none">{isIrissRecordDeleted(row) ? "Atjaunot" : "Dzēst"}</span>
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
      {statusMenu}
    </div>
  );

  if (dragReorderEnabled) {
    return (
      <Reorder.Item
        value={row.id}
        dragListener={false}
        dragControls={reorderDragControls}
        className={`list-none ${statusMenuOpen ? "relative z-40" : ""}`}
      >
        {cardInner}
      </Reorder.Item>
    );
  }
  return <div className={`list-none ${statusMenuOpen ? "relative z-40" : ""}`}>{cardInner}</div>;
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
  const [sheetOpen, setSheetOpen] = useState(false);
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
    () => statusFilter.active && statusFilter.completed && statusFilter.inactive,
    [statusFilter],
  );

  const searching = searchQuery.trim().length > 0;

  const visibleRows = useMemo(
    () =>
      localRows.filter((r) => rowMatchesStatusFilter(r, statusFilter, trashOn) && irissListRowMatchesQuery(r, searchQuery)),
    [localRows, statusFilter, searchQuery, trashOn],
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
  }, [closeOtherSwipes, deleteTargetId, schedulePersistListOrder]);

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
    <IrissRowCard
      key={row.id}
      row={rowMap.get(row.id) ?? row}
      onPin={onPin}
      onAskDelete={setDeleteTargetId}
      onSetStatus={onSetStatus}
      onRestore={onRestore}
      actionBusy={actionBusy}
      registerSwipeCloser={registerSwipeCloser}
      closeOtherSwipes={closeOtherSwipes}
      narrowSwipeViewport={narrowSwipeViewport}
      dragReorderEnabled={dragReorderEnabled}
    />
  );

  return (
    <>
      <div className="md:hidden">
        <AdminMobileTopBar
          title="Pasūtījumi"
          trailing={
            <>
              <AdminMobileRoundBtn name="kartot" label={`Kārtot: ${SORT_LABEL[sortMode]}`} onClick={() => setSheetOpen(true)} />
              <AdminMobileRoundBtn name="pievienot" label="Jauns pasūtījums" href="/admin/iriss/pasutijumi/new" />
            </>
          }
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <AdminMobileSearchField value={searchQuery} onChange={setSearchQuery} placeholder="Vārds, tālrunis, marka" />
            </div>
          </div>
          <div className="mt-3">
            <IrissPasutijumiStatusFilter layout="scroll" counts={statusCounts} trashCount={trashCount} />
          </div>
        </AdminMobileTopBar>
      </div>
      <div className="sticky top-0 z-30 mb-1.5 hidden bg-[#F8F8F9] py-1 md:mb-2 md:block md:border-b md:border-slate-200/80 md:bg-[#F8F8F9]/95 md:py-2 md:backdrop-blur-sm">
        <div className="flex items-center gap-1.5 md:flex-wrap md:gap-2">
          <label className="relative min-w-0 flex-1 md:min-w-[10rem] md:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 md:left-2 md:h-3.5 md:w-3.5" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Vārds, tālrunis, marka"
              aria-label="Meklēt pasūtījumus"
              className="h-10 min-h-10 w-full rounded-[10px] border-0 bg-[#e5e5ea] pl-9 pr-3 text-base text-black outline-none placeholder:text-[#8e8e93] md:h-8 md:min-h-8 md:rounded-md md:border md:border-slate-200 md:bg-white md:pl-7 md:pr-2 md:text-[12px] md:placeholder:text-slate-400 md:ring-[var(--color-provin-accent)]/25 md:focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={`Kārtot: ${SORT_LABEL[sortMode]}`}
            title={SORT_LABEL[sortMode]}
            className="inline-flex h-10 min-h-10 w-10 shrink-0 items-center justify-center rounded-full bg-transparent text-[var(--color-apple-text)] md:hidden"
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden />
          </button>
          <div className="hidden md:contents">
            <IrissPasutijumiStatusFilter layout="wrap" counts={statusCounts} trashCount={trashCount} />
            <IrissOrderSortSelect compact />
          </div>
          <div className="ml-auto hidden items-center gap-1.5 md:flex">
            <button
              type="button"
              onClick={() => void appendEcarstradeLinks()}
              disabled={ectBusy}
              className="inline-flex h-8 items-center rounded-md border border-slate-200/90 bg-white px-2 text-[11px] font-semibold text-[var(--color-apple-text)] shadow-sm disabled:opacity-40"
              title="Atjaunot eCarsTrade saites no Auto1 / Openlane / Autobid / Mobile filtriem visiem pasūtījumiem"
            >
              {ectBusy ? "ET…" : "Atjaunot ET"}
            </button>
            <Link
              href="/admin/iriss/atskaite"
              className="inline-flex h-8 items-center rounded-md border border-slate-200/90 bg-white px-2 text-[11px] font-semibold text-[var(--color-apple-text)] shadow-sm"
            >
              Atskaite
            </Link>
            <AdminIrissOrdersExportButton compact />
          </div>
        </div>
        <div className="mt-1 bg-transparent md:hidden">
          <IrissPasutijumiStatusFilter layout="scroll" counts={statusCounts} trashCount={trashCount} />
        </div>
        {ectMsg ? <p className="mt-1 text-[11px] text-[#8e8e93]">{ectMsg}</p> : null}
        <div className="mt-1.5 flex justify-end">
          <IrissGoogleContactsBackfillButton compact />
        </div>
      </div>

      <AdminMobileSheet
        open={sheetOpen}
        title="Kārtot un filtrēt"
        onClose={() => setSheetOpen(false)}
        action={
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="mt-3 flex h-[50px] w-full items-center justify-center rounded-xl bg-[var(--color-provin-accent)] text-[17px] font-semibold text-white"
          >
            Lietot
          </button>
        }
      >
        <div className="mb-3 overflow-hidden rounded-xl bg-white">
          {SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setSortMode(mode);
                try {
                  localStorage.setItem(IRISS_ORDER_SORT_KEY, mode);
                } catch {
                  /* ignore */
                }
                window.dispatchEvent(new CustomEvent(IRISS_ORDER_SORT_EVENT, { detail: mode }));
              }}
              className="flex min-h-12 w-full items-center justify-between border-b border-[#e5e5ea] px-4 text-[17px] last:border-b-0"
            >
              {SORT_LABEL[mode]}
              {sortMode === mode ? <span className="text-[var(--color-provin-accent)]">✓</span> : null}
            </button>
          ))}
        </div>
        <div className="mb-3 bg-transparent px-1 py-1">
          <IrissPasutijumiStatusFilter layout="wrap" counts={statusCounts} trashCount={trashCount} />
        </div>
        <div className="overflow-hidden rounded-xl bg-white">
          <button
            type="button"
            onClick={() => void appendEcarstradeLinks()}
            disabled={ectBusy}
            className="flex min-h-12 w-full items-center px-4 text-left text-[17px] disabled:opacity-40"
          >
            {ectBusy ? "eCarsTrade…" : "eCarsTrade saites"}
          </button>
          <Link href="/admin/iriss/atskaite" className="flex min-h-12 items-center border-t border-[#e5e5ea] px-4 text-[17px] text-[var(--color-apple-text)]">
            Mēneša atskaite
          </Link>
          <div className="border-t border-[#e5e5ea] px-4 py-2">
            <AdminIrissOrdersExportButton compact />
          </div>
        </div>
      </AdminMobileSheet>

      <div className="flex flex-col gap-2">
        {visibleRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-[13px] text-black/60">
            {searching ? "Nekas neatbilst meklējumam." : "Nav pasūtījumu šajā filtrā."}
          </p>
        ) : null}

        {shownPinnedRows.length > 0 ? (
          dragReorderEnabled ? (
            <Reorder.Group axis="y" values={shownPinnedRows.map((r) => r.id)} onReorder={onReorderPinned} className="flex flex-col gap-2">
              {shownPinnedRows.map(renderRow)}
            </Reorder.Group>
          ) : (
            <div className="flex flex-col gap-2">{shownPinnedRows.map(renderRow)}</div>
          )
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
