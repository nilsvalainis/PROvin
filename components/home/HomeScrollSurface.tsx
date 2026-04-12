"use client";

import { type ReactNode } from "react";
import { HomeDepthBackground } from "@/components/home/HomeDepthBackground";
import { HomeTechBgParallax } from "@/components/home/HomeTechBgParallax";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Pilna lapa — ciets #050505 + `HomeDepthBackground` + scroll-parallax `.home-tech-bg-parallax`.
 * Spidometra fona animācija īslaicīgi izņemta — tā bija saistīta ar klienta avārijām; failu `HomeSpeedometerBackground` var atkal pieslēgt pēc stabilizācijas.
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-[#050505]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      <HomeDepthBackground />

      <HomeTechBgParallax />

      {wireframe}

      <div className="pointer-events-none fixed inset-0 z-[4] home-tech-grain mix-blend-overlay" aria-hidden />

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
