"use client";

import { useTranslations } from "next-intl";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Sadaļu vertikālais centrs — sakrīt ar sliežu etiķešu centru (scroll + resize). */
const SECTION_IDS = ["home-hero", "izmeklesanas-lab", "cena"] as const;

export function HomeProcessRail() {
  const t = useTranslations("HomeProcess");
  const asideRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [topsPx, setTopsPx] = useState<number[] | null>(null);

  const updatePositions = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const tr = track.getBoundingClientRect();
    if (tr.height < 4) return;

    const next: number[] = [];
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (!el) {
        setTopsPx(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      next.push(cy - tr.top);
    }
    setTopsPx(next);
  }, []);

  useLayoutEffect(() => {
    updatePositions();
    window.addEventListener("scroll", updatePositions, { passive: true });
    window.addEventListener("resize", updatePositions);

    const ro = new ResizeObserver(() => updatePositions());
    if (asideRef.current) ro.observe(asideRef.current);
    if (trackRef.current) ro.observe(trackRef.current);
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) ro.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", updatePositions);
      window.removeEventListener("resize", updatePositions);
      ro.disconnect();
    };
  }, [updatePositions]);

  const steps = [
    { n: "01", label: t("rail01") },
    { n: "02", label: t("rail02") },
    { n: "03", label: t("rail03") },
  ] as const;

  return (
    <aside
      ref={asideRef}
      className="pointer-events-none fixed bottom-8 left-4 top-[calc(5.5rem+env(safe-area-inset-top,0px))] z-[100] hidden min-h-0 lg:left-[max(1.5rem,calc(50%-600px-4rem))] lg:flex lg:flex-row lg:items-stretch lg:gap-4"
      aria-hidden
    >
      <div ref={trackRef} className="relative min-h-0 min-w-0 flex-1">
        {steps.map((s, i) => (
          <p
            key={s.n}
            className="home-rail-label absolute left-0 max-w-[10rem] text-left text-[10px] font-semibold uppercase leading-tight tracking-[0.22em] sm:max-w-[11rem] sm:text-[11px] sm:tracking-[0.24em]"
            style={{
              top: topsPx ? topsPx[i] : `${20 + i * 30}%`,
              transform: "translateY(-50%)",
            }}
          >
            <span className="opacity-70">{s.n}</span>
            <span className="mx-1 opacity-40" aria-hidden>
              /
            </span>
            <span className="tracking-[0.18em] sm:tracking-[0.2em]">{s.label}</span>
          </p>
        ))}
      </div>
      <div className="w-[0.5px] shrink-0 self-stretch bg-[#b8bcc4]/40" />
    </aside>
  );
}
