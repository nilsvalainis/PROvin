"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { approvedByIrissSignatureHeroClass } from "@/lib/home-layout";

/**
 * Pilnekrāna tumšais Hero — saturs no `Hero` ziņojumiem (kā pirms pārlikuma).
 */
export function MarketingHero() {
  const t = useTranslations("Hero");

  return (
    <section
      className="relative flex min-h-[100dvh] min-h-[100svh] flex-col justify-center bg-transparent px-5 pb-16 pt-[max(5.5rem,env(safe-area-inset-top,0px)+3.25rem)] text-white sm:px-8 sm:pb-20 sm:pt-[max(5.5rem,env(safe-area-inset-top,0px)+3rem)]"
      aria-labelledby="marketing-hero-title"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,53.76rem)] flex-col items-center text-center">
        <header className="flex shrink-0 flex-col items-center gap-6 sm:gap-7 md:gap-8">
          <p className={approvedByIrissSignatureHeroClass} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <h1
            id="marketing-hero-title"
            className="text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[28px] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
          >
            <span className="block text-white">{t("h1Line1")}</span>
            <span className="mt-0.5 block text-provin-accent sm:mt-1">{t("h1Line2")}</span>
          </h1>

          <p
            className={`${approvedByIrissSignatureHeroClass} max-w-[min(100%,52ch)] text-balance text-zinc-300`}
          >
            {t("h2")}
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
