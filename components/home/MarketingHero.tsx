"use client";

import { ArrowRight, ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { approvedByIrissSignatureHeroClass } from "@/lib/home-layout";
import { orderSectionHref } from "@/lib/paths";

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

/** Stikla karte — garena taisnstūra forma: režģa platums 2×, augstums ~0.7× iepriekšējā. */
const PILLAR_GLASS =
  "flex min-h-[4.9rem] w-full max-w-none flex-col justify-center rounded-lg border border-white/12 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.35)] backdrop-blur-[36px] sm:min-h-[5.6rem]";

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
      className="relative flex min-h-[100dvh] min-h-[100svh] flex-col justify-center overflow-hidden bg-black px-5 pb-16 pt-[max(5.5rem,env(safe-area-inset-top,0px)+3.25rem)] text-white sm:px-8 sm:pb-20 sm:pt-[max(5.5rem,env(safe-area-inset-top,0px)+3rem)]"
      aria-labelledby="marketing-hero-title"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-[min(100%,53.76rem)] flex-col items-center">
        <header className="relative z-20 flex w-full shrink-0 flex-col items-center gap-6 text-center sm:gap-7 md:gap-8">
          <p className={`${approvedByIrissSignatureHeroClass} text-white/70`} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <div className="w-full">
            <h1
              id="marketing-hero-title"
              className="text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[28px] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
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

          {/* 2×2 garenas kartes: režģa platums 2× iepriekšējam, augstums −30% */}
          <div className="flex w-full justify-center px-1">
            <div className="grid w-full max-w-[min(100%,37rem)] grid-cols-2 justify-items-stretch gap-x-2.5 gap-y-2 sm:max-w-[min(100%,40.5rem)] sm:gap-x-3 sm:gap-y-2.5">
              {pillars.map((p, i) => {
                const Icon = PILLAR_ICONS[i] ?? FileText;
                return (
                  <article key={`${p.title}-${i}`} className={PILLAR_GLASS}>
                    <div className="flex h-full min-h-0 w-full flex-row items-center gap-2.5 px-3 py-2.5 text-left sm:gap-3 sm:px-4 sm:py-3">
                      <Icon className="h-5 w-5 shrink-0 text-[#0066ff] sm:h-6 sm:w-6" strokeWidth={1.25} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[10px] font-semibold leading-snug tracking-tight text-white sm:text-[11px]">
                          {p.title}
                        </h3>
                        {p.body ? (
                          <p className="mt-0.5 text-[9px] font-light leading-snug text-white/70 sm:mt-1 sm:text-[10px] sm:leading-relaxed">
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
              className="provin-btn provin-btn--compact inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#0066ff] px-7 py-3.5 text-center text-[13px] font-bold uppercase tracking-[0.06em] text-white shadow-[0_0_22px_rgba(0,102,255,0.2)] ring-1 ring-white/10 sm:min-h-[3.25rem] sm:px-8 sm:text-[14px] sm:tracking-[0.07em]"
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
        className="provin-scroll-hint absolute bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex min-h-11 min-w-11 max-w-[min(100%,20rem)] -translate-x-1/2 flex-col items-center justify-center gap-2 rounded-full px-3 text-center text-[10px] font-semibold uppercase leading-snug tracking-[0.18em] text-white/45 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 sm:bottom-8 sm:min-h-0 sm:min-w-0 sm:text-[11px] sm:tracking-[0.2em]"
      >
        <span className="text-balance">{t("scrollToPricingAria")}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
