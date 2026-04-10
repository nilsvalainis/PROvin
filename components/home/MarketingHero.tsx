"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useDisableNoiseGrain } from "@/hooks/use-viewport-capabilities";

const TITLE = "VIN UN SLUDINĀJUMA AUDITS";
const SUBTITLE = "TAVS PERSONĪGAIS AUTO DETEKTĪVS";

function StaggeredText({
  text,
  className,
  delayOffset = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  delayOffset?: number;
  as?: "span" | "p";
}) {
  const reduceMotion = useReducedMotion();
  const chars = Array.from(text);

  if (reduceMotion) {
    const Comp = Tag;
    return <Comp className={className}>{text}</Comp>;
  }

  const stagger = 0.026;
  const duration = 0.52;
  const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

  return (
    <Tag className={className}>
      {chars.map((char, i) => (
        <span key={`${i}-${char}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block will-change-transform"
            initial={{ y: "115%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              delay: delayOffset + i * stagger,
              duration,
              ease,
            }}
          >
            {char === " " ? "\u00a0" : char}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/**
 * Pilnekrāna tumšais Hero — tipogrāfija, burtu stagger, trokšņa slānis, scroll indikators.
 */
export function MarketingHero() {
  const disableGrain = useDisableNoiseGrain();
  const titleLen = Array.from(TITLE).length;
  const subtitleDelay = titleLen * 0.026 + 0.12;

  return (
    <section
      className="relative flex min-h-[100dvh] min-h-[100svh] flex-col justify-center bg-[#050505] px-5 pb-16 pt-[max(5.5rem,env(safe-area-inset-top,0px)+3.25rem)] text-white sm:px-8 sm:pb-20 sm:pt-[max(5.5rem,env(safe-area-inset-top,0px)+3rem)]"
      aria-labelledby="marketing-hero-title"
    >
      {!disableGrain ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 provin-noise-dark opacity-[0.45]"
          aria-hidden
        />
      ) : null}

      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,52rem)] flex-col items-center text-center">
        <h1
          id="marketing-hero-title"
          className="text-balance font-semibold uppercase leading-[1.02] tracking-[0.04em] text-white [font-feature-settings:'tnum'_1] max-[380px]:text-[1.65rem] max-[420px]:text-[1.85rem] text-[clamp(1.75rem,5.5vw,3.75rem)]"
        >
          <span className="sr-only">{TITLE}</span>
          <span aria-hidden className="block">
            <StaggeredText text={TITLE} as="span" className="block" />
          </span>
        </h1>
        <div className="mt-6 sm:mt-8">
          <p className="text-balance text-[clamp(0.8rem,2.1vw,1.125rem)] font-medium uppercase tracking-[0.28em] text-white/72">
            <span className="sr-only">{SUBTITLE}</span>
            <span aria-hidden className="block">
              <StaggeredText text={SUBTITLE} as="span" className="block" delayOffset={subtitleDelay} />
            </span>
          </p>
        </div>
      </div>

      <a
        href="#site-content"
        className="provin-scroll-hint absolute bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-1/2 z-10 flex min-h-11 min-w-11 flex-col items-center justify-center gap-2 rounded-full px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 sm:bottom-8 sm:min-h-0 sm:min-w-0 sm:text-[11px]"
      >
        <span>Scroll to explore</span>
        <ChevronDown className="h-4 w-4 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
