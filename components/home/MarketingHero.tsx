"use client";

import "@/components/home/hero-orbit-styles";
import { ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { ApprovedByIrissReveal } from "@/components/home/ApprovedByIrissReveal";
import { MarketingHeroSpeedometer } from "@/components/home/MarketingHeroSpeedometer";
import type { HeroVisualDemoVariant } from "@/lib/hero-orbit-j-presets";
import { isOrbitFamilyVariant } from "@/lib/hero-orbit-j-presets";
import {
  approvedByIrissSignatureHeroClass,
  heroH1BlueKeywordClass,
  homeMarketingPillarGridShellClass,
  homeMarketingPillarGridWidthClass,
} from "@/lib/home-layout";

export type { HeroOrbitSubvariant, HeroSilverBlackSubvariant, HeroVisualDemoVariant } from "@/lib/hero-orbit-j-presets";
export {
  HERO_DEMO_SPEEDOMETER_VARIANTS,
  HERO_ORBIT_SUBVARIANTS,
  HERO_SILVER_BLACK_SUBVARIANTS,
  isOrbitFamilyVariant,
} from "@/lib/hero-orbit-j-presets";

const PILLAR_ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

type HeroPillar = { title: string; body?: string };

const pillarTitleClass =
  "line-clamp-2 max-h-[2.4em] min-h-[2.4em] w-full max-w-[11.5rem] whitespace-pre-line text-center text-[9px] font-semibold uppercase leading-[1.2] tracking-tight text-white/95 sm:max-w-[12.5rem] sm:text-[10px]";

const pillarTitleClassC =
  "line-clamp-2 max-h-[2.4em] min-h-[2.4em] w-full max-w-[13.5rem] whitespace-pre-line text-[9px] font-semibold uppercase leading-[1.25] tracking-tight text-white/95 sm:text-[10px]";

/** Produkcijas hero orbitālais izskats — neietekmē `id` (paliek `home-hero` sānu joslai). */
export type MarketingHeroHomeOrbitPreset = "s19";

export type MarketingHeroProps = {
  /** Salīdzināšanas demo — `/demo/hero-variants`; noklusējumā nav. */
  demoVariant?: HeroVisualDemoVariant;
  /** Produkcija: S19 „Sānu sudrabs” + pilna gredzenu rotācija; nedrīkst lietot kopā ar `demoVariant`. */
  homeOrbitPreset?: MarketingHeroHomeOrbitPreset;
  /** Sekcijas `id` (demo: `demo-hero-a` utt.). */
  sectionDomId?: string;
  /** Dekoratīvs spidometrs zem virsraksta (demo). */
  demoSpeedometer?: boolean;
  /** Orbitālo gredzenu pseudo-elementu animācija: `static` = apstādināts (demo). */
  demoOrbitRings?: "spin" | "static";
};

/**
 * Pilnekrāna tumšais Hero: „APPROVED…” + H1 ekrāna centrā; četras ikonas apakšā; „Turpināt”.
 * `demoVariant` ieslēdz tikai vizuālos variantus demo lapā.
 */
export function MarketingHero({
  demoVariant,
  homeOrbitPreset,
  sectionDomId,
  demoSpeedometer = false,
  demoOrbitRings = "spin",
}: MarketingHeroProps = {}) {
  const t = useTranslations("Hero");
  const rawPillars = t.raw("pillars");
  const pillars: HeroPillar[] = Array.isArray(rawPillars) ? (rawPillars as HeroPillar[]) : [];

  const sectionId = sectionDomId ?? (demoVariant ? `demo-hero-${demoVariant}` : "home-hero");
  const titleId = demoVariant ? `marketing-hero-title-${demoVariant}` : "marketing-hero-title";
  const dv = demoVariant as string | undefined;
  const isC = dv === "c";
  const isB = dv === "b";
  const isOrbitDemo = Boolean(demoVariant && isOrbitFamilyVariant(demoVariant));
  const orbitUiClass =
    isOrbitDemo
      ? `marketing-hero-orbit-base marketing-hero-orbit--${demoVariant}`
      : !demoVariant && homeOrbitPreset === "s19"
        ? "marketing-hero-orbit-base marketing-hero-orbit--s19"
        : "";
  const isOrbitVisual = Boolean(orbitUiClass);
  const dataHeroVariantForCss = demoVariant ?? (!demoVariant && homeOrbitPreset === "s19" ? "s19" : undefined);
  const orbitRingsMode = isOrbitVisual ? (demoVariant ? demoOrbitRings : "spin") : "spin";

  const scanBlock = (
    <div className="marketing-hero-scan-wrap mx-auto w-full max-w-[min(100%,22rem)] pt-0.5 sm:max-w-[min(100%,26rem)]">
      <DiagnosticScanLine variant="rail" className="w-full" />
    </div>
  );

  const h1Block = (
    <h1
      id={titleId}
      className="marketing-hero-title w-full max-w-[min(100%,52rem)] text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[clamp(1.3125rem,5.5vw+0.35rem,1.75rem)] text-white/95 max-[380px]:tracking-[-0.025em] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]"
    >
      <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2">
        <span className={`marketing-hero-h1-blue ${heroH1BlueKeywordClass}`}>{t("h1Vin")}</span>
        <span className="text-white/95">{t("h1Un")}</span>
        <span className={`marketing-hero-h1-blue ${heroH1BlueKeywordClass}`}>{t("h1Sludinajuma")}</span>
      </span>
      <span className="marketing-hero-title-line2 mt-0.5 block text-white/95 sm:mt-1">{t("h1Line2")}</span>
    </h1>
  );

  const headerCore = (
    <>
      <ApprovedByIrissReveal text={t("approved")} className={approvedByIrissSignatureHeroClass} />
      {scanBlock}
      {h1Block}
    </>
  );

  const headerWrapped =
    isB ? (
      <header className="mx-auto flex w-full max-w-[min(100%,53.76rem)] min-h-0 flex-col items-center justify-center gap-4 self-center text-center sm:gap-5 md:gap-6">
        <div className="marketing-hero-b-glass w-full max-w-[min(100%,48rem)] px-5 py-6 sm:px-8 sm:py-7">{headerCore}</div>
      </header>
    ) : (
      <header className="mx-auto flex w-full max-w-[min(100%,53.76rem)] min-h-0 flex-col items-center justify-center gap-4 self-center text-center sm:gap-5 md:gap-6">
        {headerCore}
      </header>
    );

  const pillarGridClass = `${homeMarketingPillarGridShellClass} w-full pb-5 pt-4 sm:pb-6 sm:pt-6${isB ? " marketing-hero-b-pillars" : ""}`;

  return (
    <section
      id={sectionId}
      data-hero-variant={dataHeroVariantForCss}
      data-orbit-rings={isOrbitVisual ? orbitRingsMode : undefined}
      className={`marketing-hero-section home-content-atmosphere grid min-h-[100dvh] min-h-[100svh] w-full grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] overflow-x-hidden bg-transparent px-4 pb-[max(1.375rem,calc(env(safe-area-inset-bottom,0px)+0.625rem))] pt-[max(1rem,env(safe-area-inset-top,0px)+0.75rem)] text-white sm:px-8 sm:pb-9 sm:pt-[max(1.25rem,env(safe-area-inset-top,0px)+1rem)] ${demoVariant ? "scroll-mt-28 " : ""}${orbitUiClass}`.trim()}
      aria-labelledby={titleId}
    >
      {isOrbitVisual ? (
        <div className="marketing-hero-orbit-3d-stage" aria-hidden>
          <div className="marketing-hero-orbit-arm marketing-hero-orbit-arm--outer">
            <span className="marketing-hero-orbit-disk marketing-hero-orbit-disk--outer" />
          </div>
          <div className="marketing-hero-orbit-arm marketing-hero-orbit-arm--inner">
            <span className="marketing-hero-orbit-disk marketing-hero-orbit-disk--inner" />
          </div>
        </div>
      ) : null}
      {demoSpeedometer ? <MarketingHeroSpeedometer tone={demoVariant?.startsWith("s") ? "mono" : "default"} /> : null}
      <div className="min-h-0" aria-hidden />

      {headerWrapped}

      <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,53.76rem)] flex-col justify-end">
        <div className={pillarGridClass}>
          <div
            className={`flex w-full flex-row flex-nowrap justify-between gap-2 sm:gap-4 md:gap-5 ${homeMarketingPillarGridWidthClass}`}
          >
            {pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i] ?? FileText;
              const articleClass = isC
                ? "marketing-hero-pillar flex min-h-0 min-w-0 flex-1 basis-0 flex-row items-start gap-2.5 px-1 text-left sm:gap-3 sm:px-1"
                : "marketing-hero-pillar flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center gap-2 px-0.5 text-center sm:gap-2.5 sm:px-0.5";
              const iconClass = isC
                ? "marketing-hero-pillar-icon mt-0.5 h-5 w-5 shrink-0 text-[#0066ff] sm:h-5 sm:w-5"
                : "marketing-hero-pillar-icon h-7 w-7 shrink-0 text-[#0066ff] sm:h-7 sm:w-7 md:h-8 md:w-8";
              return (
                <article key={`${p.title}-${i}`} className={articleClass}>
                  <Icon className={iconClass} strokeWidth={1.5} aria-hidden />
                  <h3 className={`marketing-hero-pillar-title ${isC ? pillarTitleClassC : pillarTitleClass}`}>{p.title}</h3>
                </article>
              );
            })}
          </div>
        </div>

        <a
          href={demoVariant ? "#" : "#site-content"}
          onClick={demoVariant ? (e) => e.preventDefault() : undefined}
          aria-label={t("scrollToPricingAria")}
          className="mx-auto mt-1 flex min-h-[44px] w-full max-w-[22rem] touch-manipulation flex-col items-center justify-center gap-1 rounded-full px-4 py-2.5 text-center text-[9px] font-semibold uppercase leading-snug tracking-[0.16em] text-[#a0a0a0]/80 transition-colors hover:text-[#a0a0a0] active:bg-white/[0.06] sm:mt-1.5 sm:min-h-[2.75rem] sm:gap-2 sm:px-5 sm:text-[11px] sm:tracking-[0.2em]"
        >
          <span className="w-full text-balance text-center">{t("scrollToPricingAria")}</span>
          <ChevronDown className="mx-auto h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
        </a>
      </div>
    </section>
  );
}
