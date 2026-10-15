"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
import { IRISS_LISTINGS_MOBILE_PAGE, irissNextWindowLimit, irissWindowSlice } from "@/lib/iriss-list-window";

export const IRISS_LISTING_PAGE_SIZE = 40;
export const IRISS_LISTING_ROW_ESTIMATE_PX = 300;
const OVERSCAN = 3;

type Props<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
};

function useIrissMobileViewport(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(ADMIN_MOBILE_MQ);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(ADMIN_MOBILE_MQ).matches,
    () => false,
  );
}

/**
 * Desktop: lappuse + logs (kā iepriekš).
 * Mobilajā: bez iekšējā ritinātāja, lai darbojas lapas pull-to-refresh, un porcijas aug ritinot.
 */
export function IrissListingVirtualList<T>({ items, getKey, renderItem }: Props<T>) {
  const mobile = useIrissMobileViewport();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [mobileLimit, setMobileLimit] = useState(IRISS_LISTINGS_MOBILE_PAGE);
  const [win, setWin] = useState({ start: 0, end: Math.min(IRISS_LISTING_PAGE_SIZE, items.length) });

  const pageCount = Math.max(1, Math.ceil(items.length / IRISS_LISTING_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * IRISS_LISTING_PAGE_SIZE;
  const pageItems = useMemo(
    () => items.slice(pageStart, pageStart + IRISS_LISTING_PAGE_SIZE),
    [items, pageStart],
  );
  const mobileWindow = irissWindowSlice(items, mobileLimit, true);

  const listSig = `${items.length}:${items[0] ? getKey(items[0]) : ""}:${items[items.length - 1] ? getKey(items[items.length - 1]!) : ""}`;
  useEffect(() => {
    setPage(0);
    setMobileLimit(IRISS_LISTINGS_MOBILE_PAGE);
  }, [listSig]);

  useEffect(() => {
    if (mobile) return;
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop;
      const height = el.clientHeight || 800;
      const start = Math.max(0, Math.floor(top / IRISS_LISTING_ROW_ESTIMATE_PX) - OVERSCAN);
      const visible = Math.ceil(height / IRISS_LISTING_ROW_ESTIMATE_PX) + OVERSCAN * 2;
      setWin({ start, end: Math.min(pageItems.length, start + visible) });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [mobile, pageItems.length, safePage]);

  useEffect(() => {
    if (!mobile || !mobileWindow.hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setMobileLimit((current) => irissNextWindowLimit(current, items.length, IRISS_LISTINGS_MOBILE_PAGE));
      },
      { root: null, rootMargin: "700px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, mobile, mobileWindow.hasMore]);

  if (mobile) {
    const shown = mobileWindow.items;
    const from = items.length === 0 ? 0 : 1;
    const to = shown.length;
    return (
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8e8e93]">
          <span>
            {from}-{to} no {items.length}
          </span>
        </div>
        <div className="space-y-1.5">
          {shown.map((item) => (
            <div key={getKey(item)}>{renderItem(item)}</div>
          ))}
          {mobileWindow.hasMore ? <div ref={sentinelRef} className="h-px w-full" aria-hidden /> : null}
        </div>
      </div>
    );
  }

  const start = Math.min(win.start, pageItems.length);
  const end = Math.max(start, Math.min(win.end, pageItems.length));
  const topPad = start * IRISS_LISTING_ROW_ESTIMATE_PX;
  const bottomPad = Math.max(0, pageItems.length - end) * IRISS_LISTING_ROW_ESTIMATE_PX;
  const from = items.length === 0 ? 0 : pageStart + 1;
  const to = Math.min(pageStart + pageItems.length, items.length);

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8e8e93]">
        <span>
          {from}-{to} no {items.length}
        </span>
        {pageCount > 1 ? (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-7 rounded-md bg-[#e9e9ee] px-2 font-semibold text-[#3a3a3c] disabled:opacity-35"
            >
              Iepriekšējā
            </button>
            <span className="px-1 tabular-nums">
              {safePage + 1}/{pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="h-7 rounded-md bg-[#e9e9ee] px-2 font-semibold text-[#3a3a3c] disabled:opacity-35"
            >
              Nākamā
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={scrollerRef}
        className="max-h-[min(78vh,920px)] space-y-1.5 overflow-y-auto overscroll-y-contain sm:space-y-2"
      >
        {topPad > 0 ? <div aria-hidden style={{ height: topPad }} /> : null}
        {pageItems.slice(start, end).map((item) => (
          <div key={getKey(item)} className="[content-visibility:auto] [contain-intrinsic-size:300px]">
            {renderItem(item)}
          </div>
        ))}
        {bottomPad > 0 ? <div aria-hidden style={{ height: bottomPad }} /> : null}
      </div>
    </div>
  );
}
