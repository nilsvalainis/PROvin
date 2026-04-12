"use client";

import type Lenis from "lenis";
import { useLenis } from "lenis/react";
import { useCallback, useEffect, useRef, useState } from "react";

/** „Tech” slānis — lēnāks, diskrētāks */
const K_RIM = 0.042;
/** Otrais radālis — ātrāks, lai rodas dziļuma fāze pret Hero / mākoņa zonu */
const K_DRIFT = 0.088;

/**
 * Divi fiksēti, ļoti vāji radāļi ar atšķirīgu scrollY koeficientu.
 * Klase `.home-tech-bg-parallax` — globālais fons virs `HomeDepthBackground`, zem wireframe.
 */
export function HomeTechBgParallax() {
  const rimRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const apply = useCallback((scrollY: number) => {
    const rim = rimRef.current;
    const drift = driftRef.current;
    if (!rim || !drift) return;
    if (reducedMotion) {
      rim.style.transform = "";
      drift.style.transform = "";
      return;
    }
    rim.style.transform = `translate3d(0, ${scrollY * K_RIM}px, 0)`;
    drift.style.transform = `translate3d(0, ${scrollY * K_DRIFT}px, 0)`;
  }, [reducedMotion]);

  const onLenisScroll = useCallback(
    (lenis: Lenis) => {
      apply(lenis.scroll);
    },
    [apply],
  );

  useLenis(onLenisScroll, [onLenisScroll]);

  useEffect(() => {
    if (!reducedMotion) return;
    const onScroll = () => apply(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion, apply]);

  return (
    <div
      className="home-tech-bg-parallax pointer-events-none fixed inset-0 z-[2] overflow-hidden"
      aria-hidden
    >
      <div
        ref={rimRef}
        className="home-tech-bg-parallax__rim absolute inset-x-0 will-change-transform"
        style={{
          top: "-12%",
          height: "124%",
          opacity: 0.9,
          background:
            "radial-gradient(ellipse 125% 65% at 50% 22%, rgba(0, 102, 255, 0.055) 0%, rgba(0, 80, 200, 0.02) 42%, transparent 62%)",
        }}
      />
      <div
        ref={driftRef}
        className="home-tech-bg-parallax__drift absolute inset-x-0 will-change-transform"
        style={{
          top: "-8%",
          height: "118%",
          opacity: 0.65,
          mixBlendMode: "soft-light",
          background:
            "radial-gradient(ellipse 95% 52% at 50% 58%, oklch(0.52 0.045 268 / 0.07) 0%, oklch(0.35 0.02 265 / 0.02) 38%, transparent 58%)",
        }}
      />
    </div>
  );
}
