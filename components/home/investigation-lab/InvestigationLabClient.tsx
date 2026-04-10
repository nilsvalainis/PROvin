"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

export type InvestigationLabPillar = { title: string; body: string };

export type InvestigationLabClientProps = {
  pillars: InvestigationLabPillar[];
  eyebrow: string;
  stickyTitle: string;
  stickyLead: string;
  ctaLabel: string;
  scannerAria: string;
  orderHref: string;
};

type MouseClient = { x: number; y: number };

function MagneticIconShell({
  children,
  mouse,
  reduceMotion,
}: {
  children: ReactNode;
  mouse: MouseClient | null;
  reduceMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (reduceMotion || !mouse || !ref.current) {
      setOff({ x: 0, y: 0 });
      return;
    }
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(mouse.x - cx, mouse.y - cy);
    if (dist > 160) {
      setOff({ x: 0, y: 0 });
      return;
    }
    const pull = 0.14 * (1 - dist / 160);
    setOff({ x: (mouse.x - cx) * pull, y: (mouse.y - cy) * pull });
  }, [mouse, reduceMotion]);

  return (
    <motion.div
      ref={ref}
      animate={{ x: off.x, y: off.y }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="inline-flex"
    >
      {children}
    </motion.div>
  );
}

export function InvestigationLabClient({
  pillars,
  eyebrow,
  stickyTitle,
  stickyLead,
  ctaLabel,
  scannerAria,
  orderHref,
}: InvestigationLabClientProps) {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  const [spot, setSpot] = useState({ x: 0, y: 0 });
  const [mouseClient, setMouseClient] = useState<MouseClient | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [spotLitIndex, setSpotLitIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const run = () => {
        rafRef.current = null;
        const sec = sectionRef.current;
        if (!sec) return;
        const sr = sec.getBoundingClientRect();
        setSpot({ x: e.clientX - sr.left, y: e.clientY - sr.top });
        setMouseClient({ x: e.clientX, y: e.clientY });

        let hit: number | null = null;
        cardRefs.current.forEach((el, i) => {
          if (!el) return;
          const cr = el.getBoundingClientRect();
          if (
            e.clientX >= cr.left &&
            e.clientX <= cr.right &&
            e.clientY >= cr.top &&
            e.clientY <= cr.bottom
          ) {
            hit = i;
          }
        });
        setSpotLitIndex(hit);
      };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(run);
      }
    },
    [reduceMotion],
  );

  const onMouseLeave = useCallback(() => {
    setMouseClient(null);
    setHoveredIndex(null);
    setSpotLitIndex(null);
    const sec = sectionRef.current;
    if (sec) {
      const r = sec.getBoundingClientRect();
      setSpot({ x: r.width / 2, y: r.height / 2 });
    }
  }, []);

  useLayoutEffect(() => {
    const sec = sectionRef.current;
    if (!sec) return;
    const r = sec.getBoundingClientRect();
    setSpot({ x: r.width / 2, y: r.height * 0.35 });
  }, []);

  useEffect(() => {
    const list = pillars.map((_, i) => cardRefs.current[i]).filter(Boolean) as HTMLDivElement[];
    if (list.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        let bestI = 0;
        let bestR = 0;
        for (const en of entries) {
          const i = Number((en.target as HTMLElement).dataset.index);
          if (Number.isNaN(i)) continue;
          if (en.intersectionRatio > bestR) {
            bestR = en.intersectionRatio;
            bestI = i;
          }
        }
        if (bestR > 0.2) setActiveIndex(bestI);
      },
      { root: null, rootMargin: "-18% 0px -22% 0px", threshold: [0.08, 0.16, 0.24, 0.32, 0.48, 0.64, 0.8, 0.95] },
    );

    list.forEach((el) => obs.observe(el));
    return () => {
      obs.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [pillars]);

  const overlayBg =
    reduceMotion
      ? undefined
      : {
          background: `radial-gradient(ellipse min(100%, 420px) min(100%, 520px) at ${spot.x}px ${spot.y}px, rgba(5,5,5,0) 0%, rgba(5,5,5,0.55) 52%, rgba(5,5,5,0.88) 100%)`,
        };

  return (
    <section
      ref={sectionRef}
      id="izmeklesanas-lab"
      aria-labelledby="investigation-lab-title"
      className="relative isolate overflow-hidden bg-[#050505] px-4 py-16 text-white sm:px-6 sm:py-20 lg:py-28"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div className="pointer-events-none absolute inset-0 z-0 provin-noise-dark opacity-[0.35]" aria-hidden />

      <div className="relative z-10 mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16 lg:gap-x-14">
        <div className="relative flex min-h-[min(100vh,720px)] flex-col justify-start overflow-hidden lg:sticky lg:top-28 lg:max-h-[calc(100dvh-7rem)] lg:min-h-[calc(100dvh-8rem)]">
          <p className="sr-only">{scannerAria}</p>
          <span className="provin-lab-scanner-line z-20" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b8bcc4]">{eyebrow}</p>
          <h2
            id="investigation-lab-title"
            className="mt-4 max-w-[16ch] text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.25rem]"
          >
            {stickyTitle}
          </h2>
          <p className="mt-6 max-w-md text-sm font-extralight leading-relaxed text-[#b8bcc4] sm:text-base">
            {stickyLead}
          </p>
          <div className="mt-10 lg:mt-auto">
            <Link
              href={orderHref}
              className="lab-chrome-cta inline-flex min-h-[48px] items-center justify-center rounded-full px-7 text-[13px] font-bold tracking-wide text-[#0061d2] transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3b82f6]"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:gap-8">
          {pillars.map((p, i) => {
            const Icon = ICONS[i] ?? FileText;
            const hot = hoveredIndex === i || spotLitIndex === i;
            const scrollActive = !reduceMotion && activeIndex === i;
            const IconNode = (
              <Icon
                className={`h-9 w-9 transition-[filter,color] duration-300 sm:h-10 sm:w-10 ${
                  hot ? "text-[#e8eef8] drop-shadow-[0_0_20px_rgba(59,130,246,0.65)]" : "text-[#c0c4cc]"
                }`}
                strokeWidth={1.25}
                aria-hidden
              />
            );

            return (
              <div
                key={`${p.title}-${i}`}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                data-index={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex((h) => (h === i ? null : h))}
                className={`origin-center transition-[transform,opacity] duration-500 ease-out will-change-transform ${
                  reduceMotion
                    ? "scale-100 opacity-100"
                    : scrollActive
                      ? "scale-[1.03] opacity-100"
                      : "scale-100 opacity-[0.56]"
                }`}
              >
                <div
                  className="rounded-2xl p-px transition-[background,box-shadow] duration-300"
                  style={{
                    background: hot
                      ? "linear-gradient(45deg, #3b82f6, #60a5fa, #2563eb)"
                      : "linear-gradient(45deg, #C0C0C0, #FFFFFF, #C0C0C0)",
                    boxShadow: hot ? "0 0 0 1px rgba(59,130,246,0.35), 0 18px 48px rgba(59,130,246,0.12)" : undefined,
                  }}
                >
                  <div className="flex flex-col gap-5 rounded-2xl border border-white/[0.04] bg-zinc-950/50 px-6 py-7 backdrop-blur-md sm:flex-row sm:items-start sm:gap-6 sm:px-8 sm:py-8">
                    <div className="flex shrink-0 justify-center sm:pt-1">
                      <MagneticIconShell mouse={mouseClient} reduceMotion={!!reduceMotion}>
                        {IconNode}
                      </MagneticIconShell>
                    </div>
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <h3 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{p.title}</h3>
                      {p.body ? (
                        <p className="mt-3 text-sm font-extralight leading-relaxed text-[#b8bcc4] sm:text-[15px]">
                          {p.body}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!reduceMotion ? (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={overlayBg}
          aria-hidden
        />
      ) : null}
    </section>
  );
}
