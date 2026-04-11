"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { computeHomeSurfaceT } from "@/lib/home-surface";

type HomeScrollSurfaceProps = {
  /** Flyline / wireframe starp melno (z-0) un sudrabu (z-2). */
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Slāņi: melns z-0 → flyline z-1 → viens sudraba slānis z-2 (tikai fog gradient + grauds, bez maskām) → saturs z-10.
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  const silverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = silverRef.current;

    const tick = () => {
      const t = computeHomeSurfaceT();
      root.style.setProperty("--home-surface-t", String(t));
      if (el) {
        el.style.opacity = String(t);
      }
    };

    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      root.style.removeProperty("--home-surface-t");
    };
  }, []);

  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-transparent">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      {wireframe}

      <div
        ref={silverRef}
        className="home-silver-fog-unified pointer-events-none fixed inset-0 z-[2]"
        style={{ opacity: 0 }}
        aria-hidden
      />

      {children}
    </div>
  );
}
