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

/** iPhone / iPod / iPad (WebKit) — Lenis + inerciālais ritinājums bieži konfliktē; atstājam native scroll. */
function useIOSNativeScroll(): boolean {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    setIos(/iPhone|iPod|iPad/.test(ua) || iPadOS);
  }, []);
  return ios;
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();
  const iosNativeScroll = useIOSNativeScroll();
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

  if (reducedMotion || iosNativeScroll) {
    return <>{children}</>;
  }

  return (
    <ReactLenis root options={options}>
      {children}
    </ReactLenis>
  );
}
