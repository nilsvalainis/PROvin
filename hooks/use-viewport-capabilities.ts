"use client";

import { useLayoutEffect, useState } from "react";

/** Darbvirsmas pele ar hover (nav tikai touch). */
export function useFineHover(): boolean {
  const [fine, setFine] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

/**
 * Samazināta veiktspēja uz šauriem ekrāniem — izslēgt smago trokšņa slāni.
 * Heuristika: ≤4 CPU kodoli vai ≤4 GB RAM (deviceMemory), vai saveData.
 */
export function useDisableNoiseGrain(): boolean {
  const [off, setOff] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      if (!mq.matches) {
        setOff(false);
        return;
      }
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { saveData?: boolean };
      };
      const cores = nav.hardwareConcurrency ?? 8;
      const mem = nav.deviceMemory;
      const saveData = nav.connection?.saveData === true;
      const low = cores <= 4 || (mem != null && mem <= 4) || saveData;
      setOff(low);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return off;
}
