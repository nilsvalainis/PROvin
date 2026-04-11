"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";
import { ViewportCornerMarks } from "@/components/home/ViewportCornerMarks";

/** Tikai klients — izvairās no SSR/hydration atšķirībām ar SVG useId / clipPath (bieža „Application error” iemesla). */
const HomeSpeedometerBackground = dynamic(
  () =>
    import("@/components/home/HomeSpeedometerBackground").then((m) => ({
      default: m.HomeSpeedometerBackground,
    })),
  { ssr: false, loading: () => null },
);

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Pilna lapa — ciets #050505 + oklch „titanium” atspīdums + dither (bez banding / ovāla).
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-[#050505]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      <div className="pointer-events-none fixed inset-0 z-[2] home-deep-canvas-glow" aria-hidden />

      <div className="pointer-events-none fixed inset-0 z-[3] home-canvas-banding-dither" aria-hidden />

      <HomeSpeedometerBackground />

      {wireframe}

      <div className="pointer-events-none fixed inset-0 z-[4] home-tech-grain mix-blend-overlay" aria-hidden />

      <ViewportCornerMarks />

      {children}
    </div>
  );
}
