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

export function LenisProvider({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const options = useMemo<LenisOptions>(
    () => ({
      lerp: 0.11,
      smoothWheel: true,
      anchors: true,
      autoRaf: true,
      orientation: "vertical",
    }),
    [],
  );

  if (reducedMotion) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={options}>
      {children}
    </ReactLenis>
  );
}
