"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const LERP = 0.088;

/** Asimetrisks loks kreisajā „rezerves” zonā (viewBox 0–400 × 0–520). */
const GAUGE_PATH_D =
  "M 44 468 C 38 220 108 118 168 248 S 198 360 172 402";

type IrissStaggerShellProps = {
  headingClassName: string;
  bodyClassName: string;
  gapClassName: string;
  block1Heading: string;
  block1Body: string;
  block2Heading: string;
  block2Body: string;
  block3Heading: string;
  block3Body: string;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function computeDrawTarget(
  section: DOMRectReadOnly,
  block1: DOMRectReadOnly | null,
  vh: number,
): number {
  const range = section.height + vh;
  if (range <= 0) return 0;
  const tGlobal = clamp01((vh - section.top) / range);

  let peak = 0.35;
  if (block1) {
    const cy = (block1.top + block1.bottom) / 2;
    const sigma = vh * 0.24;
    const dx = (cy - vh * 0.5) / sigma;
    peak = Math.exp(-dx * dx);
  }

  return clamp01(Math.pow(tGlobal, 0.82) * (0.28 + 0.72 * peak));
}

export function IrissStaggerShell({
  headingClassName,
  bodyClassName,
  gapClassName,
  block1Heading,
  block1Body,
  block2Heading,
  block2Body,
  block3Heading,
  block3Body,
}: IrissStaggerShellProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const block1RowRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);

  const pathLenRef = useRef(0);
  const smoothedRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const [reveal, setReveal] = useState(() => [false, false, false]);
  const [reduceMotion, setReduceMotion] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onMq = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useLayoutEffect(() => {
    if (reduceMotion) {
      setReveal([true, true, true]);
    }
  }, [reduceMotion]);

  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    pathLenRef.current = len;
    p.style.strokeDasharray = `${len}`;
    const g = glowPathRef.current;
    if (g) {
      g.style.strokeDasharray = `${len}`;
    }
    if (reduceMotion) {
      smoothedRef.current = 1;
      targetRef.current = 1;
      p.style.strokeDashoffset = "0";
      if (g) g.style.strokeDashoffset = "0";
    } else {
      p.style.strokeDashoffset = `${len}`;
      if (g) g.style.strokeDashoffset = `${len}`;
    }
  }, [reduceMotion]);

  useEffect(() => {
    const root = sectionRef.current;
    if (!root || reduceMotion) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.irissIndex);
          if (!Number.isFinite(idx) || idx < 0 || idx > 2) continue;
          if (e.isIntersecting) {
            setReveal((prev) => {
              if (prev[idx]) return prev;
              const next = [...prev];
              next[idx] = true;
              return next;
            });
          }
        }
      },
      { root: null, rootMargin: "0px 0px -6% 0px", threshold: [0, 0.12, 0.22] },
    );

    root.querySelectorAll("[data-iriss-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;

    const tick = () => {
      const section = sectionRef.current?.getBoundingClientRect();
      const vh = window.innerHeight;
      if (!section) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const b1 = block1RowRef.current?.getBoundingClientRect() ?? null;
      targetRef.current = computeDrawTarget(section, b1, vh);

      smoothedRef.current += (targetRef.current - smoothedRef.current) * LERP;
      const len = pathLenRef.current;
      const off = len * (1 - smoothedRef.current);
      const p = pathRef.current;
      const g = glowPathRef.current;
      if (p && len > 0) p.style.strokeDashoffset = `${off}`;
      if (g && len > 0) g.style.strokeDashoffset = `${off}`;

      rafRef.current = requestAnimationFrame(tick);
    };

    const bump = () => {
      /* scroll/resize: mērķis tiek pārrēķināts nākamajā tick */
    };
    window.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("resize", bump, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", bump);
      window.removeEventListener("resize", bump);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion]);

  const revealClass = (i: number) => {
    const on = reveal[i];
    if (reduceMotion) {
      return on ? "opacity-100" : "opacity-0";
    }
    const base = "transition-[opacity,transform] duration-[580ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
    return on ? `${base} translate-y-0 opacity-100` : `${base} translate-y-[10px] opacity-0`;
  };

  return (
    <div ref={sectionRef} className="relative isolate mt-12 sm:mt-14 md:mt-16">
      <div className="home-iriss-stagger-atmosphere" aria-hidden />

      <svg
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
        viewBox="0 0 400 520"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <path
          ref={glowPathRef}
          d={GAUGE_PATH_D}
          fill="none"
          stroke="#0066ff"
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.28}
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(2.5px)" }}
        />
        <path
          ref={pathRef}
          d={GAUGE_PATH_D}
          fill="none"
          stroke="rgba(200,204,212,0.62)"
          strokeWidth={0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        className={`relative z-[2] flex flex-col ${gapClassName} pt-[clamp(0.75rem,2vw,1.25rem)] pb-[clamp(2.5rem,6vw,4.5rem)]`}
      >
        <div
          ref={block1RowRef}
          data-iriss-index="0"
          className={`grid grid-cols-1 gap-y-5 lg:grid-cols-2 lg:gap-x-10 xl:gap-x-16 ${revealClass(0)}`}
        >
          <div className="hidden min-h-[8rem] lg:block" aria-hidden />
          <div className="min-w-0 max-w-[min(100%,38rem)] lg:justify-self-end lg:text-right">
            <h3 className={headingClassName}>{block1Heading}</h3>
            <p className={`${bodyClassName} mt-4 text-balance`}>{block1Body}</p>
          </div>
        </div>

        <div
          data-iriss-index="1"
          className={`mx-auto min-w-0 max-w-[min(100%,42rem)] px-1 text-center sm:px-2 ${revealClass(1)}`}
        >
          <h3 className={`${headingClassName} mx-auto max-w-[min(100%,52ch)]`}>{block2Heading}</h3>
          <p className={`${bodyClassName} mt-4 whitespace-pre-line text-balance`}>{block2Body}</p>
        </div>

        <div
          data-iriss-index="2"
          className={`grid grid-cols-1 gap-y-5 lg:grid-cols-2 lg:gap-x-10 xl:gap-x-16 ${revealClass(2)}`}
        >
          <div className="min-w-0 max-w-[min(100%,38rem)] text-left">
            <h3 className={headingClassName}>{block3Heading}</h3>
            <p className={`${bodyClassName} mt-4 text-balance`}>{block3Body}</p>
          </div>
          <div className="hidden min-h-[8rem] lg:block" aria-hidden />
        </div>
      </div>
    </div>
  );
}
