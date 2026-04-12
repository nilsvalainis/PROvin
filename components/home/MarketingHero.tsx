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
  homeHeroSubtitleClass,
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
export type MarketingHeroHomeOrbitPreset = "s19" | "s20";

export type MarketingHeroProps = {
  /** Salīdzināšanas demo — `/demo/hero-variants`; noklusējumā nav. */
  demoVariant?: HeroVisualDemoVariant;
  /** Produkcija: S19 / S20 (melns+sudrabs, pilna gredzenu rotācija); nedrīkst lietot kopā ar `demoVariant`. */
  homeOrbitPreset?: MarketingHeroHomeOrbitPreset;
  /** Sekcijas `id` (demo: `demo-hero-a` utt.). */
  sectionDomId?: string;
  /** Dekoratīvs spidometrs zem virsraksta (demo). */
  demoSpeedometer?: boolean;
  /** Orbitālo gredzenu pseudo-elementu animācija: `static` = apstādināts (demo). */
  demoOrbitRings?: "spin" | "static";
};

const sectionBasePad =
  "px-4 pb-[max(1.375rem,calc(env(safe-area-inset-bottom,0px)+0.625rem))] pt-[max(1rem,env(safe-area-inset-top,0px)+0.75rem)] sm:px-8 sm:pb-9 sm:pt-[max(1.25rem,env(safe-area-inset-top,0px)+1rem)]";

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
  const homeOrbitKey =
    !demoVariant && (homeOrbitPreset === "s19" || homeOrbitPreset === "s20") ? homeOrbitPreset : undefined;
  const orbitUiClass =
    isOrbitDemo
      ? `marketing-hero-orbit-base marketing-hero-orbit--${demoVariant}`
      : homeOrbitKey
        ? `marketing-hero-orbit-base marketing-hero-orbit--${homeOrbitKey}`
        : "";
  const isOrbitVisual = Boolean(orbitUiClass);
  const dataHeroVariantForCss = demoVariant ?? homeOrbitKey;
  const orbitRingsMode = isOrbitVisual ? (demoVariant ? demoOrbitRings : "spin") : "spin";

  const scanBlockOrbit = (
    <div className="marketing-hero-scan-wrap marketing-hero-scan-wrap--orbit mx-auto flex w-full max-w-[min(100%,17rem)] justify-center sm:max-w-[min(100%,18.5rem)]">
      <DiagnosticScanLine variant="rail" className="w-full max-w-full" />
    </div>
  );

  const scanBlockDefault = (
    <div className="marketing-hero-scan-wrap mx-auto w-full max-w-[min(100%,22rem)] pt-0.5 sm:max-w-[min(100%,26rem)]">
      <DiagnosticScanLine variant="rail" className="w-full" />
    </div>
  );

  const heroTitleStack = (
    <div className="flex w-full flex-col items-center text-center">
      <h1
        id={titleId}
        className={
          isOrbitVisual
            ? `marketing-hero-title marketing-hero-title--orbit w-full text-balance font-semibold text-white/95 max-[380px]:tracking-[-0.025em]`
            : `marketing-hero-title w-full max-w-[min(100%,52rem)] text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[clamp(1.3125rem,5.5vw+0.35rem,1.75rem)] text-white/95 max-[380px]:tracking-[-0.025em] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]`
        }
      >
        <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2">
          <span className={`marketing-hero-h1-blue ${heroH1BlueKeywordClass}`}>{t("h1Vin")}</span>
          <span className="text-white/95">{t("h1Un")}</span>
          <span className={`marketing-hero-h1-blue ${heroH1BlueKeywordClass}`}>{t("h1Sludinajuma")}</span>
        </span>
        <span className="marketing-hero-title-line2 mt-0.5 block text-white/95 sm:mt-1">{t("h1Line2")}</span>
      </h1>
      <p
        className={`${homeHeroSubtitleClass} mx-auto mt-2.5 max-w-[min(100%,36rem)] text-balance text-[11px] font-medium uppercase leading-snug tracking-[0.14em] text-white/48 sm:mt-3 sm:text-[12px] sm:tracking-[0.16em]`}
      >
        {t("h2")}
      </p>
    </div>
  );

  const approvedBlock = <ApprovedByIrissReveal text={t("approved")} className={approvedByIrissSignatureHeroClass} />;

  /** Orbit: 1fr / auto / 1fr pār `min-h-[100dvh]` — skenēšanas līnijas vertikālais centrs sakrīt ar riņķu centru. */
  const orbitHeroHeader = isB ? (
    <header className="pointer-events-none absolute inset-0 z-[1] flex min-h-[min(100dvh,100svh)] w-full items-center justify-center px-4 sm:px-8">
      <div className="marketing-hero-b-glass marketing-hero-orbit-b-glass-shell pointer-events-auto grid h-[min(100dvh,100svh)] w-full max-w-[min(100%,48rem)] min-h-0 grid-rows-[1fr_auto_1fr] px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex min-h-0 flex-col items-center justify-end pb-2 text-center">{approvedBlock}</div>
        <div className="flex w-full flex-col items-center text-center">{scanBlockOrbit}</div>
        <div className="flex min-h-0 flex-col items-center justify-start pt-1.5 text-center">{heroTitleStack}</div>
      </div>
    </header>
  ) : (
    <header className="pointer-events-none absolute inset-0 z-[1] grid min-h-[min(100dvh,100svh)] w-full grid-rows-[1fr_auto_1fr]">
      <div className="pointer-events-auto flex min-h-0 w-full flex-col items-center justify-end px-4 pb-2 text-center sm:px-8">
        {approvedBlock}
      </div>
      <div className="pointer-events-auto mx-auto w-full max-w-[min(100%,53.76rem)] px-4 text-center sm:px-8">{scanBlockOrbit}</div>
      <div className="pointer-events-auto flex min-h-0 w-full flex-col items-center justify-start px-4 pt-1.5 text-center sm:px-8">
        {heroTitleStack}
      </div>
    </header>
  );

  const headerWrappedDefault = isB ? (
    <header className="mx-auto flex w-full max-w-[min(100%,53.76rem)] min-h-0 flex-col items-center justify-center gap-4 self-center text-center sm:gap-5 md:gap-6">
      <div className="marketing-hero-b-glass w-full max-w-[min(100%,48rem)] px-5 py-6 sm:px-8 sm:py-7">
        {approvedBlock}
        {scanBlockDefault}
        {heroTitleStack}
      </div>
    </header>
  ) : (
    <header className="mx-auto flex w-full max-w-[min(100%,53.76rem)] min-h-0 flex-col items-center justify-center gap-4 self-center text-center sm:gap-5 md:gap-6">
      {approvedBlock}
      {scanBlockDefault}
      {heroTitleStack}
    </header>
  );

  const pillarGridClass = `${homeMarketingPillarGridShellClass} w-full pb-5 pt-4 sm:pb-6 sm:pt-6${isB ? " marketing-hero-b-pillars" : ""}`;

  const pillarsAndCta = (
    <>
      <div className={pillarGridClass}>
        <div className="marketing-hero-pillar-dock w-full rounded-2xl border border-white/[0.08] bg-[rgb(3_4_6/0.55)] px-2 py-3 shadow-[0_20px_52px_rgb(0_0_0/0.42)] backdrop-blur-md sm:px-3 sm:py-4 md:px-4">
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
      </div>

      <a
        href={demoVariant ? "#" : "#site-content"}
        onClick={demoVariant ? (e) => e.preventDefault() : undefined}
        aria-label={t("scrollToPricingAria")}
        className="group mx-auto mt-2 flex min-h-[44px] w-full max-w-[22rem] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-center text-[9px] font-semibold uppercase leading-snug tracking-[0.16em] text-white/55 shadow-[0_16px_40px_rgb(0_0_0/0.35)] transition-[border-color,background-color,color,box-shadow] duration-200 hover:border-[#0066ff]/28 hover:bg-[#0066ff]/[0.09] hover:text-white/85 active:bg-white/[0.07] sm:mt-2.5 sm:min-h-[2.75rem] sm:gap-2 sm:px-5 sm:text-[11px] sm:tracking-[0.2em]"
      >
        <span className="w-full text-balance text-center">{t("scrollToPricingAria")}</span>
        <ChevronDown
          className="mx-auto h-4 w-4 shrink-0 text-[#0066ff] opacity-95 transition-transform duration-200 group-hover:translate-y-0.5"
          strokeWidth={2}
          aria-hidden
        />
      </a>
    </>
  );

  const sectionClassOrbit = `marketing-hero-section home-content-atmosphere relative flex min-h-[min(100dvh,100svh)] w-full flex-col overflow-x-hidden bg-transparent text-white ${sectionBasePad} ${demoVariant ? "scroll-mt-28 " : ""}${orbitUiClass}`.trim();

  const sectionClassGrid = `marketing-hero-section home-content-atmosphere grid min-h-[100dvh] min-h-[100svh] w-full grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] overflow-x-hidden bg-transparent text-white ${sectionBasePad} ${demoVariant ? "scroll-mt-28 " : ""}${orbitUiClass}`.trim();

  return (
    <section
      id={sectionId}
      data-hero-variant={dataHeroVariantForCss}
      data-orbit-rings={isOrbitVisual ? orbitRingsMode : undefined}
      className={isOrbitVisual ? sectionClassOrbit : sectionClassGrid}
      aria-labelledby={titleId}
    >
      {isOrbitVisual ? (
        <>
          <span className="marketing-hero-orbit-ring-outer" aria-hidden />
          <span className="marketing-hero-orbit-ring-inner" aria-hidden />
        </>
      ) : null}
      {demoSpeedometer ? <MarketingHeroSpeedometer tone={demoVariant?.startsWith("s") ? "mono" : "default"} /> : null}

      {isOrbitVisual ? (
        <>
          {orbitHeroHeader}
          <div className="relative z-[2] mx-auto mt-auto flex min-h-0 w-full max-w-[min(100%,53.76rem)] flex-1 flex-col justify-end pt-3 sm:pt-5">
            {pillarsAndCta}
          </div>
        </>
      ) : (
        <>
          <div className="min-h-0" aria-hidden />
          {headerWrappedDefault}
          <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,53.76rem)] flex-col justify-end">{pillarsAndCta}</div>
        </>
      )}
    </section>
  );
}
