"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { sectionScrollProgress } from "@/lib/iriss-thread";

function subscribeMq(mq: MediaQueryList, cb: () => void): () => void {
  const mql = mq as MediaQueryList & {
    addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
    removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
  };
  try {
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    }
    mql.addListener?.(cb);
    return () => mql.removeListener?.(cb);
  } catch {
    return () => {};
  }
}

/**
 * VARIANT 3 — šķidrais titāns: sudraba / zili „šķidrie” slāņi, kas slīd ar scroll (--liquid-t uz Hero sekciju).
 */
export function HeroLiquidMetalBackdrop({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  const rafRef = useRef(0);

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      mq = null;
    }

    const paint = () => {
      const root = sectionRef.current;
      if (!root) return;
      try {
        const vh = window.innerHeight;
        if (!Number.isFinite(vh) || vh <= 0) return;
        const t = mq?.matches ? 0.45 : sectionScrollProgress(root.getBoundingClientRect(), vh);
        root.style.setProperty("--liquid-t", String(Number.isFinite(t) ? t : 0));
      } catch {
        root.style.setProperty("--liquid-t", "0.35");
      }
    };

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        paint();
      });
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const unsubMq = mq ? subscribeMq(mq, schedule) : () => {};

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      unsubMq();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sectionRef]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[#050505]" />
      <div className="home-hero-liquid-blob home-hero-liquid-blob-1" />
      <div className="home-hero-liquid-blob home-hero-liquid-blob-2" />
      <div className="home-hero-liquid-blob home-hero-liquid-blob-3" />
      <div className="home-hero-liquid-blob home-hero-liquid-blob-4" />
      <div className="home-hero-liquid-veil absolute inset-0" />
    </div>
  );
}
