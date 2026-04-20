"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  isDetailScreen: boolean;
  notice: ReactNode;
  children: ReactNode;
};

const MOBILE_MAX = 767;
const PULL_THRESHOLD_PX = 52;
const RUBBER = 0.42;
const MAX_PULL_PX = 96;

function isCoarseMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
}

/**
 * Mobilajā admin saturam — skrollējams konteiners + „slide page to refresh”.
 * iOS Safari dokumenta pull-to-refresh šajā layout bieži nestrādā; šī ir uzticama alternatīva.
 */
export function AdminShellMainWithMobilePull({ isDetailScreen, notice, children }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullActiveRef = useRef(false);
  const pullPxRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  const resetPull = useCallback(() => {
    pullActiveRef.current = false;
    pullPxRef.current = 0;
    setPullPx(0);
  }, []);

  const doRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    resetPull();
    router.refresh();
    window.setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
    }, 900);
  }, [resetPull, router]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!isCoarseMobileViewport()) return;
      if (refreshingRef.current) return;
      if (el.scrollTop > 2) return;
      const t = e.touches[0];
      if (!t) return;
      startYRef.current = t.clientY;
      startXRef.current = t.clientX;
      pullActiveRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isCoarseMobileViewport()) return;
      if (!pullActiveRef.current || refreshingRef.current) return;
      if (el.scrollTop > 2) {
        resetPull();
        return;
      }
      const t = e.touches[0];
      if (!t) return;

      const rawDy = t.clientY - startYRef.current;
      const rawDx = t.clientX - startXRef.current;

      if (rawDy <= 0) {
        pullPxRef.current = 0;
        setPullPx(0);
        return;
      }

      // Horizontāli dominējoša kustība pie saknes — nekonkurēt ar rindu swipe u.c.
      if (Math.abs(rawDx) > rawDy * 1.12 && rawDy < 28) {
        return;
      }

      const next = Math.min(rawDy * RUBBER, MAX_PULL_PX);
      pullPxRef.current = next;
      setPullPx(next);
      if (next > 0) {
        e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!isCoarseMobileViewport()) return;
      if (!pullActiveRef.current) return;
      pullActiveRef.current = false;
      const released = pullPxRef.current;
      pullPxRef.current = 0;
      setPullPx(0);
      if (released >= PULL_THRESHOLD_PX && !refreshingRef.current) {
        doRefresh();
      }
    };

    const onTouchCancel = () => {
      resetPull();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [doRefresh, resetPull]);

  const mainPad = isDetailScreen
    ? "space-y-0 p-0"
    : "space-y-3 p-2 pt-2 sm:px-3 sm:pb-4 md:px-4 md:pb-5 lg:px-5 lg:pb-6";

  return (
    <main
      className={`min-w-0 w-full max-w-none flex-1 max-md:flex max-md:min-h-0 max-md:flex-col max-md:overflow-hidden ${mainPad}`}
    >
      <div
        ref={scrollRef}
        className="relative flex w-full min-w-0 min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain max-md:[-webkit-overflow-scrolling:touch] max-md:touch-pan-y md:overflow-visible"
      >
        <div
          className="pointer-events-none sticky top-0 z-[2] flex justify-center py-1 md:hidden"
          aria-hidden
        >
          <span className="rounded-full bg-slate-100/95 px-2.5 py-0.5 text-[10px] font-semibold tracking-tight text-slate-500 shadow-sm">
            Slide page to refresh
          </span>
        </div>

        {pullPx > 0 || refreshing ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex flex-col items-center gap-1 pt-2 md:hidden"
            style={{ height: Math.max(pullPx, refreshing ? 48 : 0) }}
            aria-hidden
          >
            <RefreshCw
              className={`h-5 w-5 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
              strokeWidth={2.25}
              style={{
                transform: refreshing ? undefined : `rotate(${Math.min(pullPx / PULL_THRESHOLD_PX, 1) * 220}deg)`,
              }}
            />
            {pullPx >= PULL_THRESHOLD_PX * 0.85 && !refreshing ? (
              <span className="text-[10px] font-semibold text-slate-600">Release to refresh</span>
            ) : null}
          </div>
        ) : null}

        <div
          className={`flex w-full min-w-0 max-w-none flex-col ${isDetailScreen ? "" : "gap-3"}`}
        >
          {notice}
          <div className="w-full min-w-0 max-w-none">{children}</div>
        </div>
      </div>
    </main>
  );
}
