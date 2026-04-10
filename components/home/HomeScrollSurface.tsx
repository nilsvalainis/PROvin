"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { computeHomeSurfaceT } from "@/lib/home-surface";

type HomeScrollSurfaceProps = {
  /** Renders between black (z-0) and silver (z-[1]) — optional; wireframe may instead sit as a sibling in page.tsx. */
  belowSilver?: ReactNode;
  children?: ReactNode;
};

/**
 * Root `relative z-0` + fixed black (z-0) → optional belowSilver → silver (z-[1]) → optional children.
 * Sets `--home-surface-t` on `document.documentElement` (0→1 over first 600px scroll).
 */
export function HomeScrollSurface({ belowSilver, children }: HomeScrollSurfaceProps) {
  const silverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = silverRef.current;

    const tick = () => {
      const t = computeHomeSurfaceT();
      root.style.setProperty("--home-surface-t", String(t));

      if (el) {
        el.style.opacity = String(t);
        const hero = document.getElementById("home-hero");
        if (!hero) {
          const full = "linear-gradient(to bottom, black 0%, black 100%)";
          el.style.maskImage = full;
          el.style.webkitMaskImage = full;
          return;
        }
        const b = hero.getBoundingClientRect().bottom;
        const vh = window.innerHeight;
        const feather = 160;
        const t0 = Math.max(0, b - feather);
        const t1 = Math.min(vh, b + feather * 0.45);
        const grad = `linear-gradient(to bottom, transparent 0px, transparent ${t0}px, black ${t1}px, black 100%)`;
        el.style.maskImage = grad;
        el.style.webkitMaskImage = grad;
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

      {belowSilver}

      <div
        ref={silverRef}
        className="provin-silver-grain pointer-events-none fixed inset-0 z-[1] bg-[#e5e7eb]"
        style={{ opacity: 0 }}
        aria-hidden
      />

      {children}
    </div>
  );
}
