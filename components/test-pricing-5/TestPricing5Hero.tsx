"use client";

import { useCallback, useState, type SyntheticEvent } from "react";
import { useSearchParams } from "next/navigation";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { Tp5DesktopFeatureIconRow } from "@/components/test-pricing-5/Tp5DesktopFeatureIconRow";
import { Tp5MobilePricingCard } from "@/components/test-pricing-5/Tp5MobilePricingCard";
import {
  TP5_HERO_SUBHEAD,
  TP5_HERO_TITLE_ACCENT,
  TP5_HERO_TITLE_PREFIX,
} from "@/lib/test-pricing-5-hero-copy";
import {
  TP5_MOBILE_CHECKOUT_PLAN,
  TP5_MOBILE_SERVICE_ORDER,
  type Tp5MobileServiceId,
} from "@/lib/test-pricing-5-mobile";
import {
  TP5_INLINE_CHECKOUT_SOURCE,
  validateTp5InlineFields,
  type Tp5InlineFieldErrors,
} from "@/lib/test-pricing-5-inline-checkout";
import { normalizeVin } from "@/lib/order-field-validation";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";
import { useTierSwipe } from "@/lib/use-test-pricing-tier-swipe";

export function TestPricing5Hero() {
  const searchParams = useSearchParams();
  const [mobileActiveId, setMobileActiveId] = useState<Tp5MobileServiceId>("audits");
  const [desktopActiveId, setDesktopActiveId] = useState<Tp5MobileServiceId>("audits");
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [errors, setErrors] = useState<Tp5InlineFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { onSwipeAreaTouchStart: onMobileSwipeStart, onSwipeAreaTouchEnd: onMobileSwipeEnd } =
    useTierSwipe(mobileActiveId, setMobileActiveId, TP5_MOBILE_SERVICE_ORDER);

  const cancelled = searchParams.get("atcelts") === "1";

  const submitCheckout = useCallback(async (planId: TestPricingPlanId) => {
    setGlobalError(null);
    const validation = validateTp5InlineFields(listingUrl, vin);
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
          locale: "lv",
          listingUrl: listingUrl.trim(),
          vin: normalizeVin(vin),
          withdrawalConsent: true,
          sourcePage: TP5_INLINE_CHECKOUT_SOURCE,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        errors?: string[];
      };
      if (!res.ok || !data.url) {
        throw new Error(data.errors?.[0] ?? data.error ?? "Neizdevās sākt maksājumu.");
      }
      window.location.href = data.url;
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Neizdevās sākt maksājumu.");
    } finally {
      setLoading(false);
    }
  }, [listingUrl, vin]);

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
    <section className={styles.heroSurface} aria-labelledby="tp5-hero-title">
      <div className={styles.heroBackdrop} aria-hidden>
        <HeroVisual />
      </div>
      <div className={styles.heroScrim} aria-hidden />

      {/* Mobile / tablet — frozen single-card switcher (below lg) */}
      <div className={styles.heroInnerMobile}>
        {cancelled ? (
          <p className={styles.cancelNote}>Maksājums tika atcelts. Vari mēģināt vēlreiz.</p>
        ) : null}

        <header className={styles.heroCopy}>
          <h1 id="tp5-hero-title" className={styles.heroTitle}>
            {TP5_HERO_TITLE_PREFIX}
            <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
              {TP5_HERO_TITLE_ACCENT}
            </span>
          </h1>
          <p className={styles.heroSubhead}>{TP5_HERO_SUBHEAD}</p>
        </header>

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
            onSwipeAreaTouchEnd={onMobileSwipeEnd}
            stopSwipePropagation={stopSwipePropagation}
          />
        </div>
      </div>

      {/* Desktop — 2-column asymmetric hero (lg and above) */}
      <div className={styles.heroInnerDesktop}>
        {cancelled ? (
          <p className={`${styles.cancelNote} ${styles.cancelNoteDesktop}`}>
            Maksājums tika atcelts. Vari mēģināt vēlreiz.
          </p>
        ) : null}

        <header className={styles.heroCopyDesktop}>
          <h1 id="tp5-hero-title-desktop" className={styles.heroTitleDesktop}>
            {TP5_HERO_TITLE_PREFIX}
            <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
              {TP5_HERO_TITLE_ACCENT}
            </span>
          </h1>
          <p className={styles.heroSubheadDesktop}>{TP5_HERO_SUBHEAD}</p>
          <Tp5DesktopFeatureIconRow />
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
            tabLayoutGroupId="tp5-tabs-desktop"
            tabPillLayoutId="tp5-tab-pill-desktop"
            tierMetaDescClassName={`${styles.tierMetaDesc} lg:line-clamp-none lg:block lg:overflow-visible`}
          />
        </div>
      </div>
    </section>
  );
}
