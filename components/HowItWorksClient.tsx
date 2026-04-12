"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ClipboardPenLine, CreditCard, ScrollText } from "lucide-react";
import { homeMarketingPillarGridShellClass, homeMarketingPillarGridWidthClass } from "@/lib/home-layout";

type Step = { n: string; title: string; body: string };

const stepIconClass =
  "h-8 w-8 shrink-0 text-[#6b7280] transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassDark =
  "h-8 w-8 shrink-0 text-zinc-500 transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassSilver =
  "h-8 w-8 shrink-0 text-[#0066ff] transition-opacity group-hover:opacity-90 [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const ICON_ROW_H = "h-11";

export function HowItWorksClient({
  steps = [],
  tone = "light",
  variant = "default",
}: {
  steps?: Step[];
  tone?: "light" | "dark";
  variant?: "default" | "silver";
}) {
  const dark = tone === "dark";
  const silver = variant === "silver";
  const designDirShell = dark && !silver;

  const dash = silver ? "border-[#050505]/14" : dark ? "border-zinc-600" : "border-[#d1d5db]";
  const title = silver ? "text-[#050505]" : dark ? "text-white/90" : "text-[#1d1d1f]";
  const body = silver ? "text-[#050505]" : dark ? "text-gray-400/80" : "text-[#86868b]";

  const impulseAnchorRef = useRef<HTMLDivElement | null>(null);
  const [impulseOn, setImpulseOn] = useState(false);

  useEffect(() => {
    const el = impulseAnchorRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setImpulseOn(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setImpulseOn(true);
      },
      { root: null, rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      className="home-body-ink relative z-10 overflow-x-hidden bg-transparent"
      data-how-it-works-impulse={impulseOn ? "on" : "off"}
    >
      <div
        className={
          designDirShell
            ? "demo-design-dir__shell relative pb-5 pt-3 sm:pb-4 sm:pt-3"
            : "relative px-4 pb-5 pt-3 sm:px-6 sm:pb-4 sm:pt-3"
        }
      >
        <div className={homeMarketingPillarGridShellClass}>
          <div className={`relative ${homeMarketingPillarGridWidthClass}`}>
            <div className={`flex ${ICON_ROW_H} items-center justify-center`} aria-hidden>
              <div className={`h-8 w-px border-l border-dashed ${dash}`} />
            </div>
            <div
              ref={impulseAnchorRef}
              className="flex flex-row items-start justify-center gap-0 px-1 sm:px-0.5"
            >
              {steps.map((s, i) => (
                <Fragment key={`step-${s.n}`}>
                  <article className="group flex min-w-0 flex-1 basis-0 flex-col items-center text-center">
                    <div className={`flex w-full ${ICON_ROW_H} shrink-0 items-center justify-center`}>
                      <StepIconFrame stepIndex={i} silver={silver} dark={dark}>
                        <StepIcon n={s.n} dark={dark} silver={silver} />
                      </StepIconFrame>
                    </div>
                    <h3
                      className={`mt-2 w-full text-balance text-[10px] font-medium uppercase leading-snug tracking-[0.08em] sm:mt-2.5 sm:text-[10px] sm:tracking-[0.1em] ${title}`}
                    >
                      {s.title}
                    </h3>
                    {s.body?.trim() ? (
                      <p
                        className={`mt-1.5 w-full text-balance text-[10px] font-normal leading-snug sm:mt-2 sm:text-[11px] sm:leading-relaxed ${body}`}
                      >
                        {s.body}
                      </p>
                    ) : null}
                  </article>
                  {i < steps.length - 1 ? (
                    <div
                      key={`conn-${s.n}`}
                      className={`mx-0.5 flex min-h-0 min-w-[0.5rem] flex-1 items-center sm:mx-2 sm:min-w-[1.25rem] ${ICON_ROW_H}`}
                      aria-hidden
                    >
                      <div className={`h-0 w-full border-t border-dashed ${dash}`} />
                    </div>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepIconFrame({
  children,
  stepIndex,
  silver,
  dark,
}: {
  children: ReactNode;
  stepIndex: number;
  silver: boolean;
  dark: boolean;
}) {
  const ringMuted = silver
    ? "stroke-[#0066ff]/[0.22]"
    : dark
      ? "stroke-[#3d7fd0]/[0.28]"
      : "stroke-[#0061D2]/[0.26]";
  const haloMuted = silver
    ? "stroke-[#0066ff]/[0.18]"
    : dark
      ? "stroke-[#3d7fd0]/[0.22]"
      : "stroke-[#0061D2]/[0.2]";

  return (
    <div
      className="relative grid size-11 shrink-0 place-items-center"
      style={{ ["--how-it-works-stagger" as string]: `${stepIndex * 0.11}s` }}
    >
      <svg
        className="pointer-events-none absolute size-[2.75rem] -rotate-90 motion-reduce:hidden"
        viewBox="0 0 44 44"
        fill="none"
        aria-hidden
      >
        <circle
          className={`how-it-works-draw-ring fill-none [stroke-width:1px] ${ringMuted}`}
          cx="22"
          cy="22"
          r="18.25"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1}
          strokeLinecap="round"
        />
        <circle
          className={`how-it-works-halo-ring fill-none [stroke-width:0.75px] opacity-0 motion-reduce:hidden ${haloMuted}`}
          cx="22"
          cy="22"
          r="19.65"
        />
      </svg>
      {children}
    </div>
  );
}

function StepIcon({ n, dark, silver }: { n: string; dark?: boolean; silver?: boolean }) {
  const cls = silver ? stepIconClassSilver : dark ? stepIconClassDark : stepIconClass;
  if (n === "1") {
    return <ClipboardPenLine className={cls} aria-hidden strokeWidth={1.5} />;
  }
  if (n === "2") {
    return <CreditCard className={cls} aria-hidden strokeWidth={1.5} />;
  }
  return <ScrollText className={cls} aria-hidden strokeWidth={1.5} />;
}
