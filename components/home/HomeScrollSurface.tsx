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
    <div className="home-scroll-surface relative z-0 min-w-0 max-w-full overflow-x-hidden bg-[#030304]">
      <HomeDepthBackground />
      {/* SVG trokšņa dithering pret gradient banding — virs dziļuma fona, zem satura */}
      <div className="home-bg-grain" aria-hidden />

      {wireframe}

      {children}
    </div>
  );
}
