"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_MAIN_SCROLL_ID,
  ADMIN_MOBILE_MQ,
  ADMIN_MOBILE_PTR_HOLD_MS,
  ADMIN_MOBILE_PTR_IDLE_PX,
  ADMIN_MOBILE_PTR_LOCK_PX,
  ADMIN_MOBILE_PTR_MAX_PX,
  ADMIN_MOBILE_PTR_RUBBER,
  ADMIN_MOBILE_PTR_THRESHOLD_PX,
  adminMobilePtrLabel,
} from "@/lib/admin-mobile-shell";

type Props = {
  isDetailScreen: boolean;
  pullToRefresh: boolean;
  notice: ReactNode;
  topSlot?: ReactNode;
  children: ReactNode;
};

function isCoarseMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(ADMIN_MOBILE_MQ).matches;
}

/**
 * iPhone shell (#125): tab bar + PTR paliek. Native pan uz `#admin-main-scroll`
 * (overflow-y: auto, -webkit-overflow-scrolling: touch). #125 preventDefault +
 * overflow:hidden uz html/body bloķēja pirksta ritināšanu; šeit touchmove ir
 * pasīvs. Detalizētās lapās PTR nav, bet tas pats native scroller paliek.
 */
export function AdminShellMainWithMobilePull({ isDetailScreen, pullToRefresh, notice, topSlot, children }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullActiveRef = useRef(false);
  const pullPxRef = useRef(0);
  const lockingRef = useRef(false);
  const refreshingRef = useRef(false);

  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const resetPull = useCallback(() => {
    pullActiveRef.current = false;
    lockingRef.current = false;
    pullPxRef.current = 0;
    setPullPx(0);
  }, []);

  const doRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPullPx(48);
    pullActiveRef.current = false;
    lockingRef.current = false;
    router.refresh();
    window.setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
      setPullPx(0);
    }, ADMIN_MOBILE_PTR_HOLD_MS);
  }, [router]);

  useEffect(() => {
    if (!pullToRefresh) return;

    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!isCoarseMobileViewport()) return;
      if (refreshingRef.current) return;
      if (el.scrollTop > ADMIN_MOBILE_PTR_IDLE_PX) return;
      const t = e.touches[0];
      if (!t) return;
      startYRef.current = t.clientY;
      startXRef.current = t.clientX;
      pullActiveRef.current = true;
      lockingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isCoarseMobileViewport()) return;
      if (!pullActiveRef.current || refreshingRef.current) return;
      if (el.scrollTop > ADMIN_MOBILE_PTR_IDLE_PX) {
        resetPull();
        return;
      }
      const t = e.touches[0];
      if (!t) return;

      const rawDy = t.clientY - startYRef.current;
      const rawDx = t.clientX - startXRef.current;

      if (Math.abs(rawDx) > Math.abs(rawDy)) {
        resetPull();
        return;
      }

      if (rawDy <= 0) {
        pullPxRef.current = 0;
        lockingRef.current = false;
        setPullPx(0);
        return;
      }

      if (rawDy < ADMIN_MOBILE_PTR_LOCK_PX && !lockingRef.current) return;

      lockingRef.current = true;
      const next = Math.min(rawDy * ADMIN_MOBILE_PTR_RUBBER, ADMIN_MOBILE_PTR_MAX_PX);
      pullPxRef.current = next;
      setPullPx(next);
    };

    const onTouchEnd = () => {
      if (!isCoarseMobileViewport()) return;
      if (!pullActiveRef.current) return;
      const released = pullPxRef.current;
      const shouldRefresh = released >= ADMIN_MOBILE_PTR_THRESHOLD_PX && !refreshingRef.current;
      pullActiveRef.current = false;
      lockingRef.current = false;
      if (shouldRefresh) {
        doRefresh();
        return;
      }
      pullPxRef.current = 0;
      setPullPx(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", resetPull);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", resetPull);
    };
  }, [doRefresh, pullToRefresh, resetPull]);

  const mainPad = isDetailScreen
    ? "admin-search-gutter space-y-0 p-0"
    : "admin-search-gutter space-y-3 p-2 pt-2 sm:px-3 sm:pb-4 md:px-4 md:pb-5 lg:px-5 lg:pb-6";

  const ptrLabel = adminMobilePtrLabel(refreshing, pullPx);
  const ptrState = refreshing ? "refreshing" : pullPx > 8 ? "pulling" : "idle";

  return (
    <main className={`min-w-0 w-full max-w-none flex-1 max-md:flex max-md:h-full max-md:min-h-0 max-md:flex-col ${mainPad}`}>
      <div
        id={ADMIN_MAIN_SCROLL_ID}
        ref={scrollRef}
        className="relative flex w-full min-w-0 min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain max-md:[-webkit-overflow-scrolling:touch] md:overflow-visible"
      >
        {pullToRefresh ? (
          <div
            id="admin-ptr-indicator"
            data-admin-ptr={ptrState}
            aria-live="polite"
            className="pointer-events-none flex shrink-0 flex-col items-center justify-end overflow-hidden text-[12px] text-[#8e8e93] max-md:flex md:hidden"
            style={{ height: pullPx > 0 || refreshing ? pullPx : 0 }}
          >
            {ptrLabel ? (
              <div className="flex flex-col items-center gap-1 pb-1">
                <span
                  className={`inline-block h-[22px] w-[22px] rounded-full border-[2.4px] border-[#d1d1d6] border-t-[#8e8e93] ${
                    refreshing ? "animate-spin" : ""
                  }`}
                  aria-hidden
                />
                <span>{ptrLabel}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className={`flex w-full min-w-0 max-w-none flex-col ${isDetailScreen ? "" : "gap-3"}`}
          style={pullToRefresh && pullPx > 0 ? { transform: `translateY(${Math.max(0, pullPx - 48)}px)` } : undefined}
        >
          {notice}
          {topSlot}
          <div className="w-full min-w-0 max-w-none">{children}</div>
        </div>
      </div>
    </main>
  );
}
