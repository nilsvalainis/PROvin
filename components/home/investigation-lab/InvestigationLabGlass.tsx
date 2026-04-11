"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

export type InvestigationPillar = { ref: string; title: string; body: string };

const CLUSTER_POS = [
  "z-10 max-lg:relative max-lg:mx-auto max-lg:mb-3 lg:absolute lg:left-[2%] lg:top-[4%] lg:w-[min(100%,20rem)]",
  "z-10 max-lg:relative max-lg:mx-auto max-lg:mb-3 lg:absolute lg:right-[2%] lg:top-[12%] lg:w-[min(100%,20rem)]",
  "z-10 max-lg:relative max-lg:mx-auto max-lg:mb-3 lg:absolute lg:bottom-[8%] lg:left-[4%] lg:w-[min(100%,20rem)]",
  "z-10 max-lg:relative max-lg:mx-auto max-lg:mb-3 lg:absolute lg:bottom-[4%] lg:right-[4%] lg:w-[min(100%,20rem)]",
] as const;

function anchorOnRectTowardHub(
  hub: { x: number; y: number },
  rect: DOMRect,
  container: DOMRect,
): { x: number; y: number } {
  const l = rect.left - container.left;
  const r = rect.right - container.left;
  const t = rect.top - container.top;
  const b = rect.bottom - container.top;
  const mx = (l + r) / 2;
  const my = (t + b) / 2;
  const dx = mx - hub.x;
  const dy = my - hub.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      return { x: l, y: Math.max(t + 6, Math.min(b - 6, my)) };
    }
    return { x: r, y: Math.max(t + 6, Math.min(b - 6, my)) };
  }
  if (dy > 0) {
    return { x: Math.max(l + 6, Math.min(r - 6, mx)), y: t };
  }
  return { x: Math.max(l + 6, Math.min(r - 6, mx)), y: b };
}

export type InvestigationLabGlassProps = {
  pillars: InvestigationPillar[];
  trustHeadline: string;
  trustBody: string;
  cta: string;
  orderHref: string;
};

export function InvestigationLabGlass({
  pillars,
  trustHeadline,
  trustBody,
  cta,
  orderHref,
}: InvestigationLabGlassProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLElement | null)[]>([]);
  const [paths, setPaths] = useState<string[]>([]);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const hub = hubRef.current;
    if (!wrap || !hub || typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setPaths([]);
      return;
    }
    const c = wrap.getBoundingClientRect();
    const h = hub.getBoundingClientRect();
    const hubPt = { x: h.left + h.width / 2 - c.left, y: h.top + h.height / 2 - c.top };
    const next: string[] = [];
    for (let i = 0; i < pillars.length; i++) {
      const el = nodeRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const a = anchorOnRectTowardHub(hubPt, r, c);
      next.push(`M ${hubPt.x} ${hubPt.y} L ${a.x} ${a.y}`);
    }
    setPaths(next);
  }, [pillars.length]);

  useLayoutEffect(() => {
    measure();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const mq = window.matchMedia("(min-width: 1024px)");
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
    };
  }, [measure]);

  return (
    <section
      id="izmeklesanas-lab"
      aria-labelledby="investigation-lab-trust"
      className="relative z-10 overflow-hidden bg-transparent px-4 py-10 sm:px-6 sm:py-12"
    >
      <div className="relative mx-auto max-w-[1100px]">
        <div ref={wrapRef} className="relative min-h-0 w-full lg:min-h-[26rem]">
          <div ref={hubRef} className="relative z-20 mb-8 max-w-[min(100%,26rem)] text-[#050505] lg:mb-5">
            <p id="investigation-lab-trust" className="text-[12px] font-bold leading-snug tracking-tight">
              {trustHeadline}
            </p>
            <div className="mt-4 space-y-3">
              <Link
                href={orderHref}
                className="provin-btn provin-btn--compact home-cta-blueprint inline-flex min-h-[44px] w-fit max-w-[min(100%,18rem)] items-center justify-center gap-2 rounded-[2px] px-6 text-[12px] font-semibold uppercase tracking-[0.06em] ring-0 shadow-none sm:text-[13px]"
              >
                {cta}
                <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
              </Link>
              {trustBody.trim() ? (
                <p className="text-[10px] font-normal leading-relaxed text-[#050505] sm:leading-relaxed">{trustBody}</p>
              ) : null}
            </div>
          </div>

          <svg
            className="pointer-events-none absolute inset-0 z-0 max-lg:hidden h-full w-full overflow-visible"
            aria-hidden
          >
            {paths.map((d, i) => (
              <path
                key={`wire-${pillars[i]?.ref ?? i}`}
                d={d}
                fill="none"
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="square"
              />
            ))}
          </svg>

          {pillars.map((p, i) => {
            const Icon = ICONS[i] ?? FileText;
            const pos = CLUSTER_POS[i] ?? CLUSTER_POS[0];
            return (
              <article
                key={`${p.ref}-${p.title}`}
                ref={(el) => {
                  nodeRefs.current[i] = el;
                }}
                className={`relative bg-transparent max-w-md lg:max-w-[19rem] ${pos}`}
              >
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2.5">
                  <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-center sm:gap-1">
                    <Icon className="h-6 w-6 shrink-0 text-[#050505]" strokeWidth={1.15} aria-hidden />
                    <span className="font-mono text-[7px] font-medium uppercase tracking-[0.06em] text-[#050505]">
                      {p.ref}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[12px] font-bold leading-snug text-[#050505]">{p.title}</h3>
                    <p className="mt-1 text-[10px] font-normal leading-relaxed text-[#050505]">{p.body}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
