"use client";

import { useCinematicHomeFrame } from "@/components/home/cinematic-home-context";
import { useEffect, useState } from "react";

/**
 * Sudraba tekstūras slānis + „metāla” spotlight (scroll + pele).
 */
export function SilverWashSpotlight() {
  const { silver01 } = useCinematicHomeFrame();
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.45 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: e.clientX / Math.max(1, window.innerWidth),
        y: e.clientY / Math.max(1, window.innerHeight),
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const spotX = mouse.x * 100;
  const spotY = mouse.y * 100;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[1] bg-[length:6px_6px] will-change-opacity"
        style={{
          opacity: silver01 * 0.58,
          backgroundImage:
            "linear-gradient(90deg,rgba(255,255,255,0.05)_0.5px,transparent 0.5px),linear-gradient(rgba(255,255,255,0.04)_0.5px,transparent 0.5px)",
          backgroundColor: "rgba(212,214,220,0.78)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-[2] mix-blend-soft-light will-change-[background]"
        style={{
          opacity: 0.32 + silver01 * 0.38,
          background: `radial-gradient(ellipse 58% 45% at ${spotX}% ${spotY}%, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0) 62%)`,
        }}
        aria-hidden
      />
    </>
  );
}
