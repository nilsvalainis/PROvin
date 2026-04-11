"use client";

import { type ReactNode, useEffect } from "react";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Pilna lapa — ciets #050505, bez sudraba fade; --home-surface-t = 0 (tumšā tinte zem .home-below-hero).
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--home-surface-t", "0");
    return () => {
      root.style.removeProperty("--home-surface-t");
    };
  }, []);

  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-[#050505]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      <div
        className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_72%_58%_at_50%_38%,rgba(255,255,255,0.045)_0%,rgba(5,5,5,0.35)_48%,#050505_78%)]"
        aria-hidden
      />

      {wireframe}

      <div className="pointer-events-none fixed inset-0 z-[4] home-tech-grain mix-blend-overlay" aria-hidden />

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
