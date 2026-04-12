"use client";

import { type ReactNode } from "react";
import { HomeDepthBackground } from "@/components/home/HomeDepthBackground";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Mājas čaula: plakans Deep Focus (`HomeDepthBackground`, bez Canvas/blur) → wireframe → saturs.
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  return (
    <div className="relative z-0 min-h-dvh min-w-0 max-w-full overflow-x-clip bg-[#030304]">
      <HomeDepthBackground />

      {wireframe}

      {children}
    </div>
  );
}
