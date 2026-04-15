"use client";

import type { LenisOptions } from "lenis";
import { ReactLenis } from "lenis/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import "lenis/dist/lenis.css";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * Touch-first ierīces — dabīgais ritinājums (pull-to-refresh, OS inerciālais scroll).
 * Lenis šeit bieži salauž „velc, lai atsvaidzinātu” un justies „sausāk” nekā sistēmas scroll.
 */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return coarse;
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const coarsePointer = useCoarsePointer();
  const options = useMemo<LenisOptions>(
    () => ({
      /** Tikai desktop (fine pointer): gluds ritenis; touch paliek native. */
      lerp: 0.058,
      smoothWheel: true,
      wheelMultiplier: 1,
      anchors: true,
      autoRaf: true,
      orientation: "vertical",
    }),
    [],
  );

  if (reducedMotion || coarsePointer) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={options}>
      {children}
    </ReactLenis>
  );
}
