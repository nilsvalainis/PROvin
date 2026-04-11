"use client";

import { ArrowRight, ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { approvedByIrissSignatureHeroClass } from "@/lib/home-layout";
import { orderSectionHref } from "@/lib/paths";

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

/** Stikla karte — garena taisnstūra; augstums −20%, režģa platums +10% (konteineris). */
const PILLAR_GLASS =
  "flex min-h-[4rem] w-full max-w-none flex-col justify-center rounded-lg border border-white/12 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.35)] backdrop-blur-[36px] sm:min-h-[5.5rem]";

type HeroPillar = { ref: string; title: string; body: string };

/**
 * Pilnekrāna tumšais Hero — četri pīlāri 2×2 (garena taisnstūra) starp apakšvirsrakstu un CTA.
 */
export function MarketingHero() {
  const t = useTranslations("Hero");
  const locale = useLocale();
  const pillars = t.raw("pillars") as HeroPillar[];

  return (
    <section
      id="home-hero"
      className="relative flex min-h-[100dvh] min-h-[100svh] flex-col justify-center overflow-x-hidden bg-black px-4 pb-[max(5.5rem,calc(3.5rem+env(safe-area-inset-bottom,0px)))] pt-[max(1.5rem,env(safe-area-inset-top,0px)+1.25rem)] text-white sm:px-8 sm:pb-20 sm:pt-[max(2.25rem,env(safe-area-inset-top,0px)+1.75rem)]"
      aria-labelledby="marketing-hero-title"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,53.76rem)] flex-col items-center">
        <header className="relative z-20 flex w-full shrink-0 flex-col items-center gap-5 text-center sm:gap-7 md:gap-8">
          <p className={`${approvedByIrissSignatureHeroClass} text-white/70`} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <div className="w-full">
            <h1
              id="marketing-hero-title"
              className="text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[clamp(1.3125rem,5.5vw+0.35rem,1.75rem)] max-[380px]:tracking-[-0.025em] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
            >
              <span className="block text-white">{t("h1Line1")}</span>
              <span className="mt-0.5 block text-white sm:mt-1">{t("h1Line2")}</span>
            </h1>
          </div>

          <p
            className={`${approvedByIrissSignatureHeroClass} max-w-[min(100%,52ch)] text-balance tracking-[-0.02em] text-white/70`}
          >
            {t("h2")}
          </p>

          {/* 2×2 garenas kartes: režģa platums +10%, bloku min-augstums −20% */}
          <div className="flex w-full justify-center">
            <div className="grid w-full max-w-full grid-cols-2 justify-items-stretch gap-x-2 gap-y-2 sm:max-w-[min(100%,40.7rem)] sm:gap-x-3 sm:gap-y-2.5 md:max-w-[min(100%,44.55rem)]">
              {pillars.map((p, i) => {
                const Icon = PILLAR_ICONS[i] ?? FileText;
                return (
                  <article key={`${p.title}-${i}`} className={PILLAR_GLASS}>
                    <div className="flex h-full min-h-0 w-full flex-row items-start gap-2 px-2 py-2 text-left sm:items-center sm:gap-3.5 sm:px-5 sm:py-2.5 md:px-6 md:py-3">
                      <Icon
                        className="mt-0.5 h-7 w-7 shrink-0 text-[#0066ff] sm:mt-0 sm:h-[1.875rem] sm:w-[1.875rem] md:h-[2.25rem] md:w-[2.25rem]"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                        <h3 className="text-[12px] font-semibold leading-[1.25] tracking-tight text-white sm:text-[15px] sm:leading-snug md:text-[17px]">
                          {p.title}
                        </h3>
                        {p.body ? (
                          <p className="mt-1 text-[11px] font-light leading-snug text-white/70 sm:mt-1.5 sm:text-[13.5px] sm:leading-snug md:text-[15px] md:leading-relaxed">
                            {p.body}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-0 flex w-full max-w-[min(100%,24rem)] flex-col items-center gap-3 sm:mt-0">
            <Link
              href={orderSectionHref(locale)}
              className="provin-btn provin-btn--compact inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-[#0066ff] px-6 py-3.5 text-center text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_0_22px_rgba(0,102,255,0.2)] ring-1 ring-white/10 active:brightness-95 sm:min-h-[3.25rem] sm:px-8 sm:text-[14px] sm:tracking-[0.07em]"
            >
              <span className="inline-flex max-w-full items-center justify-center gap-2 text-center">
                <span className="min-w-0 text-balance">{t("cta")}</span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
              </span>
            </Link>
          </div>
        </header>
      </div>

      <a
        href="#site-content"
        aria-label={t("scrollToPricingAria")}
        className="absolute bottom-[max(0.375rem,env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex w-[min(100%,calc(100vw-1.5rem))] max-w-[22rem] min-h-[44px] -translate-x-1/2 touch-manipulation flex-col items-center justify-center gap-1 rounded-full px-3 py-2 text-center text-[9px] font-semibold uppercase leading-snug tracking-[0.16em] text-white/45 transition-colors hover:text-white/70 active:bg-white/[0.06] active:text-white/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 sm:bottom-5 sm:min-h-[2.75rem] sm:w-max sm:gap-2 sm:px-5 sm:text-[11px] sm:tracking-[0.2em]"
      >
        <span className="w-full text-balance text-center">{t("scrollToPricingAria")}</span>
        <ChevronDown className="mx-auto h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
