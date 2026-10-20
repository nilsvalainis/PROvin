"use client";

import { useCallback, useEffect, useState, type SyntheticEvent } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { Tp5DesktopFeatureIconRow } from "@/components/test-pricing-5/Tp5DesktopFeatureIconRow";
import { Tp5CheckoutEmailModal, Tp5MiniConfirmModal } from "@/components/test-pricing-5/Tp5MiniConfirmModal";
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
import {
  MINI_CSDD_LOOKUP_TIMEOUT_MS,
  parseMiniCsddVariantResponse,
  type MiniCsddModalVariant,
} from "@/lib/mini-csdd-eligibility";
import { normalizeVin } from "@/lib/order-field-validation";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";
import { useTierSwipe } from "@/lib/use-test-pricing-tier-swipe";
import { parseHeroPlanParam } from "@/lib/home-hero-plan";
import { publicOrderVinFromQuery, PUBLIC_ORDER_VIN_QUERY } from "@/lib/public-order-vin-prefill";
import { followStripeCheckoutUrl, trackMetaLead } from "@/lib/meta-pixel";

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
  const [miniConfirm, setMiniConfirm] = useState<MiniCsddModalVariant | null>(null);
  const [emailConfirmPlan, setEmailConfirmPlan] = useState<TestPricingPlanId | null>(null);
  const mobileHeroCopy = getTp5HeroCopy(locale, mobileActiveId);
  const desktopHeroCopy = getTp5HeroCopy(locale, desktopActiveId);

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

  useEffect(() => {
    const prefilled = publicOrderVinFromQuery(searchParams.get(PUBLIC_ORDER_VIN_QUERY));
    if (prefilled) setVin(prefilled);
  }, [searchParams]);

  const submitCheckout = useCallback(
    async (planId: TestPricingPlanId, customerEmail?: string) => {
      setGlobalError(null);
      const validation = validateTp5InlineFields(listingUrl, vin, locale);
      if (!validation.ok) {
        setErrors(validation.errors);
        const first = validation.errors.listingUrl ?? validation.errors.vin;
        if (first) setGlobalError(first);
        return;
      }
      setErrors({});
      trackMetaLead();
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
            customerEmail: customerEmail?.trim() || undefined,
            withdrawalConsent: true,
            sourcePage: checkoutSource,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          eventId?: string;
          value?: number;
          error?: string;
          errors?: string[];
        };
        if (!res.ok || !followStripeCheckoutUrl(data)) {
          throw new Error(data.errors?.[0] ?? data.error ?? uiCopy.checkoutErrorFallback);
        }
      } catch (e) {
        setGlobalError(e instanceof Error ? e.message : uiCopy.checkoutErrorFallback);
      } finally {
        setLoading(false);
      }
    },
    [checkoutSource, listingUrl, locale, uiCopy.checkoutErrorFallback, vin],
  );

  const lookupMiniConfirmVariant = useCallback(async (): Promise<MiniCsddModalVariant> => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), MINI_CSDD_LOOKUP_TIMEOUT_MS + 500);
    try {
      const res = await fetch("/api/checkout/mini-csdd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: normalizeVin(vin) }),
        signal: ctrl.signal,
      });
      const data: unknown = await res.json().catch(() => ({}));
      return parseMiniCsddVariantResponse(data);
    } catch {
      return "normal";
    } finally {
      window.clearTimeout(timer);
    }
  }, [vin]);

  const requestServiceCheckout = useCallback(
    async (serviceId: Tp5MobileServiceId) => {
      setGlobalError(null);
      const validation = validateTp5InlineFields(listingUrl, vin, locale);
      if (!validation.ok) {
        setErrors(validation.errors);
        const first = validation.errors.listingUrl ?? validation.errors.vin;
        if (first) setGlobalError(first);
        return;
      }
      setErrors({});
      if (serviceId !== "mini") {
        setEmailConfirmPlan(TP5_MOBILE_CHECKOUT_PLAN[serviceId]);
        return;
      }
      setLoading(true);
      const variant = await lookupMiniConfirmVariant();
      setLoading(false);
      setMiniConfirm(variant);
    },
    [listingUrl, locale, lookupMiniConfirmVariant, vin],
  );

  const submitMobileCheckout = useCallback(() => {
    void requestServiceCheckout(mobileActiveId);
  }, [mobileActiveId, requestServiceCheckout]);

  const submitDesktopCheckout = useCallback(() => {
    void requestServiceCheckout(desktopActiveId);
  }, [desktopActiveId, requestServiceCheckout]);

  const closeMiniConfirm = useCallback(() => {
    setMiniConfirm(null);
  }, []);

  const closeEmailConfirm = useCallback(() => {
    setEmailConfirmPlan(null);
  }, []);

  const continueMiniCheckout = useCallback(
    (email: string) => {
      setMiniConfirm(null);
      void submitCheckout(TP5_MOBILE_CHECKOUT_PLAN.mini, email);
    },
    [submitCheckout],
  );

  const switchToAuditsCheckout = useCallback(
    (email: string) => {
      setMiniConfirm(null);
      setMobileActiveId("audits");
      setDesktopActiveId("audits");
      void submitCheckout(TP5_MOBILE_CHECKOUT_PLAN.audits, email);
    },
    [submitCheckout],
  );

  const continueEmailCheckout = useCallback(
    (email: string) => {
      const planId = emailConfirmPlan;
      setEmailConfirmPlan(null);
      if (planId) void submitCheckout(planId, email);
    },
    [emailConfirmPlan, submitCheckout],
  );

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

        {/* One H1 in HTML. Mobile UI has no visible title; desktop shows this same string. */}
        <p id={mobileTitleId} className="sr-only">
          {mobileHeroCopy.titlePrefix}
          {mobileHeroCopy.titleAccent}
        </p>

        <div className={styles.stage}>
          <Tp5MobilePricingCard
            layout="mobile"
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
            {desktopHeroCopy.titlePrefix}
            <span className={`${styles.heroTitleAccent} text-[#2563EB]`}>
              {desktopHeroCopy.titleAccent}
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
            tierMetaDescClassName={styles.tierMetaDesc}
          />
        </div>
      </div>
      </section>
      <Tp5MiniConfirmModal
        open={miniConfirm !== null}
        variant={miniConfirm ?? "normal"}
        locale={locale}
        onContinueMini={continueMiniCheckout}
        onSwitchAudits={switchToAuditsCheckout}
        onClose={closeMiniConfirm}
      />
      <Tp5CheckoutEmailModal
        open={emailConfirmPlan !== null}
        locale={locale}
        onContinue={continueEmailCheckout}
        onClose={closeEmailConfirm}
      />
    </div>
  );
}
