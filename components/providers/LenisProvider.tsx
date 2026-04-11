"use client";

import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";

/**
 * Globāls Lenis smooth scroll (`root`). `html` izmanto `scroll-behavior: auto`, lai nav dubultas gludināšanas.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        lerp: 0.085,
        smoothWheel: true,
        wheelMultiplier: 0.92,
        touchMultiplier: 1,
        autoRaf: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
