"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDisableNoiseGrain } from "@/hooks/use-viewport-capabilities";
import { approvedByIrissSignatureHeroClass } from "@/lib/home-layout";

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
 * Pilnekrāna tumšais Hero — saturs no `Hero` ziņojumiem (kā pirms pārlikuma).
 */
export function MarketingHero() {
  const t = useTranslations("Hero");
  const disableGrain = useDisableNoiseGrain();

  const h1Line1 = t("h1Line1");
  const h1Line2 = t("h1Line2");
  const h2 = t("h2");
  const line1Len = Array.from(h1Line1).length;
  const line2Delay = line1Len * 0.026 + 0.08;
  const line2Len = Array.from(h1Line2).length;
  const h2Delay = line2Delay + line2Len * 0.026 + 0.12;

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

      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,53.76rem)] flex-col items-center text-center">
        <header className="flex shrink-0 flex-col items-center gap-6 sm:gap-7 md:gap-8">
          <p className={approvedByIrissSignatureHeroClass} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <h1
            id="marketing-hero-title"
            className="text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[28px] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
          >
            <span className="sr-only">
              {h1Line1} {h1Line2}
            </span>
            <span aria-hidden className="block text-white">
              <StaggeredText text={h1Line1} as="span" className="block" />
            </span>
            <span aria-hidden className="mt-0.5 block text-provin-accent sm:mt-1">
              <StaggeredText text={h1Line2} as="span" className="block" delayOffset={line2Delay} />
            </span>
          </h1>

          <p className={`${approvedByIrissSignatureHeroClass} max-w-[min(100%,52ch)] text-balance text-zinc-300`}>
            <StaggeredText text={h2} as="span" className="block" delayOffset={h2Delay} />
          </p>
        </header>
      </div>

      <a
        href="#site-content"
        aria-label={t("scrollToPricingAria")}
        className="provin-scroll-hint absolute bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-1/2 z-10 flex min-h-11 min-w-11 max-w-[min(100%,20rem)] flex-col items-center justify-center gap-2 rounded-full px-3 text-center text-[10px] font-semibold uppercase leading-snug tracking-[0.18em] text-white/45 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 sm:bottom-8 sm:min-h-0 sm:min-w-0 sm:text-[11px] sm:tracking-[0.2em]"
      >
        <span className="text-balance">{t("scrollToPricingAria")}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
