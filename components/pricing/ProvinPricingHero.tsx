"use client";

import { useCallback, useState, type SyntheticEvent } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { Tp5DesktopFeatureIconRow } from "@/components/test-pricing-5/Tp5DesktopFeatureIconRow";
import { Tp5MobilePricingCard } from "@/components/test-pricing-5/Tp5MobilePricingCard";
import { getTp5HeroCopy } from "@/lib/test-pricing-5-hero-copy";
import {
  getTp5HeroSwipeOrder,
  TP5_MOBILE_CHECKOUT_PLAN,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";
import { getTp5UiCopy } from "@/lib/test-pricing-5-ui-copy";
import {
  validateTp5InlineFields,
  type Tp5InlineFieldErrors,
} from "@/lib/test-pricing-5-inline-checkout";
import { normalizeVin } from "@/lib/order-field-validation";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";
import { useTierSwipe } from "@/lib/use-test-pricing-tier-swipe";
import { parseHeroPlanParam } from "@/lib/home-hero-plan";

type Props = {
  checkoutSource: string;
  sectionId?: string;
  mobileTitleId?: string;
  desktopTitleId?: string;
};

export function ProvinPricingHero({
  checkoutSource,
  sectionId = "provin-pricing-hero",
  mobileTitleId = "provin-pricing-hero-title",
  desktopTitleId = "provin-pricing-hero-title-desktop",
}: Props) {
  const locale = useLocale();
  const heroCopy = getTp5HeroCopy(locale);
  const uiCopy = getTp5UiCopy(locale);
  const searchParams = useSearchParams();
  const initialPlan =
    parseHeroPlanParam(searchParams.get("plan") ?? searchParams.get("tab")) ?? "audits";
  const [mobileActiveId, setMobileActiveId] = useState<Tp5MobileServiceId>(initialPlan);
  const [desktopActiveId, setDesktopActiveId] = useState<Tp5MobileServiceId>(initialPlan);
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [errors, setErrors] = useState<Tp5InlineFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mobileSwipeOrder = getTp5HeroSwipeOrder(mobileActiveId);
  const desktopSwipeOrder = getTp5HeroSwipeOrder(desktopActiveId);

  const {
    onSwipeAreaTouchStart: onMobileSwipeStart,
    onSwipeAreaTouchMove: onMobileSwipeMove,
    onSwipeAreaTouchEnd: onMobileSwipeEnd,
    onSwipeAreaTouchCancel: onMobileSwipeCancel,
  } = useTierSwipe(mobileActiveId, setMobileActiveId, mobileSwipeOrder);

  const {
    onSwipeAreaTouchStart: onDesktopSwipeStart,
    onSwipeAreaTouchMove: onDesktopSwipeMove,
    onSwipeAreaTouchEnd: onDesktopSwipeEnd,
    onSwipeAreaTouchCancel: onDesktopSwipeCancel,
  } = useTierSwipe(desktopActiveId, setDesktopActiveId, desktopSwipeOrder);

  const cancelled = searchParams.get("atcelts") === "1";

  const submitCheckout = useCallback(
    async (planId: TestPricingPlanId) => {
      setGlobalError(null);
      const validation = validateTp5InlineFields(listingUrl, vin, locale);
      if (!validation.ok) {
        setErrors(validation.errors);
        const first = validation.errors.listingUrl ?? validation.errors.vin;
        if (first) setGlobalError(first);
        return;
      }
      setErrors({});
      setLoading(true);
      try {
        const res = await fetch("/api/checkout/test-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            locale,
            listingUrl: listingUrl.trim(),
            vin: normalizeVin(vin),
            withdrawalConsent: true,
            sourcePage: checkoutSource,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
          errors?: string[];
        };
        if (!res.ok || !data.url) {
          throw new Error(data.errors?.[0] ?? data.error ?? uiCopy.checkoutErrorFallback);
        }
        window.location.href = data.url;
      } catch (e) {
        setGlobalError(e instanceof Error ? e.message : uiCopy.checkoutErrorFallback);
      } finally {
        setLoading(false);
      }
    },
    [checkoutSource, listingUrl, locale, uiCopy.checkoutErrorFallback, vin],
  );

  const submitMobileCheckout = useCallback(() => {
    void submitCheckout(TP5_MOBILE_CHECKOUT_PLAN[mobileActiveId]);
  }, [mobileActiveId, submitCheckout]);

  const submitDesktopCheckout = useCallback(() => {
    void submitCheckout(TP5_MOBILE_CHECKOUT_PLAN[desktopActiveId]);
  }, [desktopActiveId, submitCheckout]);

  const stopSwipePropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div className={styles.heroPricingShell}>
      <section id={sectionId} className={styles.heroSurface} aria-labelledby={mobileTitleId}>
        <div className={styles.heroAmbientGlow} aria-hidden />
        <div className={styles.heroBackdrop} aria-hidden>
          <HeroVisual />
        </div>
        <div className={styles.heroScrim} aria-hidden />

      <div className={styles.heroInnerMobile}>
        {cancelled ? <p className={styles.cancelNote}>{uiCopy.cancelNote}</p> : null}

        {/* Mobile: no visible H1 — desktop hero keeps the full title. */}
        <h1 id={mobileTitleId} className="sr-only">
          {heroCopy.titlePrefix}
          {heroCopy.titleAccent}
        </h1>

        <div className={styles.stage}>
          <Tp5MobilePricingCard
            activeServiceId={mobileActiveId}
            setActiveServiceId={setMobileActiveId}
            vin={vin}
            listingUrl={listingUrl}
            errors={errors}
            globalError={globalError}
            loading={loading}
            onVinChange={setVin}
            onListingUrlChange={setListingUrl}
            onSubmit={submitMobileCheckout}
            onSwipeAreaTouchStart={onMobileSwipeStart}
            onSwipeAreaTouchMove={onMobileSwipeMove}
            onSwipeAreaTouchEnd={onMobileSwipeEnd}
            onSwipeAreaTouchCancel={onMobileSwipeCancel}
            stopSwipePropagation={stopSwipePropagation}
          />
        </div>
      </div>

      <div className={styles.heroInnerDesktop}>
        {cancelled ? (
          <p className={`${styles.cancelNote} ${styles.cancelNoteDesktop}`}>{uiCopy.cancelNote}</p>
        ) : null}

        <header className={styles.heroCopyDesktop}>
          <h1 id={desktopTitleId} className={styles.heroTitleDesktop}>
            {heroCopy.titlePrefix}
            <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
              {heroCopy.titleAccent}
            </span>
          </h1>
          <Tp5DesktopFeatureIconRow activeServiceId={desktopActiveId} />
        </header>

        <div className={`${styles.stage} ${styles.heroStageDesktop}`}>
          <Tp5MobilePricingCard
            activeServiceId={desktopActiveId}
            setActiveServiceId={setDesktopActiveId}
            vin={vin}
            listingUrl={listingUrl}
            errors={errors}
            globalError={globalError}
            loading={loading}
            onVinChange={setVin}
            onListingUrlChange={setListingUrl}
            onSubmit={submitDesktopCheckout}
            onSwipeAreaTouchStart={onDesktopSwipeStart}
            onSwipeAreaTouchMove={onDesktopSwipeMove}
            onSwipeAreaTouchEnd={onDesktopSwipeEnd}
            onSwipeAreaTouchCancel={onDesktopSwipeCancel}
            stopSwipePropagation={stopSwipePropagation}
            tabLayoutGroupId="tp5-tabs-desktop"
            tabPillLayoutId="tp5-tab-pill-desktop"
          />
        </div>
      </div>
      </section>
    </div>
  );
}
