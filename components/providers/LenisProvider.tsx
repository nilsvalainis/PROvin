"use client";

import "lenis/dist/lenis.css";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

/**
 * Maigs inerciālais ritinājums (Lenis) — visā publiskajā lapā.
 * Lenis tiek ielādēts tikai pēc mount (dynamic import), lai moduļa init nekļūtu par klienta avāriju.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    let cancelled = false;

    import("lenis")
      .then(({ default: Lenis }) => {
        if (cancelled) return;
        try {
          lenisRef.current = new Lenis({
            autoRaf: true,
            lerp: 0.085,
            wheelMultiplier: 0.92,
            touchMultiplier: 1.05,
            smoothWheel: true,
          });
        } catch {
          lenisRef.current = null;
        }
      })
      .catch(() => {
        lenisRef.current = null;
      });

    return () => {
      cancelled = true;
      try {
        lenisRef.current?.destroy();
      } catch {
        /* ignore */
      }
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
