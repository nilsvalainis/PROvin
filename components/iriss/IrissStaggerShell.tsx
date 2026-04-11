"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  buildIrissThreadPath,
  sampleThreadTicks,
  sectionScrollProgress,
  type ThreadTick,
} from "@/lib/iriss-thread";

const LERP_MAIN = 0.084;
const LERP_GHOST_A = 0.069;
const LERP_GHOST_B = 0.054;

const SILVER = "#C0C0C0";
const GLOW = "#0066ff";

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

function setPathDashOffset(ref: RefObject<SVGPathElement | null>, t: number, len: number) {
  const node = ref.current;
  if (!node || len <= 0) return;
  node.style.strokeDashoffset = `${len * (1 - t)}`;
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
  const pathMainRef = useRef<SVGPathElement>(null);
  const pathGlowRef = useRef<SVGPathElement>(null);
  const pathGhostARef = useRef<SVGPathElement>(null);
  const pathGhostBRef = useRef<SVGPathElement>(null);
  const tickGroupRef = useRef<SVGGElement>(null);

  const pathLenRef = useRef(0);
  const targetRef = useRef(0);
  const smoothMainRef = useRef(0);
  const smoothGhostARef = useRef(0);
  const smoothGhostBRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [ticks, setTicks] = useState<ThreadTick[]>([]);
  const [reveal, setReveal] = useState(() => [false, false, false]);
  const [reduceMotion, setReduceMotion] = useState(false);

  const pathD = useMemo(() => {
    if (!dims || dims.w < 8 || dims.h < 8) return "";
    return buildIrissThreadPath(dims.w, dims.h);
  }, [dims]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onMq = () => setReduceMotion(mq.matches);
    /* Safari < 14: tikai addListener/removeListener */
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onMq);
      return () => mq.removeEventListener("change", onMq);
    }
    mq.addListener(onMq);
    return () => mq.removeListener(onMq);
  }, []);

  useLayoutEffect(() => {
    if (reduceMotion) {
      setReveal([true, true, true]);
    }
  }, [reduceMotion]);

  useLayoutEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let ro: ResizeObserver | null = null;
    let raf = 0;

    const flush = () => {
      raf = 0;
      /* Tikai offsetHeight — max(offset,scroll) + RO var izsaukt setState katru kadru un „Maximum update depth”. */
      const w = Math.max(32, Math.round(el.offsetWidth));
      const h = Math.max(100, Math.round(el.offsetHeight));
      setDims((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(flush);
    };

    schedule();
    requestAnimationFrame(schedule);

    if (typeof ResizeObserver !== "undefined") {
      try {
        ro = new ResizeObserver(schedule);
        ro.observe(el);
      } catch {
        /* ResizeObserver dažos režīmos var mest */
      }
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const p = pathMainRef.current;
    if (!p || !pathD || !dims) return;

    let len = 0;
    try {
      len = p.getTotalLength();
    } catch {
      pathLenRef.current = 0;
      setTicks([]);
      return;
    }
    if (!Number.isFinite(len) || len < 8) {
      pathLenRef.current = 0;
      setTicks([]);
      return;
    }

    pathLenRef.current = len;

    const dash = `${len}`;
    const paths = [pathMainRef, pathGlowRef, pathGhostARef, pathGhostBRef];
    paths.forEach((ref) => {
      const node = ref.current;
      if (!node) return;
      node.style.strokeDasharray = dash;
    });

    let sampled: ThreadTick[] = [];
    try {
      sampled = sampleThreadTicks(p, dims.w, dims.h);
    } catch {
      sampled = [];
    }
    setTicks(sampled);

    if (reduceMotion) {
      paths.forEach((ref) => {
        const node = ref.current;
        if (!node) return;
        node.style.strokeDashoffset = "0";
      });
      smoothMainRef.current = 1;
      smoothGhostARef.current = 1;
      smoothGhostBRef.current = 1;
      targetRef.current = 1;
      requestAnimationFrame(() => {
        tickGroupRef.current?.querySelectorAll("line[data-s]").forEach((el) => {
          (el as SVGLineElement).setAttribute("stroke-opacity", "0.72");
        });
      });
    } else {
      paths.forEach((ref) => {
        const node = ref.current;
        if (!node) return;
        node.style.strokeDashoffset = dash;
      });
      const t = targetRef.current;
      smoothMainRef.current = t;
      smoothGhostARef.current = t;
      smoothGhostBRef.current = t;
      requestAnimationFrame(() => {
        tickGroupRef.current?.querySelectorAll("line[data-s]").forEach((el) => {
          (el as SVGLineElement).setAttribute("stroke-opacity", "0");
        });
      });
    }
  }, [pathD, dims, reduceMotion]);

  useEffect(() => {
    const root = sectionRef.current;
    if (!root || reduceMotion) return;

    if (typeof IntersectionObserver === "undefined") {
      setReveal([true, true, true]);
      return;
    }

    let io: IntersectionObserver | null = null;
    try {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const raw = (e.target as HTMLElement).getAttribute("data-iriss-index");
            const idx = raw == null ? NaN : Number(raw);
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
        {
          root: null,
          /* Agrāk -6% bieži nekad nesasniedza slieksni → bloki palika opacity-0 */
          rootMargin: "0px",
          threshold: [0, 0.05, 0.12],
        },
      );
    } catch {
      setReveal([true, true, true]);
      return;
    }
    if (!io) {
      setReveal([true, true, true]);
      return;
    }

    const obs = io;
    root.querySelectorAll("[data-iriss-index]").forEach((el) => obs.observe(el));

    let revealTimer: number | undefined;
    if (typeof window !== "undefined") {
      revealTimer = window.setTimeout(() => {
        setReveal((prev) => (prev.every(Boolean) ? prev : [true, true, true]));
      }, 2800);
    }

    return () => {
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
      obs.disconnect();
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;

    const fadeTicks = (drawT: number) => {
      const g = tickGroupRef.current;
      if (!g) return;
      const len = pathLenRef.current;
      if (len <= 0) return;
      if (!Number.isFinite(drawT)) return;
      const fade = Math.max(12, len * 0.038);
      const head = drawT * len;
      g.querySelectorAll("line[data-s]").forEach((el) => {
        const rawS = el.getAttribute("data-s");
        const s = rawS == null ? NaN : Number(rawS);
        if (!Number.isFinite(s)) return;
        const o = head >= s ? Math.min(0.9, (head - s) / fade) : 0;
        el.setAttribute("stroke-opacity", String(o));
      });
    };

    const tick = () => {
      try {
        const section = sectionRef.current?.getBoundingClientRect();
        const vh = window.innerHeight;
        if (!section) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const tgt = sectionScrollProgress(section, vh);
        targetRef.current = Number.isFinite(tgt) ? tgt : 0;

        smoothMainRef.current += (targetRef.current - smoothMainRef.current) * LERP_MAIN;
        smoothGhostARef.current += (targetRef.current - smoothGhostARef.current) * LERP_GHOST_A;
        smoothGhostBRef.current += (targetRef.current - smoothGhostBRef.current) * LERP_GHOST_B;

        if (!Number.isFinite(smoothMainRef.current)) smoothMainRef.current = targetRef.current;
        if (!Number.isFinite(smoothGhostARef.current)) smoothGhostARef.current = targetRef.current;
        if (!Number.isFinite(smoothGhostBRef.current)) smoothGhostBRef.current = targetRef.current;

        smoothMainRef.current = Math.min(1, Math.max(0, smoothMainRef.current));
        smoothGhostARef.current = Math.min(1, Math.max(0, smoothGhostARef.current));
        smoothGhostBRef.current = Math.min(1, Math.max(0, smoothGhostBRef.current));

        const len = pathLenRef.current;
        setPathDashOffset(pathMainRef, smoothMainRef.current, len);
        setPathDashOffset(pathGlowRef, smoothMainRef.current, len);
        setPathDashOffset(pathGhostARef, smoothGhostARef.current, len);
        setPathDashOffset(pathGhostBRef, smoothGhostBRef.current, len);
        fadeTicks(smoothMainRef.current);
      } catch {
        /* neļaujam rAF salauzt visu lapu */
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const bump = () => {};
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

  const w = dims?.w ?? 0;
  const h = dims?.h ?? 0;
  const gAx = w * 0.0068;
  const gAy = -h * 0.0045;
  const gBx = -w * 0.0055;
  const gBy = h * 0.0038;

  return (
    <div ref={sectionRef} className="relative isolate mt-12 sm:mt-14 md:mt-16">
      <div className="home-iriss-stagger-atmosphere" aria-hidden />

      {dims && pathD ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
          width="100%"
          height="100%"
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <g transform={`translate(${gBx},${gBy})`}>
            <path
              ref={pathGhostBRef}
              d={pathD}
              fill="none"
              stroke={SILVER}
              strokeWidth={0.35}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g transform={`translate(${gAx},${gAy})`}>
            <path
              ref={pathGhostARef}
              d={pathD}
              fill="none"
              stroke={SILVER}
              strokeWidth={0.38}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.26}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <path
            ref={pathGlowRef}
            d={pathD}
            fill="none"
            stroke={GLOW}
            strokeWidth={1.05}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.3}
            vectorEffect="non-scaling-stroke"
            style={{ filter: "blur(2.8px)" }}
          />
          <g ref={tickGroupRef}>
            {ticks.map((t, i) => (
              <line
                key={`iriss-tick-${i}-${Math.round(t.s * 1000)}`}
                data-s={String(t.s)}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={SILVER}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                strokeOpacity={reduceMotion ? 0.72 : 0}
              />
            ))}
          </g>
          <path
            ref={pathMainRef}
            d={pathD}
            fill="none"
            stroke={SILVER}
            strokeWidth={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}

      <div
        className={`relative z-[2] flex flex-col ${gapClassName} pt-[clamp(0.75rem,2vw,1.25rem)] pb-[clamp(2.5rem,6vw,4.5rem)]`}
      >
        <div
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
