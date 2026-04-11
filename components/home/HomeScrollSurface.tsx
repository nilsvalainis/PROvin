"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { computeHomeSurfaceT } from "@/lib/home-surface";

type HomeScrollSurfaceProps = {
  /** Flyline / wireframe starp melno (z-0) un sudrabu (z-2). */
  wireframe?: ReactNode;
  children?: ReactNode;
};

/**
 * Slāņi: melns z-0 → wireframe z-1 → sudrabs z-2 (tumšs→sudrabs ar vieglu masku + scroll opacity) → saturs z-10.
 */
export function HomeScrollSurface({ wireframe, children }: HomeScrollSurfaceProps) {
  const silverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = silverRef.current;

    const tick = () => {
      const t = computeHomeSurfaceT();
      root.style.setProperty("--home-surface-t", String(t));
      if (el) {
        el.style.opacity = String(t);
      }
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

  return (
    <div className="relative z-0 min-h-dvh min-w-0 bg-transparent">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden />

      {wireframe}

      <div
        ref={silverRef}
        className="pointer-events-none fixed inset-0 z-[2] [mask-image:linear-gradient(to_bottom,transparent_0%,black_18vh,black_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18vh,black_100%)]"
        style={{ opacity: 0 }}
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(229,231,235,0)_0%,#e5e7eb_20vh,#e5e7eb_100%)]"
          aria-hidden
        />
        <div className="provin-silver-grain absolute inset-0 bg-[#e5e7eb]" aria-hidden />
      </div>

      {children}
    </div>
  );
}
