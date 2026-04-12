"use client";

import { useId } from "react";
import "@/components/home/hero-orbit-styles";
import { ChevronDown, FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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
export type MarketingHeroHomeOrbitPreset = "s12" | "s19" | "s20";

export type MarketingHeroProps = {
  /** Salīdzināšanas demo — `/demo/hero-variants`; noklusējumā nav. */
  demoVariant?: HeroVisualDemoVariant;
  /** Produkcija: S12 / S19 / S20 (melns+sudrabs); nedrīkst lietot kopā ar `demoVariant`. */
  homeOrbitPreset?: MarketingHeroHomeOrbitPreset;
  /** Sākumlapa: tipogrāfija / CTA saskaņā ar `demo-design-dir` virzienu. */
  designDirection?: boolean;
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
  designDirection = false,
}: MarketingHeroProps = {}) {
  const silhouetteIdBase = useId().replace(/:/g, "");
  const silhouetteGradId = `${silhouetteIdBase}-edge`;
  const silhouetteLensCenterGradId = `${silhouetteIdBase}-lens-center`;
  const silhouetteLensClipId = `${silhouetteIdBase}-lens-clip`;
  const silhouetteScanGradId = `${silhouetteIdBase}-scan-grad`;
  const silhouetteScanPathD =
    "M 70 44 A 26 26 0 1 1 18 44 A 26 26 0 1 1 70 44 M 64 64 L 102 102";
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
    !demoVariant && (homeOrbitPreset === "s12" || homeOrbitPreset === "s19" || homeOrbitPreset === "s20")
      ? homeOrbitPreset
      : undefined;
  const orbitUiClass =
    isOrbitDemo
      ? `marketing-hero-orbit-base marketing-hero-orbit--${demoVariant}`
      : homeOrbitKey
        ? `marketing-hero-orbit-base marketing-hero-orbit--${homeOrbitKey}`
        : "";
  const isOrbitVisual = Boolean(orbitUiClass);
  const dataHeroVariantForCss = demoVariant ?? homeOrbitKey;
  const orbitRingsMode = isOrbitVisual ? (demoVariant ? demoOrbitRings : "spin") : "spin";
  const orbitGlassSilhouette = Boolean(isOrbitVisual && !demoVariant);
  /** Sākumlapa: vertikālais centrs starp augšu un pīlāriem + tipogrāfijas skala (`data-hero-orbit-home`). */
  const orbitHomeCenterLayout = Boolean(designDirection && isOrbitVisual && !isB);
  /** Sākumlapa ar palielināmo stiklu: apakšvirsrakstu nerāda; virsraksts lēcas tekstā (`lensLine1` + `lensLine2`). */
  const homeGlassLensCopy = Boolean(designDirection && orbitGlassSilhouette && !demoVariant);
  const hideHeroSubtitle = Boolean(designDirection && !demoVariant);

  const heroTitleStack = (
    <div className="flex w-full flex-col items-center text-center">
      <h1
        id={titleId}
        className={
          homeGlassLensCopy && isOrbitVisual
            ? "sr-only"
            : isOrbitVisual
              ? `marketing-hero-title marketing-hero-title--orbit w-full text-balance font-semibold tracking-[-0.02em] text-white/95 max-[380px]:tracking-[-0.025em]${designDirection ? " max-w-[min(100%,40rem)]" : ""}`
              : `marketing-hero-title w-full max-w-[min(100%,52rem)] text-balance font-semibold leading-[1.08] tracking-[-0.02em] text-[clamp(1.3125rem,5.5vw+0.35rem,1.75rem)] text-white/95 max-[380px]:tracking-[-0.025em] sm:text-[40px] sm:leading-[1.05] lg:text-[48px]`
        }
      >
        {homeGlassLensCopy ? (
          <>
            {t("lensLine1")} {t("lensLine2")}
          </>
        ) : (
          <>
            <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5 sm:gap-y-2">
              <span className={`marketing-hero-h1-blue ${heroH1BlueKeywordClass}`}>{t("h1Vin")}</span>
              <span className="text-white/95">{t("h1Un")}</span>
              <span className={`marketing-hero-h1-blue ${heroH1BlueKeywordClass}`}>{t("h1Sludinajuma")}</span>
            </span>
            <span className="marketing-hero-title-line2 mt-0.5 block text-white/95 sm:mt-1">{t("h1Line2")}</span>
          </>
        )}
      </h1>
      {!hideHeroSubtitle ? (
        <p
          className={
            designDirection
              ? `demo-design-dir__body mx-auto mt-3 max-w-[min(100%,36rem)] text-balance text-center${orbitHomeCenterLayout ? " marketing-hero__tagline" : ""}`
              : `${homeHeroSubtitleClass} mx-auto mt-2.5 max-w-[min(100%,36rem)] text-balance text-[11px] font-medium uppercase leading-snug tracking-[0.14em] text-white/48 sm:mt-3 sm:text-[12px] sm:tracking-[0.16em]`
          }
        >
          {t("h2")}
        </p>
      ) : null}
    </div>
  );

  const approvedBlock = (
    <ApprovedByIrissReveal
      text={t("approved")}
      className={
        designDirection
          ? "demo-design-dir__kicker text-center !tracking-[0.24em] sm:!tracking-[0.28em]"
          : approvedByIrissSignatureHeroClass
      }
    />
  );

  /** Orbit: 1fr / auto / 1fr pār `min-h-[100dvh]` — vidējā rinda atstāta kā `min-h-0` enkurs, bez horizontālās skenēšanas. */
  const orbitHeroHeaderSpacer = <div className="min-h-0 shrink-0" aria-hidden />;

  const orbitHeroHeader = isB ? (
    <header className="pointer-events-none absolute inset-0 z-[1] flex min-h-[min(100dvh,100svh)] w-full items-center justify-center px-4 sm:px-8">
      <div className="marketing-hero-b-glass marketing-hero-orbit-b-glass-shell pointer-events-auto grid h-[min(100dvh,100svh)] w-full max-w-[min(100%,48rem)] min-h-0 grid-rows-[1fr_auto_1fr] px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex min-h-0 flex-col items-center justify-end pb-2 text-center">{approvedBlock}</div>
        <div className="flex w-full flex-col items-center text-center">{orbitHeroHeaderSpacer}</div>
        <div className="flex min-h-0 flex-col items-center justify-start pt-1.5 text-center">{heroTitleStack}</div>
      </div>
    </header>
  ) : (
    <header className="pointer-events-none absolute inset-0 z-[1] grid min-h-[min(100dvh,100svh)] w-full grid-rows-[1fr_auto_1fr]">
      <div className="pointer-events-auto flex min-h-0 w-full flex-col items-center justify-end px-4 pb-2 text-center sm:px-8">
        {approvedBlock}
      </div>
      <div className="pointer-events-auto mx-auto w-full max-w-[min(100%,53.76rem)] px-4 text-center sm:px-8">{orbitHeroHeaderSpacer}</div>
      <div className="pointer-events-auto flex min-h-0 w-full flex-col items-center justify-start px-4 pt-1.5 text-center sm:px-8">
        {heroTitleStack}
      </div>
    </header>
  );

  const headerWrappedDefault = isB ? (
    <header className="mx-auto flex w-full max-w-[min(100%,53.76rem)] min-h-0 flex-col items-center justify-center gap-4 self-center text-center sm:gap-5 md:gap-6">
      <div className="marketing-hero-b-glass w-full max-w-[min(100%,48rem)] px-5 py-6 sm:px-8 sm:py-7">
        {approvedBlock}
        {heroTitleStack}
      </div>
    </header>
  ) : (
    <header className="mx-auto flex w-full max-w-[min(100%,53.76rem)] min-h-0 flex-col items-center justify-center gap-4 self-center text-center sm:gap-5 md:gap-6">
      {approvedBlock}
      {heroTitleStack}
    </header>
  );

  const pillarGridClass = `${homeMarketingPillarGridShellClass} w-full pb-5 pt-4 sm:pb-6 sm:pt-6${isB ? " marketing-hero-b-pillars" : ""}`;

  const pillarsAndCta = (
    <>
      <div className={pillarGridClass}>
        <div
          className={
            designDirection
              ? `mx-auto min-w-0 ${homeMarketingPillarGridWidthClass}`
              : "marketing-hero-pillar-dock w-full rounded-2xl border border-white/[0.08] bg-[rgb(3_4_6/0.55)] px-2 py-3 shadow-[0_20px_52px_rgb(0_0_0/0.42)] backdrop-blur-md sm:px-3 sm:py-4 md:px-4"
          }
        >
          <div
            className={
              designDirection
                ? "flex w-full flex-row flex-nowrap justify-center gap-2 sm:gap-4 md:gap-5"
                : `flex w-full flex-row flex-nowrap justify-between gap-2 sm:gap-4 md:gap-5 ${homeMarketingPillarGridWidthClass}`
            }
          >
          {pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i] ?? FileText;
            const articleClass = isC
              ? "marketing-hero-pillar flex min-h-0 min-w-0 flex-1 basis-0 flex-row items-start gap-2.5 px-1 text-left sm:gap-3 sm:px-1"
              : designDirection
                ? "marketing-hero-pillar demo-design-dir__card flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center gap-2.5 px-2 py-3 text-center sm:gap-3 sm:px-3 sm:py-4"
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
        className={
          designDirection
            ? "provin-home-pill-cta provin-home-pill-cta--stack group mt-3 shrink-0 touch-manipulation self-center sm:mt-4"
            : "group mx-auto mt-2 flex min-h-[44px] w-full max-w-[22rem] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-center text-[9px] font-semibold uppercase leading-snug tracking-[0.16em] text-white/55 shadow-[0_16px_40px_rgb(0_0_0/0.35)] transition-[border-color,background-color,color,box-shadow] duration-200 hover:border-[#0066ff]/28 hover:bg-[#0066ff]/[0.09] hover:text-white/85 active:bg-white/[0.07] sm:mt-2.5 sm:min-h-[2.75rem] sm:gap-2 sm:px-5 sm:text-[11px] sm:tracking-[0.2em]"
        }
      >
        <span className={`text-balance text-center${designDirection ? "" : " w-full"}`}>{t("scrollToPricingAria")}</span>
        <ChevronDown
          className={`mx-auto h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5 ${designDirection ? "text-[#7eb6ff]/90" : "text-[#0066ff] opacity-95"}`}
          strokeWidth={2}
          aria-hidden
        />
      </a>
    </>
  );

  const designDirHeroChrome =
    designDirection && isOrbitVisual ? " demo-design-dir__section demo-design-dir__section--band-a" : "";

  const sectionClassOrbit = `marketing-hero-section home-content-atmosphere relative flex min-h-[min(100dvh,100svh)] w-full flex-col overflow-x-hidden bg-transparent text-white ${sectionBasePad} ${demoVariant ? "scroll-mt-28 " : ""}${orbitUiClass}${designDirHeroChrome}`.trim();

  const sectionClassGrid = `marketing-hero-section home-content-atmosphere grid min-h-[100dvh] min-h-[100svh] w-full grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] overflow-x-hidden bg-transparent text-white ${sectionBasePad} ${demoVariant ? "scroll-mt-28 " : ""}${orbitUiClass}${designDirHeroChrome}`.trim();

  return (
    <section
      id={sectionId}
      data-hero-variant={dataHeroVariantForCss}
      data-orbit-rings={isOrbitVisual ? orbitRingsMode : undefined}
      data-hero-orbit-home={orbitHomeCenterLayout ? "" : undefined}
      className={isOrbitVisual ? sectionClassOrbit : sectionClassGrid}
      aria-labelledby={titleId}
    >
      {isOrbitVisual ? (
        orbitGlassSilhouette ? (
          <span className="marketing-hero-orbit-silhouette">
            <svg className="marketing-hero-orbit-silhouette__svg" viewBox="0 0 112 112" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden>
              <defs>
                <clipPath id={silhouetteLensClipId}>
                  <circle cx="44" cy="44" r="25.4" />
                </clipPath>
                <radialGradient
                  id={silhouetteLensCenterGradId}
                  cx="44"
                  cy="44"
                  r="20"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="rgb(0 102 255)" stopOpacity="0.11" />
                  <stop offset="40%" stopColor="rgb(0 102 255)" stopOpacity="0.042" />
                  <stop offset="100%" stopColor="rgb(0 102 255)" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={silhouetteGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgb(230 235 245)" stopOpacity="0.253" />
                  <stop offset="52%" stopColor="rgb(150 160 180)" stopOpacity="0.114" />
                  <stop offset="100%" stopColor="rgb(210 218 232)" stopOpacity="0.202" />
                </linearGradient>
                <linearGradient id={silhouetteScanGradId} x1="0" y1="0" x2="112" y2="112" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgb(0 102 255)" stopOpacity="0" />
                  <stop offset="30%" stopColor="rgb(0 102 255)" stopOpacity="0.22" />
                  <stop offset="50%" stopColor="rgb(0 102 255)" stopOpacity="0.98" />
                  <stop offset="70%" stopColor="rgb(0 102 255)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="rgb(0 102 255)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle
                cx="44"
                cy="44"
                r="26"
                fill={`url(#${silhouetteLensCenterGradId})`}
                clipPath={`url(#${silhouetteLensClipId})`}
              />
              <circle
                cx="44"
                cy="44"
                r="26"
                stroke={`url(#${silhouetteGradId})`}
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx="44"
                cy="44"
                r="20.5"
                stroke="rgb(255 255 255 / 0.2)"
                strokeWidth="0.58"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 29 37 Q 44 31 59 37"
                stroke="rgb(255 255 255 / 0.26)"
                strokeWidth="0.52"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 64 64 L 102 102"
                stroke={`url(#${silhouetteGradId})`}
                strokeWidth="0.55"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                className="marketing-hero-orbit-silhouette__scan-path marketing-hero-orbit-silhouette__scan-path--glow"
                d={silhouetteScanPathD}
                pathLength="100"
              />
              <path
                className="marketing-hero-orbit-silhouette__scan-path"
                d={silhouetteScanPathD}
                pathLength="100"
                stroke={`url(#${silhouetteScanGradId})`}
              />
            </svg>
            {homeGlassLensCopy ? (
              <span className="marketing-hero-orbit-silhouette__lens-stack">
                <span className="marketing-hero-orbit-silhouette__lens-line1">{t("lensLine1")}</span>
                <span className="marketing-hero-orbit-silhouette__lens-line2">{t("lensLine2")}</span>
              </span>
            ) : null}
          </span>
        ) : (
          <>
            <span className="marketing-hero-orbit-ring-outer" aria-hidden />
            <span className="marketing-hero-orbit-ring-inner" aria-hidden />
          </>
        )
      ) : null}
      {demoSpeedometer ? <MarketingHeroSpeedometer tone={demoVariant?.startsWith("s") ? "mono" : "default"} /> : null}

      {isOrbitVisual ? (
        orbitHomeCenterLayout ? (
          <div className="relative z-[1] flex min-h-0 w-full flex-1 flex-col">
            <div className="grid min-h-0 w-full flex-1 grid-rows-[1fr_auto]">
              <div className="relative min-h-0">
                <div className="pointer-events-auto absolute inset-x-0 top-0 z-[1] flex justify-center px-4 sm:px-8">
                  {approvedBlock}
                </div>
                <div className="pointer-events-auto absolute inset-x-0 top-1/2 z-[1] flex -translate-y-1/2 flex-col items-center justify-center px-4 sm:px-8">
                  {heroTitleStack}
                </div>
              </div>
              <div className="relative z-[2] mx-auto flex w-full max-w-[min(100%,53.76rem)] shrink-0 flex-col items-center pt-3 sm:pt-5">
                {pillarsAndCta}
              </div>
            </div>
          </div>
        ) : (
          <>
            {orbitHeroHeader}
            <div className="relative z-[2] mx-auto mt-auto flex min-h-0 w-full max-w-[min(100%,53.76rem)] flex-1 flex-col items-center justify-end pt-3 sm:pt-5">
              {pillarsAndCta}
            </div>
          </>
        )
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
