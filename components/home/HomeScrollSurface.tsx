"use client";

import { type ReactNode } from "react";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Pilna lapa — ciets #050505 + oklch „titanium” atspīdums + dither (bez banding / ovāla).
 * Spidometra fona animācija īslaicīgi izņemta — tā bija saistīta ar klienta avārijām; failu `HomeSpeedometerBackground` var atkal pieslēgt pēc stabilizācijas.
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-[#050505]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      <div className="pointer-events-none fixed inset-0 z-[2] home-deep-canvas-glow" aria-hidden />

      <div className="pointer-events-none fixed inset-0 z-[3] home-canvas-banding-dither" aria-hidden />

      {wireframe}

      <div className="pointer-events-none fixed inset-0 z-[4] home-tech-grain mix-blend-overlay" aria-hidden />

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
