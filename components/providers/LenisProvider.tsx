"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import type { ReactNode } from "react";
import { useEffect } from "react";

/**
 * Maigs inerciālais ritinājums (Lenis) — visā publiskajā lapā zem Header.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let lenis: Lenis | null = null;
    try {
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.085,
        wheelMultiplier: 0.92,
        touchMultiplier: 1.05,
        smoothWheel: true,
      });
    } catch {
      /* Dažās videēs Lenis var mest — lapa joprojām darbojas bez smooth scroll. */
    }
    return () => {
      try {
        lenis?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return <>{children}</>;
}
