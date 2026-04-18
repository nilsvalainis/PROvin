"use client";

import { useId, useState, type ReactNode } from "react";
import { Playfair_Display } from "next/font/google";
import "@/components/home/hero-orbit-styles";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { NavChevronDown } from "@/components/NavChevron";
import { OrderForm } from "@/components/OrderForm";
import { ApprovedByIrissReveal } from "@/components/home/ApprovedByIrissReveal";
import { MarketingHeroPillarsGrid } from "@/components/home/MarketingHeroPillarsGrid";
import { MarketingHeroSpeedometer } from "@/components/home/MarketingHeroSpeedometer";
import type { HeroVisualDemoVariant } from "@/lib/hero-orbit-j-presets";
import { isOrbitFamilyVariant } from "@/lib/hero-orbit-j-presets";
import {
  HOME_HERO_ORDER_FORM_ID,
  HOME_HERO_ORDER_FORM_ID_MD,
  HOME_HERO_ORDER_FORM_ID_SM,
  ORDER_SECTION_ID,
} from "@/lib/order-section";
import {
  approvedByIrissSignatureHeroClass,
  heroH1BlueKeywordClass,
  homeHeroOrderColumnMaxClass,
  homeHeroOrderFormTwoCardsWidthClass,
  homeHeroSubtitleClass,
  homeMarketingPillarGridShellClass,
} from "@/lib/home-layout";
export type { HeroOrbitSubvariant, HeroSilverBlackSubvariant, HeroVisualDemoVariant } from "@/lib/hero-orbit-j-presets";
export {
  HERO_DEMO_SPEEDOMETER_VARIANTS,
  HERO_ORBIT_SUBVARIANTS,
  HERO_SILVER_BLACK_SUBVARIANTS,
  isOrbitFamilyVariant,
} from "@/lib/hero-orbit-j-presets";

/** Produkcijas hero orbitālais izskats — neietekmē `id` (paliek `home-hero` sānu joslai). */
export type MarketingHeroHomeOrbitPreset = "s12" | "s19" | "s20";

export type MarketingHeroProps = {
  /** Iekšējie hero vizuālie varianti (noklusējumā nav — tikai ja nepieciešams). */
  demoVariant?: HeroVisualDemoVariant;
  /** Produkcija: S12 / S19 / S20 (melns+sudrabs); nedrīkst lietot kopā ar `demoVariant`. */
  homeOrbitPreset?: MarketingHeroHomeOrbitPreset;
  /** Sākumlapa: tipogrāfija / CTA saskaņā ar `demo-design-dir` virzienu. */
  designDirection?: boolean;
  /** Sekcijas `id` (pēc vajadzības). */
  sectionDomId?: string;
  /** Dekoratīvs spidometrs zem virsraksta. */
  demoSpeedometer?: boolean;
  /** Orbitālo gredzenu pseudo-elementu animācija: `static` = apstādināts. */
  demoOrbitRings?: "spin" | "static";
};

const sectionBasePad =
  "px-4 pb-5 pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+1.25rem))] sm:px-8 sm:pb-9 sm:pt-[max(1.75rem,calc(env(safe-area-inset-top,0px)+1.35rem))]";

/** Neliels hero kickeris starp „AUDITS” un formu — `absolute`, lai neietekmētu flex izkārtojumu. */
const heroOrbitItalyKickerFont = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  style: ["italic"],
  weight: ["500", "600"],
  display: "swap",
});

/**
 * Pilnekrāna tumšais Hero: „APPROVED…” + H1 ekrāna centrā; četras ikonas apakšā; scroll uz saturu (design: tikai zila bultiņa).
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
  const t = useTranslations("Hero");
  const tOrder = useTranslations("Order");

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
  const disableHomeBackgroundVisuals = Boolean(designDirection && !demoVariant);
  const orbitUiClass =
    isOrbitDemo
      ? `marketing-hero-orbit-base marketing-hero-orbit--${demoVariant}`
      : homeOrbitKey
        ? `marketing-hero-orbit-base marketing-hero-orbit--${homeOrbitKey}`
        : "";
  const orbitSectionStyleClass = orbitUiClass;
  const isOrbitVisual = Boolean(orbitUiClass);
  const dataHeroVariantForCss = demoVariant ?? homeOrbitKey;
  const orbitRingsMode = isOrbitVisual ? (demoVariant ? demoOrbitRings : "spin") : "spin";
  const orbitGlassSilhouette = Boolean(isOrbitVisual && !demoVariant && !designDirection);
  /** Sākumlapa: vertikālais centrs starp augšu un pīlāriem + tipogrāfijas skala (`data-hero-orbit-home`). */
  const orbitHomeCenterLayout = Boolean(designDirection && isOrbitVisual && !isB);
  /** Mājas lapa mobilajā: hero aizpilda pirmo skatu (`min-h`), saturs centrēts vertikāli — mazāk tukšuma tikai zem CTA. */
  const homeHeroMobileViewportLock = Boolean(orbitHomeCenterLayout && !demoVariant);
  /** Intro teksts pārvietots zem pīlāriem (atsevišķa sekcija mājas lapā). */
  const homeOrbitMetaIntro = false;
  const hideHeroSubtitle = Boolean(designDirection && !demoVariant);
  const [heroOrderStep, setHeroOrderStep] = useState<1 | 2>(1);

  /** Sākumlapas orbit: viens H1 tonis (bez zilajiem atslēgvārdiem), izmērs ×3 — sk. orbit-presets `[data-hero-orbit-home]`. */
  const heroH1KeywordResolved =
    orbitHomeCenterLayout && isOrbitVisual
      ? "marketing-hero-h1-blue font-bold whitespace-nowrap text-provin-accent"
      : `marketing-hero-h1-blue ${heroH1BlueKeywordClass}`;

  /** Starp H1 rindām: skenēšana tikai demo (`demoVariant`); produkcijā — statiska līnija. */
  const showTitleMidScan = Boolean(designDirection && isOrbitVisual && demoVariant);
  const homeTitleMotionOff = Boolean(orbitHomeCenterLayout && !demoVariant);

  const heroTitleStack = (
    <div
      className={`flex w-full flex-col items-center text-center${
        homeTitleMotionOff ? "" : orbitHomeCenterLayout ? " marketing-hero-fade-in-up marketing-hero-fade-in-up--1" : ""
      }`}
    >
      <h1
        id={titleId}
        className={
          isOrbitVisual
            ? `marketing-hero-title marketing-hero-title--orbit w-full text-balance font-semibold leading-none tracking-[-0.02em] text-white/95 max-[380px]:tracking-[-0.025em]${designDirection ? " max-w-[min(100%,min(90vw,56rem))]" : ""}`
            : `marketing-hero-title w-full max-w-[min(100%,52rem)] text-balance font-semibold leading-none tracking-[-0.02em] text-[clamp(1.3125rem,5.5vw+0.35rem,1.75rem)] text-white/95 max-[380px]:tracking-[-0.025em] sm:text-[40px] lg:text-[48px]`
        }
      >
        <>
          <div className="marketing-hero-title-split flex w-full flex-col items-center gap-0">
            <div className="marketing-hero-title-line1 flex w-full flex-col items-center justify-center gap-0">
              <span className="marketing-hero-title-line1-vin-un flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3">
                <span className={`marketing-hero-title-line1-main ${heroH1KeywordResolved}`}>{t("h1Vin")}</span>
                <span className={`marketing-hero-title-line1-main marketing-hero-title-line1-un ${heroH1KeywordResolved}`}>
                  {t("h1Un")}
                </span>
              </span>
              <span className={`marketing-hero-title-line1-accent block w-full text-center ${heroH1KeywordResolved}`}>
                {t("h1Sludinajuma")}
              </span>
            </div>
            <div
              className={`marketing-hero-title-mid-rule box-border flex h-5 w-full shrink-0 items-center justify-center px-1 sm:px-2${showTitleMidScan ? "" : " marketing-hero-title-mid-rule--simple"}`}
              aria-hidden
            >
              {showTitleMidScan ? (
                <div className="marketing-hero-title-mid-scan pointer-events-none w-full max-w-[min(100%,min(90vw,56rem))]">
                  <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
                </div>
              ) : (
                <div className="marketing-hero-title-mid-rule__line h-px w-full max-w-[min(100%,min(90vw,56rem))] bg-transparent" />
              )}
            </div>
            <span className="marketing-hero-title-line2 marketing-hero-title-line2--accent block leading-none">
              {t("h1Line2")}
            </span>
          </div>
        </>
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

  const heroOrbitItalyKickerNode =
    orbitHomeCenterLayout && !demoVariant ? (
      <p
        className={`marketing-hero-italy-kicker ${heroOrbitItalyKickerFont.className} pointer-events-none absolute left-1/2 top-full z-[6] w-full max-w-[min(100%,30rem)] -translate-x-1/2 translate-y-4 sm:translate-y-5 text-center text-[clamp(0.8rem,2.45vw,1.05rem)] leading-snug tracking-[0.028em] text-white/[0.8] [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]`}
      >
        {t("italyKicker")}
      </p>
    ) : null;

  const approvedBlock = (
    <ApprovedByIrissReveal
      text={t("approved")}
      className={
        designDirection
          ? "demo-design-dir__kicker marketing-hero-approved--home text-center !tracking-[0.24em] sm:!tracking-[0.28em]"
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

  const scrollToContentLinkDesign = (marginClass: string) => (
    <a
      href={demoVariant ? "#" : "#site-content"}
      onClick={demoVariant ? (e) => e.preventDefault() : undefined}
      aria-label={t("scrollToPricingAria")}
      className={`group ${marginClass} inline-flex shrink-0 touch-manipulation items-center justify-center self-center text-provin-accent/80 transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent`}
    >
      <NavChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5" />
    </a>
  );

  const showHeroScrollChevron = !(designDirection && !demoVariant);
  const scrollToContentLink = !showHeroScrollChevron
    ? null
    : designDirection
      ? scrollToContentLinkDesign("mt-3 sm:mt-4")
      : (
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
        );

  const heroOrderEntryShellClass = `${homeHeroOrderColumnMaxClass} scroll-mt-[calc(2.75rem+1px)] px-2 sm:px-1 max-md:mt-3 mt-2 sm:mt-3`;

  function renderHeroOrderEntry(formId: string, pasutitSectionId: boolean) {
    if (!designDirection || demoVariant) return null;
    return (
      <div id={pasutitSectionId ? ORDER_SECTION_ID : undefined} className={heroOrderEntryShellClass}>
        <div className={homeHeroOrderFormTwoCardsWidthClass}>
          <OrderForm
            variant="hero"
            formId={formId}
            hideStepOneCta
            onStepChange={setHeroOrderStep}
            className="!mt-0 !space-y-0 !px-0 !py-0"
          />
        </div>
      </div>
    );
  }

  /** Viens `OrderForm` (orbit bez mobilā/desktop zara dublikāta). */
  const heroOrderEntry = renderHeroOrderEntry(HOME_HERO_ORDER_FORM_ID, true);
  /** Orbit `md:hidden` zars — savs `formId`, lai desktop poga netrāpītu šeit. */
  const heroOrderEntrySm = renderHeroOrderEntry(HOME_HERO_ORDER_FORM_ID_SM, true);
  /** Orbit `md:grid` zars — `#pasutit` paliek SM wrapperī (pirmais DOM). */
  const heroOrderEntryMd = renderHeroOrderEntry(HOME_HERO_ORDER_FORM_ID_MD, false);

  /**
   * Ārpus `<form>`: `type="submit"` + `form=` dažos pārlūkos / ar `md:hidden` formu zaru mēdz nestrādāt.
   * `requestSubmit()` uz konkrēto `id` vienmēr izsauc tās pašas formas `onSubmit` (kā „īstā” iesniegšana).
   */
  function heroStepOneCtaForFormId(formDomId: string) {
    if (!designDirection || demoVariant || heroOrderStep !== 1) return null;
    return (
      <div
        className={`pointer-events-auto relative z-[80] flex w-full justify-center px-1 pt-1 max-md:mt-2 max-md:pt-1 sm:pt-2 md:mt-0 md:pt-2.5 ${homeHeroOrderFormTwoCardsWidthClass}`}
      >
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById(formDomId);
            if (el instanceof HTMLFormElement) el.requestSubmit();
          }}
          className="provin-home-pill-cta provin-home-pill-cta--fit relative z-[1] flex w-fit min-h-[50px] max-w-[min(100%,calc(100%-2rem))] touch-manipulation items-center justify-center whitespace-nowrap text-center shadow-[0_5px_17px_rgba(0,0,0,0.13)] active:scale-95"
        >
          {tOrder("heroOrderCta")}
        </button>
      </div>
    );
  }

  const heroStepOneCta = heroStepOneCtaForFormId(HOME_HERO_ORDER_FORM_ID);
  const heroStepOneCtaSm = heroStepOneCtaForFormId(HOME_HERO_ORDER_FORM_ID_SM);
  const heroStepOneCtaMd = heroStepOneCtaForFormId(HOME_HERO_ORDER_FORM_ID_MD);

  const heroPillars = (
    <MarketingHeroPillarsGrid
      designDirection={designDirection}
      isC={isC}
      isB={isB}
      /** Mājas mobilais: viena kolonna (saraksts), nevis 2×2 — `marketing-hero-pillars-mobile-list`. */
      homeMobileListLayout={designDirection}
      shellClassName={
        designDirection && !demoVariant
          ? `${homeMarketingPillarGridShellClass} w-full pb-2 pt-1.5 max-md:pb-0 max-md:pt-2 sm:pb-5 sm:pt-4`
          : undefined
      }
    />
  );

  const scrollLinkDesktopOnly =
    designDirection && !demoVariant ? <div className="hidden md:flex">{scrollToContentLink}</div> : scrollToContentLink;

  /**
   * Web (md+): hero 4 kartītes pagaidām paslēptas; mobilajā (max-md) tās paliek.
   * `fadePillars`: animāciju tikai uz pīlāriem — ārpus tās paliek CTA, lai poga nebūtu „puscaurspīdīga”.
   */
  function pillarsAndCtaWithStepOneCta(stepOneCtaSlot: ReactNode, options?: { fadePillars?: boolean }) {
    const fadePillars = options?.fadePillars ?? false;
    const pillarsEl =
      designDirection && !demoVariant ? (
        <div className="max-md:contents md:hidden">
          {heroPillars}
        </div>
      ) : (
        heroPillars
      );
    const pillarsBlock = fadePillars ? (
      <div className="flex w-full flex-col items-center marketing-hero-fade-in-up marketing-hero-fade-in-up--3">
        {pillarsEl}
      </div>
    ) : (
      pillarsEl
    );
    return (
      <>
        {pillarsBlock}
        {stepOneCtaSlot}
        {scrollLinkDesktopOnly}
      </>
    );
  }

  const pillarsAndCta = pillarsAndCtaWithStepOneCta(heroStepOneCta);
  /** Desktop: CTA zem formas tajā pašā slejā; apakšējā rindā tikai pīlāri + scroll (bez duplikāta pogas). */
  const pillarsAndCtaMdHeroSubmit = pillarsAndCtaWithStepOneCta(null, { fadePillars: true });

  /** Mājas lapa: vienota virsma ar `home-intro` ir `page.tsx` wrapperī — šeit bez atsevišķa band-a. */
  const designDirHeroChrome =
    designDirection && isOrbitVisual && Boolean(demoVariant)
      ? " demo-design-dir__section demo-design-dir__section--band-a"
      : "";

  const sectionClassOrbit = `marketing-hero-section home-content-atmosphere relative flex min-h-[100svh] w-full max-w-full flex-col overflow-x-hidden bg-transparent text-white md:min-h-[min(100dvh,100svh)] ${sectionBasePad} ${demoVariant ? "scroll-mt-28 " : ""}${orbitSectionStyleClass}${designDirHeroChrome}`.trim();

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
      {isOrbitVisual && !disableHomeBackgroundVisuals ? (
        orbitGlassSilhouette && !homeOrbitMetaIntro ? (
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
                  r="23"
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
                r="23.5"
                stroke="rgb(255 255 255 / 0.2)"
                strokeWidth="0.58"
                vectorEffect="non-scaling-stroke"
              />
              <g transform="translate(44 44)">
                <g className="marketing-hero-orbit-silhouette__dot-orbit">
                  <circle
                    className="marketing-hero-orbit-silhouette__dot"
                    cx="24.75"
                    cy="0"
                    r="1.42"
                    fill="rgb(0 102 255)"
                  />
                </g>
              </g>
              <path
                d="M 29 37 Q 44 31 59 37"
                stroke="rgb(255 255 255 / 0.26)"
                strokeWidth="0.52"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M 64 64 L 83 83"
                stroke={`url(#${silhouetteGradId})`}
                strokeWidth="0.55"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
        ) : !orbitGlassSilhouette ? (
          <>
            <span className="marketing-hero-orbit-ring-outer" aria-hidden />
            <span className="marketing-hero-orbit-ring-inner" aria-hidden />
          </>
        ) : null
      ) : null}
      {demoSpeedometer ? <MarketingHeroSpeedometer tone={demoVariant?.startsWith("s") ? "mono" : "default"} /> : null}

      {isOrbitVisual ? (
        orbitHomeCenterLayout ? (
          <div
            className={`relative z-[1] flex min-h-0 w-full flex-1 flex-col${homeHeroMobileViewportLock ? " max-md:justify-center" : ""}`}
          >
            {designDirection && !demoVariant ? (
              <>
                {/* Mobilais: md:hidden — tikai CSS, bez JS viewport zara */}
                <div className="mx-auto flex w-full min-w-0 max-w-full shrink-0 flex-col items-center md:hidden">
                  <div
                    className={`marketing-hero-mobile-layout-lock pointer-events-auto flex w-full min-w-0 shrink-0 flex-col px-4 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] max-md:flex max-md:flex-col max-md:justify-start ${homeHeroOrderColumnMaxClass}`}
                  >
                    <div className="marketing-hero-mobile-header-slot flex w-full shrink-0 items-start justify-center">
                      <div className="marketing-hero-mobile-header-lock z-[1] flex w-full shrink-0 flex-col items-center">
                        <div className="flex w-full shrink-0 justify-center pb-1 pt-2.5">{approvedBlock}</div>
                        <div className="marketing-hero-orbit-center-sheet marketing-hero-mobile-title-scale relative flex w-full shrink-0 flex-col items-center justify-center overflow-visible [contain:layout]">
                          {heroTitleStack}
                          {heroOrbitItalyKickerNode}
                        </div>
                      </div>
                    </div>
                    <div className="marketing-hero-mobile-form-anchor flex w-full flex-col gap-3 py-0">
                      {heroOrderEntrySm}
                      <div className="flex w-full flex-col items-center gap-1 pb-0.5 pt-0.5">
                        {heroStepOneCtaSm}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Desktop: hidden md:grid — tā pati loģika, otrs H1 tikai šajā zarā (redzams tikai md+) */}
                <div className="hidden min-h-0 w-full flex-1 grid grid-rows-[1fr_auto] md:grid">
                  <div className="relative flex min-h-0 w-full flex-1 flex-col">
                    <div className="pointer-events-auto z-[1] flex shrink-0 justify-center px-4 pb-1 pt-4 sm:px-8 sm:pb-0 sm:pt-4">
                      {approvedBlock}
                    </div>
                    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-x-clip overflow-y-visible px-4 sm:px-8">
                      <div
                        className={`flex min-h-0 w-full flex-1 flex-col gap-2 py-1 sm:justify-evenly sm:gap-0 sm:py-2 ${homeHeroOrderColumnMaxClass}`}
                      >
                        <div className="marketing-hero-orbit-center-sheet relative flex w-full shrink-0 flex-col items-center justify-center overflow-visible">
                          {heroTitleStack}
                          {heroOrbitItalyKickerNode}
                        </div>
                        <div className="flex w-full min-w-0 flex-col items-center">
                          {heroOrderEntryMd}
                          {heroStepOneCtaMd}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`relative z-[2] mx-auto flex w-full shrink-0 flex-col items-center pt-1 sm:pt-1 md:pt-0 ${homeHeroOrderColumnMaxClass}`}
                  >
                    {pillarsAndCtaMdHeroSubmit}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid min-h-0 w-full flex-1 grid-rows-[1fr_auto]">
                <div className="relative flex min-h-0 w-full flex-1 flex-col">
                  <div className="pointer-events-auto z-[1] flex shrink-0 justify-center px-4 pb-1 pt-4 sm:px-8 sm:pb-0 sm:pt-4">
                    {approvedBlock}
                  </div>
                  <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-x-clip overflow-y-visible px-4 sm:px-8">
                    <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,46rem)] flex-1 flex-col gap-2 py-1 sm:justify-evenly sm:gap-0 sm:py-2">
                      <div className="marketing-hero-orbit-center-sheet flex w-full shrink-0 flex-col items-center justify-center">
                        {heroTitleStack}
                      </div>
                      {heroOrderEntry}
                    </div>
                  </div>
                </div>
                <div
                  className={`relative z-[2] mx-auto flex w-full shrink-0 flex-col items-center pt-1 sm:pt-1${
                    orbitHomeCenterLayout
                      ? ` ${homeHeroOrderColumnMaxClass} marketing-hero-fade-in-up marketing-hero-fade-in-up--3`
                      : " max-w-[min(100%,53.76rem)]"
                  }`}
                >
                  {pillarsAndCta}
                </div>
              </div>
            )}
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
