"use client";

import { ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  approvedByIrissSignatureHeroClass,
  heroH1BlueKeywordClass,
  homeMarketingPillarGridShellClass,
  homeMarketingPillarGridWidthClass,
} from "@/lib/home-layout";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

type HeroPillar = { title: string; body?: string };

/**
 * Pilnekrāna tumšais Hero — centrēts saturs, četras ikonas + virsraksti, „Turpināt” (bez CTA; bez h2).
 */
export function MarketingHero() {
  const t = useTranslations("Hero");
  const rawPillars = t.raw("pillars");
  const pillars: HeroPillar[] = Array.isArray(rawPillars) ? (rawPillars as HeroPillar[]) : [];

  return (
    <section
      id="home-hero"
      className="home-content-atmosphere relative flex min-h-[100dvh] min-h-[100svh] flex-col overflow-hidden bg-transparent px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top,0px)+0.75rem)] text-white sm:px-8 sm:pb-8 sm:pt-[max(1.25rem,env(safe-area-inset-top,0px)+1rem)]"
      aria-labelledby="marketing-hero-title"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,53.76rem)] flex-1 flex-col justify-center">
        <header className="flex w-full flex-col items-center gap-5 text-center sm:gap-6 md:gap-7">
          <p className={approvedByIrissSignatureHeroClass} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <h1
            id="marketing-hero-title"
            className="w-full max-w-[min(100%,52rem)] text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[clamp(1.3125rem,5.5vw+0.35rem,1.75rem)] text-white/95 max-[380px]:tracking-[-0.025em] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
          >
            <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2">
              <span className={heroH1BlueKeywordClass}>{t("h1Vin")}</span>
              <span className="text-white/95">{t("h1Un")}</span>
              <span className={heroH1BlueKeywordClass}>{t("h1Sludinajuma")}</span>
            </span>
            <span className="mt-0.5 block text-white/95 sm:mt-1">{t("h1Line2")}</span>
          </h1>

          <DiagnosticScanLine className="mx-auto w-full max-w-[min(100%,42rem)] pt-1" />

          <div className={`${homeMarketingPillarGridShellClass} w-full pt-1`}>
            <div
              className={`flex w-full flex-row flex-nowrap justify-between gap-3 sm:gap-5 md:gap-6 ${homeMarketingPillarGridWidthClass}`}
            >
              {pillars.map((p, i) => {
                const Icon = PILLAR_ICONS[i] ?? FileText;
                return (
                  <article
                    key={`${p.title}-${i}`}
                    className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center gap-3 px-0.5 text-center sm:gap-3.5 sm:px-1"
                  >
                    <Icon
                      className="h-8 w-8 shrink-0 text-[#0066ff] sm:h-9 sm:w-9 md:h-10 md:w-10"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <h3 className="text-balance text-[11px] font-semibold uppercase leading-snug tracking-tight text-white/95 sm:text-[12px] md:text-[13px]">
                      {p.title}
                    </h3>
                  </article>
                );
              })}
            </div>
          </div>

          <a
            href="#site-content"
            aria-label={t("scrollToPricingAria")}
            className="mt-8 flex min-h-[44px] w-full max-w-[22rem] touch-manipulation flex-col items-center justify-center gap-1 self-center rounded-full px-4 py-2.5 text-center text-[9px] font-semibold uppercase leading-snug tracking-[0.16em] text-[#a0a0a0]/80 transition-colors hover:text-[#a0a0a0] active:bg-white/[0.06] sm:mt-10 sm:min-h-[2.75rem] sm:gap-2 sm:px-5 sm:text-[11px] sm:tracking-[0.2em]"
          >
            <span className="w-full text-balance text-center">{t("scrollToPricingAria")}</span>
            <ChevronDown className="mx-auto h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
          </a>
        </header>
      </div>
    </section>
  );
}
