"use client";

import { type ReactNode } from "react";
import { HomeDepthBackground } from "@/components/home/HomeDepthBackground";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Mājas čaula: pamattonis (#050505) → Deep Focus spīdums (z-1) → wireframe → saturs (z-10).
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-[#050505]">
      <HomeDepthBackground />

      {wireframe}

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
