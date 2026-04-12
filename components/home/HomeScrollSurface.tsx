"use client";

import { type ReactNode } from "react";
import { HomeDepthBackground } from "@/components/home/HomeDepthBackground";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Mājas čaula: #050505 + Canvas Deep Focus (`HomeDepthBackground`) → wireframe → saturs (z-10).
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
