"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ClipboardPenLine, CreditCard, ScrollText } from "lucide-react";
import { homeMarketingPillarGridShellClass, homeMarketingPillarGridWidthClass } from "@/lib/home-layout";

type Step = { n: string; title: string; body: string };

const stepIconClass =
  "h-8 w-8 shrink-0 text-[#6b7280] transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassDark =
  "h-8 w-8 shrink-0 text-zinc-500 transition-colors group-hover:text-[#0061D2] [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassSilver =
  "h-8 w-8 shrink-0 text-[#0066ff] transition-opacity group-hover:opacity-90 [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const stepIconClassLiquid =
  "h-8 w-8 shrink-0 text-zinc-100/90 drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)] [stroke-width:1.5] sm:h-[2.3625rem] sm:w-[2.3625rem]";

const ICON_ROW_H = "h-11";

export function HowItWorksClient({
  steps = [],
  tone = "light",
  variant = "default",
}: {
  steps?: Step[];
  tone?: "light" | "dark";
  variant?: "default" | "silver" | "liquidTitanium";
}) {
  const dark = tone === "dark";
  const silver = variant === "silver";
  const liquidTitanium = variant === "liquidTitanium";

  const dash = silver ? "border-[#050505]/14" : dark ? "border-zinc-600" : "border-[#d1d5db]";
  const title = silver ? "text-[#050505]" : dark ? "text-zinc-100" : "text-[#1d1d1f]";
  const body = silver ? "text-[#050505]" : dark ? "text-zinc-400" : "text-[#86868b]";
  const stepCount = steps.length;

  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const [lifted, setLifted] = useState<boolean[]>(() => Array.from({ length: stepCount }, () => !liquidTitanium));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      mq = null;
    }
    const ro = mq?.matches === true;
    setReduceMotion(ro);
    if (ro && liquidTitanium) {
      setLifted(Array.from({ length: stepCount }, () => true));
    }
  }, [liquidTitanium, stepCount]);

  useEffect(() => {
    if (!liquidTitanium || reduceMotion) return;
    setLifted(Array.from({ length: stepCount }, () => false));
    const els = stepRefs.current.filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const idx = Number((e.target as HTMLElement).dataset.stepLift);
          if (Number.isNaN(idx)) return;
          setLifted((prev) => {
            if (prev[idx]) return prev;
            const next = [...prev];
            next[idx] = true;
            return next;
          });
        });
      },
      { root: null, rootMargin: "0px 0px -5% 0px", threshold: 0.1 },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [liquidTitanium, reduceMotion, stepCount]);

  const softConnector = (
    <div
      className="mx-0.5 flex min-h-0 min-w-[0.5rem] flex-1 items-center sm:mx-2 sm:min-w-[1.25rem]"
      aria-hidden
    >
      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />
    </div>
  );

  return (
    <section className="home-body-ink relative z-10 overflow-x-hidden bg-transparent">
      <div className="relative px-3 py-5 sm:px-6 sm:py-4">
        <div className={homeMarketingPillarGridShellClass}>
          <div className={`relative ${homeMarketingPillarGridWidthClass}`}>
            {!liquidTitanium ? (
              <div className={`flex ${ICON_ROW_H} items-center justify-center`} aria-hidden>
                <div className={`h-8 w-px border-l border-dashed ${dash}`} />
              </div>
            ) : (
              <div className={`flex ${ICON_ROW_H} items-end justify-center pb-1`} aria-hidden>
                <div className="h-6 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              </div>
            )}
            <div className="flex flex-row items-start justify-center gap-0 px-1 sm:px-0.5">
              {steps.map((s, i) => (
                <Fragment key={`step-${s.n}`}>
                  <article
                    ref={(el) => {
                      stepRefs.current[i] = el;
                    }}
                    data-step-lift={i}
                    className={`group flex min-w-0 flex-1 basis-0 flex-col items-center text-center ${
                      liquidTitanium
                        ? `will-change-transform transition-[opacity,transform] duration-[680ms] ease-out motion-reduce:transition-none ${
                            lifted[i] ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                          }`
                        : ""
                    }`}
                    style={liquidTitanium ? { transitionDelay: `${i * 95}ms` } : undefined}
                  >
                    <div className={`flex w-full ${ICON_ROW_H} shrink-0 items-center justify-center`}>
                      <StepIcon n={s.n} dark={dark} silver={silver} liquidTitanium={liquidTitanium} />
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
                    liquidTitanium ? (
                      <Fragment key={`conn-${s.n}`}>{softConnector}</Fragment>
                    ) : (
                      <div
                        key={`conn-${s.n}`}
                        className={`mx-0.5 flex min-h-0 min-w-[0.5rem] flex-1 items-center sm:mx-2 sm:min-w-[1.25rem] ${ICON_ROW_H}`}
                        aria-hidden
                      >
                        <div className={`h-0 w-full border-t border-dashed ${dash}`} />
                      </div>
                    )
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

function StepIcon({
  n,
  dark,
  silver,
  liquidTitanium,
}: {
  n: string;
  dark?: boolean;
  silver?: boolean;
  liquidTitanium?: boolean;
}) {
  const cls = silver
    ? stepIconClassSilver
    : liquidTitanium
      ? stepIconClassLiquid
      : dark
        ? stepIconClassDark
        : stepIconClass;
  if (n === "1") {
    return <ClipboardPenLine className={cls} aria-hidden strokeWidth={1.5} />;
  }
  if (n === "2") {
    return <CreditCard className={cls} aria-hidden strokeWidth={1.5} />;
  }
  return <ScrollText className={cls} aria-hidden strokeWidth={1.5} />;
}
