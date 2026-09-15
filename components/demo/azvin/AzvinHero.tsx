"use client";

import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  ClipboardCheck,
  FileText,
  Gavel,
  Gauge,
  Globe2,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { AzvinPricingCard, type AzvinFieldErrors } from "@/components/demo/azvin/AzvinPricingCard";
import { HeroVisual } from "@/components/HeroVisual";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { DealerHeroBrandChips } from "@/components/test-pricing-5/DealerHeroBrandChips";
import { getAzvinHeroCopy, type AzvinLocale } from "@/lib/azvin-hero-copy";
import {
  getAzvinDesktopHeroFeatures,
  type AzvinDesktopHeroFeatureIcon,
} from "@/lib/azvin-desktop-hero-features";
import {
  AZVIN_DEFAULT_SERVICE_ID,
  AZVIN_SERVICE_ORDER,
  type AzvinServiceId,
} from "@/lib/azvin-mobile-services";
import { getAzvinUiCopy } from "@/lib/azvin-ui-copy";
import { readAzvinLocale, subscribeAzvinLocale } from "@/lib/azvin-locale";
import { isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import { useTierSwipe } from "@/lib/use-test-pricing-tier-swipe";

const ICON_BTN_BASE =
  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-zinc-300 opacity-75 shadow-[0_0_12px_rgba(37,99,235,0.08)] transition-all duration-300 will-change-[transform,box-shadow,border-color,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

const ICON_BTN_HOVER =
  "hover:scale-105 hover:border-[#2563EB] hover:text-[#2563EB] hover:opacity-100 hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]";

const LUCIDE_ICON_CLASS = "h-6 w-6 [stroke-width:1.6]";
const BRAND_LOGO_CLASS =
  "h-6 w-6 shrink-0 object-contain opacity-60 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0";
const SWAP_TRANSITION = { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };

function brandIdleClass(icon: AzvinDesktopHeroFeatureIcon): string | undefined {
  if (icon === "carvertical") return styles.brandIconIdleCarVertical;
  if (icon === "autodna") return styles.brandIconIdleAutoDna;
  return undefined;
}

function FeatureIconGlyph({ icon }: { icon: AzvinDesktopHeroFeatureIcon }) {
  switch (icon) {
    case "consultation":
      return <Users className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "auction":
      return <Gavel className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "mileage":
      return <Gauge className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "salvage":
      return <ShieldAlert className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "title":
      return <FileText className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "eu-registry":
      return <ShieldCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "dealer-data":
      return <Store className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "international":
      return <Globe2 className={LUCIDE_ICON_CLASS} aria-hidden />;
    case "carvertical":
      return (
        <Image
          src="/brand/carvertical-logo.png"
          alt=""
          width={24}
          height={24}
          className={`${BRAND_LOGO_CLASS} ${styles.brandLogoIdleCarVertical}`}
          aria-hidden
        />
      );
    case "autodna":
      return (
        <Image
          src="/brand/autodna-logo.png"
          alt=""
          width={24}
          height={24}
          className={`${BRAND_LOGO_CLASS} ${styles.brandLogoIdleAutoDna}`}
          aria-hidden
        />
      );
    default:
      return <ClipboardCheck className={LUCIDE_ICON_CLASS} aria-hidden />;
  }
}

function AzvinDesktopFeatureIcons({
  locale,
  activeServiceId,
}: {
  locale: AzvinLocale;
  activeServiceId: AzvinServiceId;
}) {
  const uiCopy = getAzvinUiCopy(locale);
  const features = getAzvinDesktopHeroFeatures(locale, activeServiceId);
  const showDealerBrands = activeServiceId === "dealer";

  return (
    <div className={styles.tp5DesktopFeatureRow}>
      <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
      <div className="relative mt-8 min-h-[9.75rem] w-full xl:min-h-[10.75rem]">
        <AnimatePresence mode="wait" initial={false}>
          {showDealerBrands ? (
            <motion.div
              key="dealer-brands"
              className={styles.dealerHeroBrandChipsMotion}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SWAP_TRANSITION}
            >
              <DealerHeroBrandChips ariaLabel={uiCopy.dealerBrandsAria} />
            </motion.div>
          ) : (
            <motion.ul
              key={`features-${activeServiceId}`}
              className="absolute inset-x-0 top-0 flex w-full list-none items-center justify-between gap-1"
              aria-label={uiCopy.featureIconRowAria}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SWAP_TRANSITION}
            >
              {features.map((feature) => {
                const idlePulse = brandIdleClass(feature.icon);
                return (
                <li key={feature.icon} className="flex shrink-0">
                  <button
                    type="button"
                    className={`group relative ${ICON_BTN_BASE} ${ICON_BTN_HOVER}${idlePulse ? ` ${idlePulse}` : ""}`}
                    aria-label={feature.label}
                  >
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-20 w-max max-w-[14rem] -translate-x-1/2 translate-y-1 text-center text-xs font-medium tracking-wide text-gray-300 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                    >
                      {feature.label}
                    </span>
                    <FeatureIconGlyph icon={feature.icon} />
                  </button>
                </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AzvinHero() {
  const [locale, setLocale] = useState<AzvinLocale>("az");
  const [mobileActiveId, setMobileActiveId] = useState<AzvinServiceId>(AZVIN_DEFAULT_SERVICE_ID);
  const [desktopActiveId, setDesktopActiveId] = useState<AzvinServiceId>(AZVIN_DEFAULT_SERVICE_ID);
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [errors, setErrors] = useState<AzvinFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocale(readAzvinLocale());
    return subscribeAzvinLocale((next) => {
      setLocale(next);
      setGlobalError(null);
      setDemoNote(null);
      setErrors({});
    });
  }, []);

  const mobileCopy = getAzvinHeroCopy(locale, mobileActiveId);
  const desktopCopy = getAzvinHeroCopy(locale, desktopActiveId);

  const {
    onSwipeAreaTouchStart: onMobileSwipeStart,
    onSwipeAreaTouchMove: onMobileSwipeMove,
    onSwipeAreaTouchEnd: onMobileSwipeEnd,
    onSwipeAreaTouchCancel: onMobileSwipeCancel,
  } = useTierSwipe(mobileActiveId, setMobileActiveId, AZVIN_SERVICE_ORDER);

  const {
    onSwipeAreaTouchStart: onDesktopSwipeStart,
    onSwipeAreaTouchMove: onDesktopSwipeMove,
    onSwipeAreaTouchEnd: onDesktopSwipeEnd,
    onSwipeAreaTouchCancel: onDesktopSwipeCancel,
  } = useTierSwipe(desktopActiveId, setDesktopActiveId, AZVIN_SERVICE_ORDER);

  const submitFor = useCallback(
    (activeId: AzvinServiceId) => {
      setGlobalError(null);
      setDemoNote(null);

      const nextErrors: AzvinFieldErrors = {};
      const normalized = normalizeVin(vin);
      if (!isValidVinOrPlate(normalized)) {
        nextErrors.vin = mobileCopy.vinInvalid;
      }
      if (listingUrl.trim() && !/^https?:\/\//i.test(listingUrl.trim())) {
        nextErrors.listingUrl = mobileCopy.listingInvalid;
      }
      if (nextErrors.vin || nextErrors.listingUrl) {
        setErrors(nextErrors);
        setGlobalError(nextErrors.vin ?? nextErrors.listingUrl ?? null);
        return;
      }
      setErrors({});
      setLoading(true);
      window.setTimeout(() => {
        setLoading(false);
        setDemoNote(mobileCopy.ctaDemoNote);
        void activeId;
      }, 400);
    },
    [listingUrl, mobileCopy.ctaDemoNote, mobileCopy.listingInvalid, mobileCopy.vinInvalid, vin],
  );

  const stopSwipePropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const cardShared = {
    locale,
    vin,
    listingUrl,
    errors,
    globalError,
    demoNote,
    loading,
    onVinChange: setVin,
    onListingUrlChange: setListingUrl,
    stopSwipePropagation,
  };

  return (
    <div className={styles.heroPricingShell}>
      <section id="azvin-hero" className={styles.heroSurface} aria-labelledby="azvin-hero-title">
        <div className={styles.heroAmbientGlow} aria-hidden />
        <div className={styles.heroBackdrop} aria-hidden>
          <HeroVisual />
        </div>
        <div className={styles.heroScrim} aria-hidden />

        <div className={styles.heroInnerMobile}>
          <h1 id="azvin-hero-title" className="sr-only">
            {mobileCopy.titlePrefix}
            {mobileCopy.titleAccent}
          </h1>

          <div className={styles.stage}>
            <AzvinPricingCard
              {...cardShared}
              activeServiceId={mobileActiveId}
              setActiveServiceId={setMobileActiveId}
              onSubmit={() => submitFor(mobileActiveId)}
              onSwipeAreaTouchStart={onMobileSwipeStart}
              onSwipeAreaTouchMove={onMobileSwipeMove}
              onSwipeAreaTouchEnd={onMobileSwipeEnd}
              onSwipeAreaTouchCancel={onMobileSwipeCancel}
            />
          </div>
        </div>

        <div className={styles.heroInnerDesktop}>
          <header className={styles.heroCopyDesktop}>
            <h1 id="azvin-hero-title-desktop" className={styles.heroTitleDesktop}>
              {desktopCopy.titlePrefix}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
                {desktopCopy.titleAccent}
              </span>
            </h1>
            <AzvinDesktopFeatureIcons locale={locale} activeServiceId={desktopActiveId} />
          </header>

          <div className={`${styles.stage} ${styles.heroStageDesktop}`}>
            <AzvinPricingCard
              {...cardShared}
              activeServiceId={desktopActiveId}
              setActiveServiceId={setDesktopActiveId}
              onSubmit={() => submitFor(desktopActiveId)}
              onSwipeAreaTouchStart={onDesktopSwipeStart}
              onSwipeAreaTouchMove={onDesktopSwipeMove}
              onSwipeAreaTouchEnd={onDesktopSwipeEnd}
              onSwipeAreaTouchCancel={onDesktopSwipeCancel}
              tabLayoutGroupId="azvin-tabs-desktop"
              tabPillLayoutId="azvin-tab-pill-desktop"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
