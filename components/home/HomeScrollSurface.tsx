"use client";

import { type CSSProperties, type ReactNode, useEffect } from "react";
import { computeHomeSurfaceT } from "@/lib/home-surface";

type HomeScrollSurfaceProps = {
  wireframe?: ReactNode;
  children?: ReactNode;
};

export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  useEffect(() => {
    const root = document.documentElement;
    const tick = () => {
      root.style.setProperty("--home-surface-t", String(computeHomeSurfaceT()));
    };
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      root.style.removeProperty("--home-surface-t");
    };
  }, []);

  const silverStyle: CSSProperties = {
    background: "#e5e7eb",
    maskImage: "linear-gradient(to bottom, transparent 0%, black 45vh)",
    WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 45vh)",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };

  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-transparent">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      {wireframe}

      <div
        className="pointer-events-none fixed inset-0 z-[2]"
        style={silverStyle}
        aria-hidden
      />

      {children}
    </div>
  );
}
