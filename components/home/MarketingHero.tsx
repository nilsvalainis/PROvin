"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HeroConnectivityDiagram, type HeroDiagramNode } from "@/components/home/HeroConnectivityDiagram";
import { approvedByIrissSignatureHeroClass } from "@/lib/home-layout";
import { orderSectionHref } from "@/lib/paths";

/**
 * Pilnekrāna Hero ar tehnisko savienojumu shēmu (diagram) ap virsrakstu.
 */
export function MarketingHero() {
  const t = useTranslations("Hero");
  const locale = useLocale();
  const nodes = t.raw("diagramNodes") as HeroDiagramNode[];

  return (
    <section
      id="home-hero"
      className="relative flex min-h-[100dvh] min-h-[100svh] flex-col bg-transparent px-4 pb-14 pt-[max(5.5rem,env(safe-area-inset-top,0px)+3.25rem)] text-white sm:px-6 sm:pb-16 sm:pt-[max(5.5rem,env(safe-area-inset-top,0px)+3rem)]"
      aria-labelledby="marketing-hero-title"
    >
      <HeroConnectivityDiagram nodes={Array.isArray(nodes) ? nodes : []}>
        <header className="flex w-full shrink-0 flex-col items-center gap-4 sm:gap-6 md:gap-7">
          <p className={`${approvedByIrissSignatureHeroClass} text-white/70`} aria-label={t("approved")}>
            {t("approved")}
          </p>

          <h1
            id="marketing-hero-title"
            className="text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[26px] sm:text-[38px] sm:leading-[1.05] lg:text-[46px]"
          >
            <span className="block text-white">{t("h1Line1")}</span>
            <span className="mt-0.5 block text-provin-accent sm:mt-1">{t("h1Line2")}</span>
          </h1>

          <p
            className={`${approvedByIrissSignatureHeroClass} max-w-[min(100%,52ch)] text-balance tracking-[-0.02em] text-white/70`}
          >
            {t("h2")}
          </p>

          <div className="mt-1 flex w-full max-w-[min(100%,24rem)] flex-col items-center gap-3 sm:mt-2">
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
      </HeroConnectivityDiagram>

      <a
        href="#site-content"
        aria-label={t("scrollToPricingAria")}
        className="provin-scroll-hint home-hero-diagram-muted absolute bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] left-1/2 z-10 flex min-h-11 min-w-11 max-w-[min(100%,20rem)] flex-col items-center justify-center gap-2 rounded-full px-3 text-center text-[10px] font-semibold uppercase leading-snug tracking-[0.18em] transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/40 sm:bottom-8 sm:min-h-0 sm:min-w-0 sm:text-[11px] sm:tracking-[0.2em]"
      >
        <span className="text-balance">{t("scrollToPricingAria")}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
      </a>
    </section>
  );
}
