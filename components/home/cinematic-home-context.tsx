"use client";

import {
  computeHomeCinematicFrame,
  type CinematicHomeFrame,
} from "@/lib/home-cinematic-scroll";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const defaultFrame: CinematicHomeFrame = {
  silver01: 0,
  docProgress: 0,
  scrollY: 0,
};

const CinematicHomeContext = createContext<CinematicHomeFrame>(defaultFrame);

export function useCinematicHomeFrame(): CinematicHomeFrame {
  return useContext(CinematicHomeContext);
}

export type { CinematicHomeFrame };

export function CinematicHomeProvider({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useState<CinematicHomeFrame>(defaultFrame);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    rafRef.current = null;
    const scrollY = window.scrollY || window.pageYOffset;
    const vh = window.innerHeight || 1;
    const doc = document.documentElement;
    const next = computeHomeCinematicFrame(scrollY, vh, doc.scrollHeight);
    setFrame((prev) => {
      if (
        Math.abs(prev.silver01 - next.silver01) < 0.006 &&
        Math.abs(prev.docProgress - next.docProgress) < 0.004 &&
        Math.abs(prev.scrollY - next.scrollY) < 2
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [schedule]);

  const value = useMemo(() => frame, [frame]);

  return <CinematicHomeContext.Provider value={value}>{children}</CinematicHomeContext.Provider>;
}
