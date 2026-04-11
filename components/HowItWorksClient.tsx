"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
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

function useInView<T extends Element>(ref: RefObject<T | null>, threshold = 0.38) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([e]) => {
        setInView(!!e?.isIntersecting);
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);

  return inView;
}

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

  const dash = silver ? "border-[#050505]/14" : dark ? "border-zinc-600" : "border-[#d1d5db]";
  const title = silver ? "text-[#050505]" : dark ? "text-zinc-100" : "text-[#1d1d1f]";
  const body = silver ? "text-[#050505]" : dark ? "text-zinc-400" : "text-[#86868b]";

  return (
    <section className="home-body-ink relative z-10 overflow-x-hidden bg-transparent">
      <div className="relative px-3 py-5 sm:px-6 sm:py-4">
        <div className={homeMarketingPillarGridShellClass}>
          <div className={`relative ${homeMarketingPillarGridWidthClass}`}>
            <div className={`flex ${ICON_ROW_H} items-center justify-center`} aria-hidden>
              <div className={`h-8 w-px border-l border-dashed ${dash}`} />
            </div>
            <div className="flex flex-row items-start justify-center gap-0 px-1 sm:px-0.5">
              {steps.map((s, i) => (
                <Fragment key={`step-${s.n}`}>
                  <HowItWorksStep
                    step={s}
                    index={i}
                    dark={dark}
                    silver={silver}
                    titleClass={title}
                    bodyClass={body}
                  />
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

function HowItWorksStep({
  step,
  index,
  dark,
  silver,
  titleClass,
  bodyClass,
}: {
  step: Step;
  index: number;
  dark: boolean;
  silver: boolean;
  titleClass: string;
  bodyClass: string;
}) {
  const articleRef = useRef<HTMLElement | null>(null);
  const inView = useInView(articleRef, 0.38);
  const [hovered, setHovered] = useState(false);
  const active = inView || hovered;

  const onEnter = useCallback(() => setHovered(true), []);
  const onLeave = useCallback(() => setHovered(false), []);

  return (
    <article
      ref={articleRef}
      className="group flex min-w-0 flex-1 basis-0 flex-col items-center text-center"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <div className={`flex w-full ${ICON_ROW_H} shrink-0 items-center justify-center`}>
        <StepIconFrame
          active={active}
          enterStaggerMs={inView ? index * 72 : 0}
          dark={dark}
          silver={silver}
        >
          <StepIcon n={step.n} dark={dark} silver={silver} />
        </StepIconFrame>
      </div>
      <h3
        className={`mt-2 w-full text-balance text-[10px] font-medium uppercase leading-snug tracking-[0.08em] sm:mt-2.5 sm:text-[10px] sm:tracking-[0.1em] ${titleClass}`}
      >
        {step.title}
      </h3>
      {step.body?.trim() ? (
        <p
          className={`mt-1.5 w-full text-balance text-[10px] font-normal leading-snug sm:mt-2 sm:text-[11px] sm:leading-relaxed ${bodyClass}`}
        >
          {step.body}
        </p>
      ) : null}
    </article>
  );
}

function StepIconFrame({
  children,
  active,
  enterStaggerMs,
  dark,
  silver,
}: {
  children: ReactNode;
  active: boolean;
  enterStaggerMs: number;
  dark: boolean;
  silver: boolean;
}) {
  const ringBorder = silver
    ? "border-[#0066ff]/22 shadow-[0_0_0_1px_rgba(0,102,255,0.05)]"
    : dark
      ? "border-[#3d7fd0]/32 shadow-[0_0_0_1px_rgba(61,127,208,0.1)]"
      : "border-[#0061D2]/20 shadow-[0_0_0_1px_rgba(0,97,210,0.06)]";

  return (
    <div className="relative inline-flex size-11 items-center justify-center">
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 rounded-full border transition-[opacity,transform] duration-500 ease-out will-change-transform",
          ringBorder,
          active ? "provin-hiw-icon-ring opacity-100" : "opacity-0",
        ].join(" ")}
        style={{ transitionDelay: active ? `${enterStaggerMs}ms` : "0ms" }}
      />
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
