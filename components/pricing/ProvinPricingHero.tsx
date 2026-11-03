"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { EuropeDotMap } from "@/components/EuropeDotMap";
import { HeroOrderCardV6 } from "@/components/home/v6/HeroOrderCardV6";
import heroStyles from "@/components/home/v6/hero-v6.module.css";
import { Tp5CheckoutEmailModal, Tp5MiniConfirmModal } from "@/components/test-pricing-5/Tp5MiniConfirmModal";
import { Tp5VinHighlightContext } from "@/components/test-pricing-5/Tp5MobilePricingCard";
import { getHomeV6HeroCopy } from "@/lib/home-hero-v6-copy";
import { getTp5HeroCopy } from "@/lib/test-pricing-5-hero-copy";
import { TP5_MOBILE_CHECKOUT_PLAN, type Tp5MobileServiceId } from "@/lib/test-pricing-5-mobile";
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
  mobileTitleId: _mobileTitleId = "provin-pricing-hero-title",
  desktopTitleId = "provin-pricing-hero-title-desktop",
}: Props) {
  const locale = useLocale();
  const uiCopy = getTp5UiCopy(locale);
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => new URLSearchParams());
  const [activeId, setActiveId] = useState<Tp5MobileServiceId>("audits");
  /** Telefonā pasūtījuma lauki atveras pēc paketes izvēles. */
  const [picked, setPicked] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const planParamApplied = useRef(false);
  const onSearchParams = useCallback((params: URLSearchParams) => {
    setSearchParams(params);
    // Kā agrāk `useState(initialPlan)`: `?plan=` / `?tab=` nosaka sākuma cilni tikai vienreiz.
    if (planParamApplied.current) return;
    planParamApplied.current = true;
    const plan = parseHeroPlanParam(params.get("plan") ?? params.get("tab"));
    if (plan) {
      setActiveId(plan);
      setPicked(true);
    }
  }, []);
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [errors, setErrors] = useState<Tp5InlineFieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [miniConfirm, setMiniConfirm] = useState<MiniCsddModalVariant | null>(null);
  const [emailConfirmPlan, setEmailConfirmPlan] = useState<TestPricingPlanId | null>(null);
  const heroCopy = getTp5HeroCopy(locale, "audits");
  const v6 = getHomeV6HeroCopy(locale);

  const cancelled = searchParams.get("atcelts") === "1";

  /** VIN / numurzīme, kas ielikta no bezmaksas pārbaudes: lauks nomirgo zaļš un paliek zaļš, līdz to maina. */
  const [prefilledVin, setPrefilledVin] = useState("");

  useEffect(() => {
    const prefilled = publicOrderVinFromQuery(searchParams.get(PUBLIC_ORDER_VIN_QUERY));
    if (prefilled) {
      setVin(prefilled);
      setPrefilledVin(prefilled);
      setPicked(true);
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
      if (detail.plan) setActiveId(detail.plan);
      setPicked(true);
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

  const submitCheckoutForActive = useCallback(() => {
    void requestServiceCheckout(activeId);
  }, [activeId, requestServiceCheckout]);

  const selectService = useCallback((id: Tp5MobileServiceId) => {
    setActiveId(id);
    setPicked(true);
  }, []);

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
      setActiveId("audits");
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

  const titleWords = heroCopy.titlePrefix.trim().split(/\s+/);

  return (
    <Tp5VinHighlightContext.Provider value={vinHighlight}>
    <div className={styles.heroPricingShell}>
      <Suspense fallback={null}>
        <HeroSearchParamsSync onChange={onSearchParams} />
      </Suspense>
      <section id={sectionId} className={heroStyles.hero} aria-labelledby={desktopTitleId}>
        <div className={heroStyles.map} aria-hidden>
          <EuropeDotMap />
        </div>
        <div className={heroStyles.inner}>
          {cancelled ? <p className={`${styles.cancelNote} ${heroStyles.cancel}`}>{uiCopy.cancelNote}</p> : null}
          <div className={heroStyles.copy}>
            <h1 id={desktopTitleId} className={heroStyles.title}>
              {titleWords.map((word, i) => (
                <span key={`${word}-${i}`} className={heroStyles.word} style={{ "--d": i } as CSSProperties}>
                  {word}{" "}
                </span>
              ))}
              <em className={`${heroStyles.word} ${heroStyles.accent}`} style={{ "--d": titleWords.length } as CSSProperties}>
                {heroCopy.titleAccent}
              </em>
            </h1>
            <p className={`${heroStyles.lead}${leadOpen ? ` ${heroStyles.leadOpen}` : ""}`}>
              {v6.leadFirst} <span className={heroStyles.leadRest}>{v6.leadRest}</span>{" "}
              {leadOpen ? null : (
                <button type="button" className={heroStyles.readMore} onClick={() => setLeadOpen(true)}>
                  {v6.readMore}
                </button>
              )}
            </p>
            <p className={heroStyles.rating}>
              <i aria-hidden>★</i> <b>5,0</b> {v6.rating}
            </p>
          </div>
          <div className={heroStyles.cardCol}>
            <HeroOrderCardV6
              activeId={activeId}
              onSelect={selectService}
              picked={picked}
              vin={vin}
              listingUrl={listingUrl}
              errors={errors}
              globalError={globalError}
              loading={loading}
              onVinChange={setVin}
              onListingUrlChange={setListingUrl}
              onSubmit={submitCheckoutForActive}
            />
            <a href="#segums" className={heroStyles.incLink}>
              {v6.includedLink}
              <i aria-hidden />
            </a>
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
