"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { Tp5DesktopFeatureIconRow } from "@/components/test-pricing-5/Tp5DesktopFeatureIconRow";
import { Tp5CheckoutEmailModal, Tp5MiniConfirmModal } from "@/components/test-pricing-5/Tp5MiniConfirmModal";
import { Tp5MobilePricingCard, Tp5VinHighlightContext } from "@/components/test-pricing-5/Tp5MobilePricingCard";
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
import { HERO_PREFILL_EVENT, type HeroPrefillDetail } from "@/lib/hero-prefill";
import { followStripeCheckoutUrl, trackMetaLead } from "@/lib/meta-pixel";

/**
 * `useSearchParams` atsevišķā Suspense bērnā: citādi statiskajā renderā viss hero (ar H1 un
 * cenu karti) pāriet uz klienta renderu un HTML tā nav (SEO, CLS). Parametri pienāk pēc hidratācijas.
 */
function HeroSearchParamsSync({ onChange }: { onChange: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    onChange(new URLSearchParams(searchParams.toString()));
  }, [searchParams, onChange]);
  return null;
}

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
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => new URLSearchParams());
  const [mobileActiveId, setMobileActiveId] = useState<Tp5MobileServiceId>("audits");
  const [desktopActiveId, setDesktopActiveId] = useState<Tp5MobileServiceId>("audits");
  const planParamApplied = useRef(false);
  const onSearchParams = useCallback((params: URLSearchParams) => {
    setSearchParams(params);
    // Kā agrāk `useState(initialPlan)`: `?plan=` / `?tab=` nosaka sākuma cilni tikai vienreiz.
    if (planParamApplied.current) return;
    planParamApplied.current = true;
    const plan = parseHeroPlanParam(params.get("plan") ?? params.get("tab"));
    if (plan) {
      setMobileActiveId(plan);
      setDesktopActiveId(plan);
    }
  }, []);
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

  /** VIN / numurzīme, kas ielikta no bezmaksas pārbaudes: lauks nomirgo zaļš un paliek zaļš, līdz to maina. */
  const [prefilledVin, setPrefilledVin] = useState("");

  useEffect(() => {
    const prefilled = publicOrderVinFromQuery(searchParams.get(PUBLIC_ORDER_VIN_QUERY));
    if (prefilled) {
      setVin(prefilled);
      setPrefilledVin(prefilled);
    }
  }, [searchParams]);

  useEffect(() => {
    function onPrefill(event: Event) {
      const detail = (event as CustomEvent<HeroPrefillDetail>).detail;
      const value = publicOrderVinFromQuery(detail?.vin);
      if (!value) return;
      setErrors({});
      setGlobalError(null);
      setVin(value);
      if (detail.listingUrl) setListingUrl(detail.listingUrl);
      if (detail.plan) {
        setMobileActiveId(detail.plan);
        setDesktopActiveId(detail.plan);
      }
      // Notīra un ieliek no jauna, lai animācija atkārtojas arī ar to pašu VIN.
      setPrefilledVin("");
      window.requestAnimationFrame(() => setPrefilledVin(value));
    }
    window.addEventListener(HERO_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(HERO_PREFILL_EVENT, onPrefill);
  }, []);
  const vinHighlight = Boolean(prefilledVin) && vin === prefilledVin;

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
    <Tp5VinHighlightContext.Provider value={vinHighlight}>
    <div className={styles.heroPricingShell}>
      <Suspense fallback={null}>
        <HeroSearchParamsSync onChange={onSearchParams} />
      </Suspense>
      <section id={sectionId} className={styles.heroSurface} aria-labelledby={mobileTitleId}>
        <div className={styles.heroAmbientGlow} aria-hidden />
        <div className={styles.heroBackdrop} aria-hidden>
          <HeroVisual />
        </div>
        <div className={styles.heroScrim} aria-hidden />

      <div className={styles.heroInnerMobile}>
        {cancelled ? <p className={styles.cancelNote}>{uiCopy.cancelNote}</p> : null}

        {/* Mobilajā skatā redzama virsraksta nav: H1 tikai ekrāna lasītājam. Desktop `heroInnerMobile`
            ir `display:none`, tāpēc katrā skatā pieejams tieši viens H1. */}
        <h1 id={mobileTitleId} className="sr-only">
          {mobileHeroCopy.titlePrefix}
          {mobileHeroCopy.titleAccent}
        </h1>

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
    </Tp5VinHighlightContext.Provider>
  );
}
