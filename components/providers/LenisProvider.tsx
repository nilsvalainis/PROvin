"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import type { ReactNode } from "react";
import { useEffect } from "react";

/**
 * Maigs ritinājums (Lenis). Lieto visā lapā zem Header.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({ autoRaf: true });
    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
