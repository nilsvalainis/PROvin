"use client";

import { type ReactNode, useEffect } from "react";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

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

      {/* Imperceptible center lift — same family as base, no bright ring */}
      <div
        className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(circle_at_center,#0a0a0a_0%,#050505_80%)]"
        aria-hidden
      />

      {wireframe}

      <div className="pointer-events-none fixed inset-0 z-[4] home-tech-grain mix-blend-overlay" aria-hidden />

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
