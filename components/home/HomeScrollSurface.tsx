"use client";

import { type ReactNode } from "react";
import { HomeDepthBackground } from "@/components/home/HomeDepthBackground";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
  /**
   * `false` — bez fiksētā `HomeDepthBackground` un bez tumšās scroll čaulas (sākumlapas hero kā demo virs `body` fona).
   */
  showDepthBackground?: boolean;
};

/**
 * Mājas čaula: plakans Deep Focus (`HomeDepthBackground`, bez Canvas/blur) → wireframe → saturs.
 */
export function HomeScrollSurface({
  wireframe,
  children,
  showDepthBackground = true,
}: HomeScrollSurfaceProps) {
  return (
    <div
      className={`home-scroll-surface relative z-0 min-w-0 max-w-full overflow-x-hidden ${showDepthBackground ? "bg-[#030304]" : "bg-transparent"}`}
    >
      {showDepthBackground ? <HomeDepthBackground /> : null}

      {wireframe}

      {children}
    </div>
  );
}
