"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { computeHomeSurfaceT } from "@/lib/home-surface";

type HomeScrollSurfaceProps = {
  children: ReactNode;
};

/**
 * Fixed black base + silver (#e5e7eb + grain) masked below the hero (soft edge).
 * Sets `--home-surface-t` on `document.documentElement` for header / typography.
 */
export function HomeScrollSurface({ children }: HomeScrollSurfaceProps) {
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
        const fade = 96;
        const start = Math.max(0, b - fade);
        const end = Math.min(vh, b + fade * 0.5);
        const grad = `linear-gradient(to bottom, transparent 0px, transparent ${start}px, black ${end}px, black 100%)`;
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
    <div className="relative min-w-0">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

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
