"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
import { ORDER_SECTION_ID } from "@/lib/order-section";
import {
  approvedByIrissSignatureHeroClass,
  heroH1BlueKeywordClass,
  homeHeroOrderColumnMaxClass,
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
  /** Intro teksts pārvietots zem pīlāriem (atsevišķa sekcija mājas lapā). */
  const homeOrbitMetaIntro = false;
  const hideHeroSubtitle = Boolean(designDirection && !demoVariant);
  const [heroOrderStep, setHeroOrderStep] = useState<1 | 2>(1);
  const prevHeroOrderStepRef = useRef(heroOrderStep);
  const mobileHeroScrollRef = useRef<HTMLDivElement>(null);
  const mobileHomeClusterRef = useRef<HTMLDivElement>(null);
  const mobileCenterResizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialMobileClusterRevealDoneRef = useRef(false);
  /** Mājas mobilais klasteris: līdz pirmajam centrējumam pēc fontiem — paslēpts, lai nav „nokrišanas” no Y=0 + vēlā fontu slāņa. */
  const mobileClusterRevealGateActive = Boolean(orbitHomeCenterLayout && designDirection && !demoVariant);
  const [mobileClusterRevealReady, setMobileClusterRevealReady] = useState(() => !mobileClusterRevealGateActive);
  const [mobileAuditsTranslateY, setMobileAuditsTranslateY] = useState(0);

  /**
   * Mobilais mājas hero: `translate3d(0,Y,0)` uz klasteri — `.marketing-hero-title-line2` (AUDITS) centrs → `visualViewport` centrs.
   * Nav `rootRect` „redzamības” filtra; RO + window resize (debounce) + visualViewport (garāks debounce); nobīdei mirkļa slieksnis un Y ierobežojums pret „hunting”.
   */
  const recenterMobileAuditsLine = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) {
      setMobileAuditsTranslateY(0);
      return;
    }

    const heroEl = document.getElementById(sectionId);
    if (heroEl) {
      const r = heroEl.getBoundingClientRect();
      const margin = 160;
      const vh = window.innerHeight;
      if (r.bottom < -margin || r.top > vh + margin) {
        return;
      }
    }

    const root = mobileHomeClusterRef.current;
    if (!root) return;

    const audits = root.querySelector(".marketing-hero-title-line2");
    if (!audits || !(audits instanceof HTMLElement)) return;
    const rect = audits.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const auditsCenterY = rect.top + rect.height / 2;
    const vv = window.visualViewport;
    const viewportCenterY = vv ? vv.offsetTop + vv.height / 2 : window.innerHeight / 2;
    const delta = Math.round(viewportCenterY - auditsCenterY);
    /* Mazāks „hunting” starp kadriem (subpikseļi / adreses josla) — nemaina vizuālo centru būtiski. */
    if (Math.abs(delta) < 4) return;

    const vh = window.innerHeight;
    const yCap = Math.max(120, Math.round(vh * 0.52));
    setMobileAuditsTranslateY((prev) => {
      const next = Math.round(prev + delta);
      if (Math.abs(next - prev) < 1) return prev;
      return Math.min(yCap, Math.max(-yCap, next));
    });
  }, [sectionId]);

  useLayoutEffect(() => {
    if (!orbitHomeCenterLayout || !designDirection || demoVariant) {
      setMobileAuditsTranslateY(0);
      setMobileClusterRevealReady(true);
      return;
    }
    if (prevHeroOrderStepRef.current !== heroOrderStep) {
      setMobileAuditsTranslateY(0);
      prevHeroOrderStepRef.current = heroOrderStep;
    }

    const run = () => {
      recenterMobileAuditsLine();
    };

    const debounceWindowMs = 520;
    const debounceVvMs = 780;
    let vvDebounceTimer: number | null = null;

    const scheduleResize = () => {
      if (mobileCenterResizeDebounceRef.current) clearTimeout(mobileCenterResizeDebounceRef.current);
      mobileCenterResizeDebounceRef.current = setTimeout(() => {
        mobileCenterResizeDebounceRef.current = null;
        requestAnimationFrame(() => run());
      }, debounceWindowMs);
    };

    const scheduleVvResize = () => {
      if (vvDebounceTimer) window.clearTimeout(vvDebounceTimer);
      vvDebounceTimer = window.setTimeout(() => {
        vvDebounceTimer = null;
        requestAnimationFrame(() => run());
      }, debounceVvMs);
    };

    const firstReveal = !initialMobileClusterRevealDoneRef.current;
    let cancelled = false;
    let safetyTimer: number | null = null;

    const commitReveal = () => {
      if (cancelled || initialMobileClusterRevealDoneRef.current) return;
      initialMobileClusterRevealDoneRef.current = true;
      setMobileClusterRevealReady(true);
    };

    const runRevealFrame = () => {
      run();
      requestAnimationFrame(() => {
        if (cancelled) return;
        run();
        commitReveal();
      });
    };

    if (firstReveal) {
      setMobileClusterRevealReady(false);
      safetyTimer = window.setTimeout(() => {
        if (cancelled) return;
        runRevealFrame();
      }, 1400);

      void document.fonts.ready.then(() => {
        if (cancelled) return;
        if (safetyTimer) {
          clearTimeout(safetyTimer);
          safetyTimer = null;
        }
        requestAnimationFrame(() => {
          if (cancelled) return;
          if (initialMobileClusterRevealDoneRef.current) {
            run();
            requestAnimationFrame(() => run());
            return;
          }
          runRevealFrame();
        });
      });
    } else {
      requestAnimationFrame(() => run());
    }

    window.addEventListener("resize", scheduleResize);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", scheduleVvResize);

    const cluster = mobileHomeClusterRef.current;
    let ro: ResizeObserver | undefined;
    if (cluster && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => scheduleResize());
      ro.observe(cluster);
    }

    return () => {
      cancelled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      if (vvDebounceTimer) window.clearTimeout(vvDebounceTimer);
      if (mobileCenterResizeDebounceRef.current) clearTimeout(mobileCenterResizeDebounceRef.current);
      window.removeEventListener("resize", scheduleResize);
      if (vv) vv.removeEventListener("resize", scheduleVvResize);
      ro?.disconnect();
    };
  }, [orbitHomeCenterLayout, designDirection, demoVariant, recenterMobileAuditsLine, heroOrderStep]);

  /** bfcache: atiestāt nobīdi un pārmērīt; hero prom ritinot translateY netiek notīrīts — nav lēciena atpakaļ augšā. */
  useEffect(() => {
    if (!orbitHomeCenterLayout || !designDirection || demoVariant) return;

    const resetInnerScroll = () => {
      const el = mobileHeroScrollRef.current;
      if (el) el.scrollTop = 0;
    };

    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) {
        setMobileAuditsTranslateY(0);
        resetInnerScroll();
        recenterMobileAuditsLine();
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [orbitHomeCenterLayout, designDirection, demoVariant, recenterMobileAuditsLine]);

  /** Sākumlapas orbit: viens H1 tonis (bez zilajiem atslēgvārdiem), izmērs ×3 — sk. orbit-presets `[data-hero-orbit-home]`. */
  const heroH1KeywordResolved =
    orbitHomeCenterLayout && isOrbitVisual
      ? "marketing-hero-h1-blue font-bold whitespace-nowrap text-provin-accent"
      : `marketing-hero-h1-blue ${heroH1BlueKeywordClass}`;

  /** Starp H1 rindām: skenēšana tikai demo (`demoVariant`); produkcijā — statiska līnija. */
  const showTitleMidScan = Boolean(designDirection && isOrbitVisual && demoVariant);

  const heroTitleStack = (
    <div className={`flex w-full flex-col items-center text-center${orbitHomeCenterLayout ? " marketing-hero-fade-in-up marketing-hero-fade-in-up--1" : ""}`}>
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
            <span className="marketing-hero-title-line1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0 sm:gap-x-2.5">
              <span className="flex items-center gap-x-2 sm:gap-x-3">
                <span className={`marketing-hero-title-line1-main ${heroH1KeywordResolved}`}>{t("h1Vin")}</span>
                <span className={`marketing-hero-title-line1-main marketing-hero-title-line1-un ${heroH1KeywordResolved}`}>
                  {t("h1Un")}
                </span>
              </span>
              <span className={`marketing-hero-title-line1-accent ${heroH1KeywordResolved}`}>{t("h1Sludinajuma")}</span>
            </span>
            <div
              className={`marketing-hero-title-mid-rule box-border flex h-5 w-full shrink-0 items-center justify-center px-1 sm:px-2${showTitleMidScan ? "" : " marketing-hero-title-mid-rule--simple"}`}
              aria-hidden
            >
              {showTitleMidScan ? (
                <div className="marketing-hero-title-mid-scan pointer-events-none w-full max-w-[min(100%,min(90vw,56rem))]">
                  <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
                </div>
              ) : (
                <div className="marketing-hero-title-mid-rule__line h-px w-full max-w-[min(100%,min(90vw,56rem))] bg-white/25" />
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

  const scrollToContentLink = designDirection ? (
    scrollToContentLinkDesign("mt-3 sm:mt-4")
  ) : (
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

  const heroOrderEntry =
    designDirection && !demoVariant ? (
      <div
        id={ORDER_SECTION_ID}
        className={`${homeHeroOrderColumnMaxClass} scroll-mt-[calc(2.75rem+1px)] px-2 sm:px-1 max-md:mt-3 mt-2 sm:mt-3`}
      >
        <OrderForm
          variant="hero"
          formId="home-hero-order-form"
          hideStepOneCta
          onStepChange={setHeroOrderStep}
          className="!mt-0 !space-y-0 !px-0 !py-0"
        />
      </div>
    ) : null;

  const heroStepOneCta =
    designDirection && !demoVariant && heroOrderStep === 1 ? (
      <div className="flex w-full justify-center px-1 pt-1 sm:pt-2 max-md:mt-2 max-md:pt-1">
        <button
          type="submit"
          form="home-hero-order-form"
          className="provin-home-pill-cta provin-home-pill-cta--fit z-10 flex w-fit min-h-[50px] max-w-[min(100%,calc(100vw-2rem))] touch-manipulation items-center justify-center whitespace-nowrap text-center shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
        >
          PASŪTĪT AUDITU - 79,99 €
        </button>
      </div>
    ) : null;

  const heroPillars = (
    <MarketingHeroPillarsGrid
      designDirection={designDirection}
      isC={isC}
      isB={isB}
      /** Mājas mobilais: 2×2 režģis (ne vertikāls saraksts), centrēts ar `homeMarketingPillarGridShellClass`. */
      homeMobileListLayout={false}
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
   * Web (md+): pīlārus vizuāli paceļ ar transform, lai vertikālais attālums līdz formai ≈ līdz pogai;
   * layout plūsma nemainās — poga un lauki paliek tajās pašās pikseļu pozīcijās.
   */
  const pillarsAndCta = (
    <>
      {designDirection && !demoVariant ? (
        <div className="max-md:contents md:block md:w-full md:-translate-y-[0.6875rem] md:transform-gpu">
          {heroPillars}
        </div>
      ) : (
        heroPillars
      )}
      {heroStepOneCta}
      {scrollLinkDesktopOnly}
    </>
  );

  /** Mājas lapa: vienota virsma ar `home-intro` ir `page.tsx` wrapperī — šeit bez atsevišķa band-a. */
  const designDirHeroChrome =
    designDirection && isOrbitVisual && Boolean(demoVariant)
      ? " demo-design-dir__section demo-design-dir__section--band-a"
      : "";

  const sectionClassOrbit = `marketing-hero-section home-content-atmosphere relative flex min-h-[min(100dvh,100svh)] w-full flex-col overflow-x-hidden bg-transparent text-white ${sectionBasePad} ${demoVariant ? "scroll-mt-28 " : ""}${orbitSectionStyleClass}${designDirHeroChrome}`.trim();

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
          <div className="relative z-[1] flex min-h-0 w-full flex-1 flex-col">
            {designDirection && !demoVariant ? (
              <>
                {/* Mobilais: virsraksts → forma → Pasūtīt (četri pīlāri tikai desktop); desktop — kā iepriekšējais režģis */}
                <div
                  ref={mobileHeroScrollRef}
                  className="mx-auto flex w-full min-w-0 max-w-full shrink-0 flex-col items-center md:hidden"
                >
                  <div
                    ref={mobileHomeClusterRef}
                    className={`pointer-events-auto mx-auto flex w-full min-w-0 max-w-[min(100%,min(92vw,46rem))] shrink-0 flex-col px-4 pb-[max(0.875rem,env(safe-area-inset-bottom,0px))] transform-gpu${
                      mobileClusterRevealGateActive && !mobileClusterRevealReady ? " pointer-events-none opacity-0" : ""
                    }`}
                    style={{ transform: `translate3d(0, ${mobileAuditsTranslateY}px, 0)` }}
                    aria-busy={mobileClusterRevealGateActive && !mobileClusterRevealReady ? true : undefined}
                  >
                    <div className="z-[1] flex shrink-0 justify-center pb-1 pt-2.5">
                      {approvedBlock}
                    </div>
                    <div className="flex flex-col gap-3 py-0">
                      <div className="marketing-hero-orbit-center-sheet flex w-full shrink-0 flex-col items-center justify-center [contain:layout]">
                        {heroTitleStack}
                      </div>
                      {heroOrderEntry}
                      <div className="flex w-full flex-col items-center gap-1 pb-0.5 pt-0.5">
                        {heroStepOneCta}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden min-h-0 w-full flex-1 grid-rows-[1fr_auto] md:grid">
                  <div className="relative flex min-h-0 w-full flex-1 flex-col">
                    <div className="pointer-events-auto z-[1] flex shrink-0 justify-center px-4 pb-1 pt-2.5 sm:px-8 sm:pb-0 sm:pt-1">
                      {approvedBlock}
                    </div>
                    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-8">
                      <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,min(92vw,46rem))] flex-1 flex-col gap-2 py-1 sm:justify-evenly sm:gap-0 sm:py-2">
                        <div className="marketing-hero-orbit-center-sheet flex w-full shrink-0 flex-col items-center justify-center">
                          {heroTitleStack}
                        </div>
                        {heroOrderEntry}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`relative z-[2] mx-auto flex w-full shrink-0 flex-col items-center pt-1 sm:pt-5 ${homeHeroOrderColumnMaxClass} marketing-hero-fade-in-up marketing-hero-fade-in-up--3`}
                  >
                    {pillarsAndCta}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid min-h-0 w-full flex-1 grid-rows-[1fr_auto]">
                <div className="relative flex min-h-0 w-full flex-1 flex-col">
                  <div className="pointer-events-auto z-[1] flex shrink-0 justify-center px-4 pb-1 pt-2.5 sm:px-8 sm:pb-0 sm:pt-1">
                    {approvedBlock}
                  </div>
                  <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-8">
                    <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,min(92vw,46rem))] flex-1 flex-col gap-2 py-1 sm:justify-evenly sm:gap-0 sm:py-2">
                      <div className="marketing-hero-orbit-center-sheet flex w-full shrink-0 flex-col items-center justify-center">
                        {heroTitleStack}
                      </div>
                      {heroOrderEntry}
                    </div>
                  </div>
                </div>
                <div
                  className={`relative z-[2] mx-auto flex w-full shrink-0 flex-col items-center pt-1 sm:pt-5${
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
