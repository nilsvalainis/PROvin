"use client";

import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { AzvinPricingCard, type AzvinFieldErrors } from "@/components/demo/azvin/AzvinPricingCard";
import { HeroVisual } from "@/components/HeroVisual";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { getAzvinHeroCopy, type AzvinLocale } from "@/lib/azvin-hero-copy";
import {
  AZVIN_DEFAULT_SERVICE_ID,
  AZVIN_SERVICE_ORDER,
  type AzvinServiceId,
} from "@/lib/azvin-mobile-services";
import { getAzvinUiCopy } from "@/lib/azvin-ui-copy";
import { readAzvinLocale, subscribeAzvinLocale } from "@/lib/azvin-locale";
import { isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import { useTierSwipe } from "@/lib/use-test-pricing-tier-swipe";
import { Globe2, Gavel, Store } from "lucide-react";

const ICON_BTN_BASE =
  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-zinc-300 opacity-75 shadow-[0_0_12px_rgba(37,99,235,0.08)] transition-all duration-300 will-change-[transform,box-shadow,border-color,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]";

const ICON_BTN_HOVER =
  "hover:scale-105 hover:border-[#2563EB] hover:text-[#2563EB] hover:opacity-100 hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]";

function AzvinDesktopFeatureIcons({ locale }: { locale: AzvinLocale }) {
  const uiCopy = getAzvinUiCopy(locale);
  const services = [
    { id: "europe" as const, icon: Globe2, label: locale === "en" ? "Europe PRO" : locale === "ru" ? "Европа PRO" : locale === "lv" ? "Eiropa PRO" : "Avropa PRO" },
    { id: "koreaUsa" as const, icon: Gavel, label: locale === "en" ? "Korea & USA" : locale === "ru" ? "Корея и США" : locale === "lv" ? "Koreja un ASV" : "Koreya və ABŞ" },
    { id: "dealer" as const, icon: Store, label: locale === "en" ? "Dealer data" : locale === "ru" ? "Данные дилера" : locale === "lv" ? "Dīlera dati" : "Diler məlumatı" },
  ];

  return (
    <div className={styles.tp5DesktopFeatureRow}>
      <DiagnosticScanLine variant="rail" motion="sweepLtr" className="w-full" />
      <ul
        className="mt-8 flex w-full list-none items-center justify-center gap-6"
        aria-label={uiCopy.featureIconRowAria}
      >
        {services.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.id} className="flex shrink-0">
              <button
                type="button"
                className={`group relative ${ICON_BTN_BASE} ${ICON_BTN_HOVER}`}
                aria-label={feature.label}
              >
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-20 w-max max-w-[14rem] -translate-x-1/2 translate-y-1 text-center text-xs font-medium tracking-wide text-gray-300 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                >
                  {feature.label}
                </span>
                <Icon className="h-6 w-6 [stroke-width:1.6]" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
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

  const copy = getAzvinHeroCopy(locale);

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
        nextErrors.vin = copy.vinInvalid;
      }
      if (listingUrl.trim() && !/^https?:\/\//i.test(listingUrl.trim())) {
        nextErrors.listingUrl = copy.listingInvalid;
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
        setDemoNote(copy.ctaDemoNote);
        void activeId;
      }, 400);
    },
    [copy.ctaDemoNote, copy.listingInvalid, copy.vinInvalid, listingUrl, vin],
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
          <header className={styles.heroCopy}>
            <h1 id="azvin-hero-title" className={styles.heroTitle}>
              {copy.titlePrefix}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>{copy.titleAccent}</span>
            </h1>
          </header>

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
              {copy.titleDesktopLine1}
              <br />
              {copy.titleDesktopLine2Prefix}
              <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
                {copy.titleDesktopAccent}
              </span>
            </h1>
            <AzvinDesktopFeatureIcons locale={locale} />
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
