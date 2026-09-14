"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Props = {
  isDetailScreen: boolean;
  notice: ReactNode;
  children: ReactNode;
};

const MOBILE_MAX = 767;
const PULL_THRESHOLD_PX = 64;
const RUBBER = 0.35;
const MAX_PULL_PX = 72;

function isCoarseMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
}

/**
 * Mobilajā admin saturam. Detalizētās lapās (pasūtījums) nelietojam ligzdotu
 * ritinājumu un pull-to-refresh: tie aizturēja swipe un bieži bloķēja touch.
 * Saraksta lapās PTR paliek, bet preventDefault tikai pēc skaidra vilkiena uz leju.
 */
export function AdminShellMainWithMobilePull({ isDetailScreen, notice, children }: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const pullActiveRef = useRef(false);
  const pullPxRef = useRef(0);
  const lockingRef = useRef(false);
  const refreshingRef = useRef(false);

  const resetPull = useCallback(() => {
    pullActiveRef.current = false;
    lockingRef.current = false;
    pullPxRef.current = 0;
  }, []);

  const doRefresh = useCallback(() => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    resetPull();
    router.refresh();
    window.setTimeout(() => {
      refreshingRef.current = false;
    }, 900);
  }, [resetPull, router]);

  useEffect(() => {
    // Detalizētajā ekrānā native scroll + horizontālais swipe; PTR netraucē.
    if (isDetailScreen) return;

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
      lockingRef.current = false;
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

      // Horizontāls žests (soļu sliede u.c.) - nekad neķeram.
      if (Math.abs(rawDx) > Math.abs(rawDy)) {
        resetPull();
        return;
      }

      if (rawDy <= 0) {
        pullPxRef.current = 0;
        lockingRef.current = false;
        return;
      }

      // preventDefault tikai pēc skaidra vilkiena, citādi Safari „apēd” scroll.
      if (rawDy < 18 && !lockingRef.current) return;

      lockingRef.current = true;
      const next = Math.min(rawDy * RUBBER, MAX_PULL_PX);
      pullPxRef.current = next;
      if (next > 0) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!isCoarseMobileViewport()) return;
      if (!pullActiveRef.current) return;
      const released = pullPxRef.current;
      resetPull();
      if (released >= PULL_THRESHOLD_PX && !refreshingRef.current) {
        doRefresh();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", resetPull);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", resetPull);
    };
  }, [doRefresh, isDetailScreen, resetPull]);

  const mainPad = isDetailScreen
    ? "space-y-0 p-0"
    : "space-y-3 p-2 pt-2 sm:px-3 sm:pb-4 md:px-4 md:pb-5 lg:px-5 lg:pb-6";

  return (
    <main
      className={`min-w-0 w-full max-w-none flex-1 ${
        isDetailScreen
          ? "max-md:overflow-visible"
          : "max-md:flex max-md:min-h-0 max-md:flex-col max-md:overflow-hidden"
      } ${mainPad}`}
    >
      <div
        id="admin-main-scroll"
        ref={scrollRef}
        className={
          isDetailScreen
            ? "relative flex w-full min-w-0 flex-col"
            : "relative flex w-full min-w-0 min-h-0 flex-1 flex-col max-md:overflow-y-auto max-md:overscroll-y-contain max-md:[-webkit-overflow-scrolling:touch] md:overflow-visible"
        }
      >
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
