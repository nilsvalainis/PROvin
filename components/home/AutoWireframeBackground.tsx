"use client";

import { useLayoutEffect, useState } from "react";

function readHomeSurfaceT(): number {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--home-surface-t").trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Blueprint dash silhouette — opacity 0.12 on hero → 0.04 on silver; stroke cools with --home-surface-t.
 */
export function AutoWireframeBackground() {
  const [t, setT] = useState(0);

  useLayoutEffect(() => {
    const tick = () => setT(readHomeSurfaceT());
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, []);

  const strokeOpacity = 0.12 * (1 - t) + 0.04 * t;
  const r = Math.round(255 + (42 - 255) * t);
  const g = Math.round(255 + (42 - 255) * t);
  const b = Math.round(255 + (42 - 255) * t);
  const stroke = `rgb(${r},${g},${b})`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[2] flex justify-center overflow-visible"
    >
      <svg
        className="w-[min(280vw,3400px)] max-w-none shrink-0 -translate-y-[4%] sm:-translate-y-[6%]"
        viewBox="0 0 1100 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMax meet"
      >
        <path
          fill="none"
          vectorEffect="non-scaling-stroke"
          stroke={stroke}
          strokeDasharray="2 4"
          strokeOpacity={strokeOpacity}
          strokeWidth={0.55}
          strokeLinecap="butt"
          d="M 200 250 C 400 150, 700 150, 900 250"
        />
      </svg>
    </div>
  );
}
