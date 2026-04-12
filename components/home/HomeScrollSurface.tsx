"use client";

import { type ReactNode } from "react";
import { HomeDepthBackground } from "@/components/home/HomeDepthBackground";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Mājas čaula: pamattonis (#050505) → Deep Focus spīdums (z-1) → wireframe → saturs (z-10). Bez stūru zīmēm.
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  return (
    <div className="relative z-0 min-h-dvh min-w-0 max-w-full overflow-x-clip bg-[#050505]">
      <HomeDepthBackground />

      {wireframe}

      {children}
    </div>
  );
}
