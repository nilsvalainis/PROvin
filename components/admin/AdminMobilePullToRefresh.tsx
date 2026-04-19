"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const HEADER_TOP_REM = 3.5;
const PULL_THRESHOLD = 46;

function touchTargetIsInteractive(t: EventTarget | null): boolean {
  if (!(t instanceof Element)) return false;
  return Boolean(t.closest("input, textarea, button, select, option, a, [contenteditable='true']"));
}

/**
 * Mobilajā (max-md): vilkt uz leju no lapas augšas (scroll ≈ 0) un atlaidot — `router.refresh()`.
 * Papildus AdminShell galvenē ir arī tieša atsvaidzināšanas poga.
 */
export function AdminMobilePullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const pullAmt = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const finishGesture = useCallback(() => {
    const p = pullAmt.current;
    pullAmt.current = 0;
    tracking.current = false;
    setPull(0);
    if (p < PULL_THRESHOLD || busyRef.current) return;
    setBusy(true);
    router.refresh();
    window.setTimeout(() => setBusy(false), 900);
  }, [router]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onTouchStart = (e: TouchEvent) => {
      if (!mq.matches || busyRef.current) return;
      if (touchTargetIsInteractive(e.target)) return;
      if (window.scrollY > 6) return;
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      tracking.current = true;
      startY.current = y;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!mq.matches || !tracking.current || busyRef.current) return;
      if (touchTargetIsInteractive(e.target)) {
        tracking.current = false;
        pullAmt.current = 0;
        setPull(0);
        return;
      }
      if (window.scrollY > 6) {
        tracking.current = false;
        pullAmt.current = 0;
        setPull(0);
        return;
      }
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      const raw = Math.max(0, y - startY.current);
      const damped = Math.min(raw * 0.42, 76);
      pullAmt.current = damped;
      setPull(damped);
    };
    const onTouchEnd = () => {
      if (!tracking.current) return;
      finishGesture();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart, { capture: true });
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    };
  }, [finishGesture]);

  const show = pull > 6 || busy;
  const ready = pull >= PULL_THRESHOLD;

  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 z-[44] flex justify-center transition-opacity duration-150 md:hidden ${show ? "opacity-100" : "opacity-0"}`}
      style={{
        top: `${HEADER_TOP_REM}rem`,
        transform: `translateY(${Math.min(pull * 0.32, 26)}px)`,
      }}
      aria-live="polite"
    >
      <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <RefreshCw
          className={`h-4 w-4 shrink-0 text-[var(--color-provin-accent)] ${busy ? "animate-spin" : ""}`}
          strokeWidth={2.25}
          aria-hidden
          style={busy ? undefined : { transform: `rotate(${pull * 2.2}deg)` }}
        />
        <span className="text-[11px] font-semibold text-[var(--color-apple-text)]">
          {busy ? "Atjaunina…" : ready ? "Atlaidiet, lai atsvaidzinātu" : "Velciet lejup"}
        </span>
      </div>
    </div>
  );
}
