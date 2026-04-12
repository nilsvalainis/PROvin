"use client";

import { ArrowRight, ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  approvedByIrissSignatureHeroClass,
  heroH1BlueKeywordClass,
  homeMarketingPillarGridShellClass,
  homeMarketingPillarGridWidthClass,
} from "@/lib/home-layout";
import { orderSectionHref } from "@/lib/paths";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

type HeroPillar = { title: string; body: string };

/**
 * Pilnekrāna tumšais Hero — četri inženieru pīlāri vienā rindā virs CTA (bez „kastēm”).
 */
export function MarketingHero() {
  const t = useTranslations("Hero");
  const locale = useLocale();
  const rawPillars = t.raw("pillars");
  const pillars: HeroPillar[] = Array.isArray(rawPillars) ? (rawPillars as HeroPillar[]) : [];

  return (
    <section
      id="home-hero"
      className="home-content-atmosphere relative flex min-h-[100dvh] min-h-[100svh] flex-col justify-center overflow-x-hidden px-4 pb-[max(5.5rem,calc(3.5rem+env(safe-area-inset-bottom,0px)))] pt-[max(1.5rem,env(safe-area-inset-top,0px)+1.25rem)] text-white sm:px-8 sm:pb-20 sm:pt-[max(2.25rem,env(safe-area-inset-top,0px)+1.75rem)]"
      aria-labelledby="marketing-hero-title"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,53.76rem)] flex-col items-center">
        <header className="relative z-20 flex w-full shrink-0 flex-col items-center gap-5 text-center sm:gap-7 md:gap-8">
          <p className={`${approvedByIrissSignatureHeroClass} text-white/70`} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <h1
            id="marketing-hero-title"
            className="w-full text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[clamp(1.3125rem,5.5vw+0.35rem,1.75rem)] text-white/95 max-[380px]:tracking-[-0.025em] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
          >
            <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2">
              <span className={heroH1BlueKeywordClass}>{t("h1Vin")}</span>
              <span className="text-white/95">{t("h1Un")}</span>
              <span className={heroH1BlueKeywordClass}>{t("h1Sludinajuma")}</span>
            </span>
            <span className="mt-0.5 block text-white/95 sm:mt-1">{t("h1Line2")}</span>
          </h1>

          <p
            className={`${approvedByIrissSignatureHeroClass} max-w-[min(100%,52ch)] text-balance tracking-[-0.02em] text-white/65`}
          >
            {t("h2")}
          </p>

          <DiagnosticScanLine className="mx-auto mt-1 max-w-[min(100%,42rem)] sm:mt-1.5" />

          {/* Četri pīlāri — viena horizontāla rinda virs CTA; ikona ↔ virsraksts tieši gap-6 */}
          <div className={`${homeMarketingPillarGridShellClass} mt-4 w-full sm:mt-5 md:mt-6`}>
            <div
              className={`flex w-full flex-row flex-nowrap justify-between gap-3 overflow-x-auto pb-8 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-5 md:gap-6 [&::-webkit-scrollbar]:hidden ${homeMarketingPillarGridWidthClass}`}
            >
              {pillars.map((p, i) => {
                const Icon = PILLAR_ICONS[i] ?? FileText;
                return (
                  <article
                    key={`${p.title}-${i}`}
                    className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center gap-6 px-0.5 text-center sm:px-1"
                  >
                    <Icon
                      className="h-8 w-8 shrink-0 text-[#0066ff] sm:h-9 sm:w-9 md:h-10 md:w-10"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <div className="flex min-w-0 flex-col items-center gap-2">
                      <h3 className="text-balance text-[11px] font-semibold uppercase leading-snug tracking-tight text-white/95 sm:text-[13px] md:text-[14px]">
                        {p.title}
                      </h3>
                      {p.body ? (
                        <p className="text-balance text-[10px] font-light leading-snug text-white/60 sm:text-[12px] sm:leading-relaxed md:text-[13px]">
                          {p.body}
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-7 flex w-full flex-col items-center sm:mt-9">
            <Link
              href={orderSectionHref(locale)}
              className="provin-btn provin-btn--compact inline-flex w-auto max-w-[min(100%,calc(100vw-2rem))] min-h-12 touch-manipulation items-center justify-center rounded-full bg-[#0066ff] px-6 py-3.5 text-center text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_0_22px_rgba(0,102,255,0.2)] ring-1 ring-white/10 active:brightness-95 sm:min-h-[3.25rem] sm:px-8 sm:text-[14px] sm:tracking-[0.07em]"
            >
              <span className="inline-flex items-center justify-center gap-2 text-center">
                <span className="min-w-0 whitespace-nowrap">{t("cta")}</span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
              </span>
            </Link>
          </div>
        </header>
      </div>

      <a
        href="#site-content"
        aria-label={t("scrollToPricingAria")}
        className="absolute bottom-[max(0.375rem,env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex w-[min(100%,calc(100vw-1.5rem))] max-w-[22rem] min-h-[44px] -translate-x-1/2 touch-manipulation flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-center text-[9px] font-semibold uppercase leading-snug tracking-[0.16em] text-[#a0a0a0]/75 transition-colors hover:text-[#a0a0a0] active:bg-white/[0.06] active:text-[#a0a0a0]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 sm:bottom-5 sm:min-h-[2.75rem] sm:w-max sm:gap-2 sm:px-5 sm:text-[11px] sm:tracking-[0.2em]"
      >
        <span className="w-full text-balance text-center">{t("scrollToPricingAria")}</span>
        <ChevronDown className="mx-auto h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
