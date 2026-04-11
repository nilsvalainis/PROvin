"use client";

import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { buildHeroBlueprintThreadPath, buildHeroChassisBlueprintPath } from "@/lib/hero-blueprint-paths";
import { sectionScrollProgress } from "@/lib/iriss-thread";

const VB = 100;

function safeScrollProgress(node: HTMLElement): number {
  try {
    const vh = window.innerHeight;
    if (!Number.isFinite(vh) || vh <= 0) return 0;
    return sectionScrollProgress(node.getBoundingClientRect(), vh);
  } catch {
    return 0;
  }
}

/** Safari / vecāki WebKit — `MediaQueryList.addEventListener` nav visur. */
function subscribeMediaQueryChange(mq: MediaQueryList, cb: () => void): () => void {
  const mql = mq as MediaQueryList & {
    addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
    removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
  };
  try {
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    }
    mql.addListener?.(cb);
    return () => mql.removeListener?.(cb);
  } catch {
    return () => {};
  }
}

export function HeroBlueprintBackdrop({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const chassisRef = useRef<SVGPathElement>(null);
  const threadRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    let rafId = 0;
    let mq: MediaQueryList | null = null;

    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      mq = null;
    }

    const paint = () => {
      const root = sectionRef.current;
      if (!root) return;

      const reduced = mq?.matches === true;
      let p = 1;
      if (!reduced) {
        p = safeScrollProgress(root);
        if (!Number.isFinite(p)) p = 0;
      }

      const grid = gridRef.current;
      if (grid) {
        grid.style.opacity = String(0.2 + p * 0.42);
        grid.style.transform = reduced ? "none" : `scale(${0.982 + p * 0.028})`;
      }

      const dashOff = reduced ? 0 : 1 - p;
      const offStr = String(dashOff);
      for (const path of [chassisRef.current, threadRef.current]) {
        if (!path) continue;
        path.style.strokeDasharray = "1";
        path.style.strokeDashoffset = offStr;
      }
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        try {
          paint();
        } catch {
          /* dekoratīvs slānis — nedrīkst gāzt lapu */
        }
      });
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const unsubMq = mq ? subscribeMediaQueryChange(mq, schedule) : () => {};

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      unsubMq();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [sectionRef]);

  const chassisD = buildHeroChassisBlueprintPath(VB, VB);
  const threadD = buildHeroBlueprintThreadPath(VB, VB);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <div ref={gridRef} className="home-hero-blueprint-grid absolute inset-0" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path ref={chassisRef} className="home-hero-blueprint-draw-line" pathLength={1} d={chassisD} />
        <path ref={threadRef} className="home-hero-blueprint-draw-line home-hero-blueprint-thread" pathLength={1} d={threadD} />
      </svg>
    </div>
  );
}
