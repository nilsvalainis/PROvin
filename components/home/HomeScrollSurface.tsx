"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";
import { computeHomeSilverFadeProgress, computeHomeSurfaceT } from "@/lib/home-surface";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  const blackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const tick = () => {
      const p = computeHomeSilverFadeProgress();
      const t = computeHomeSurfaceT();
      root.style.setProperty("--home-surface-t", String(t));
      if (blackRef.current) {
        blackRef.current.style.opacity = String(1 - p);
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
    <div className="relative z-0 min-h-dvh min-w-0 bg-[#050505]">
      {/* Single fixed silver; black overlay fades on scroll (no stacked gray ramps). */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#e5e7eb]" aria-hidden />

      {wireframe}

      <div
        ref={blackRef}
        className="pointer-events-none fixed inset-0 z-[2] bg-[#050505]"
        style={{ opacity: 1 }}
        aria-hidden
      />

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
