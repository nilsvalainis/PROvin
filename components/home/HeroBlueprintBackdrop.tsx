"use client";

import type { RefObject } from "react";
import { useEffect } from "react";
import { buildHeroBlueprintThreadPath, buildHeroChassisBlueprintPath } from "@/lib/hero-blueprint-paths";
import { sectionScrollProgress } from "@/lib/iriss-thread";

const VB = 100;

export function HeroBlueprintBackdrop({ sectionRef }: { sectionRef: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    const apply = () => {
      const node = sectionRef.current;
      if (!node) return;
      const p = mq.matches ? 1 : sectionScrollProgress(node.getBoundingClientRect(), window.innerHeight);
      node.style.setProperty("--hero-blueprint-p", p.toFixed(5));
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };

    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    mq.addEventListener("change", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mq.removeEventListener("change", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sectionRef]);

  const chassisD = buildHeroChassisBlueprintPath(VB, VB);
  const threadD = buildHeroBlueprintThreadPath(VB, VB);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <div className="home-hero-blueprint-grid absolute inset-0" />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path className="home-hero-blueprint-draw-line" pathLength={1} d={chassisD} />
        <path className="home-hero-blueprint-draw-line home-hero-blueprint-thread" pathLength={1} d={threadD} />
      </svg>
    </div>
  );
}
