"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import demoHeroFields from "@/app/[locale]/demo/page.module.css";
import {
  isPlausibleListingUrl,
  isValidOrderEmail,
  isValidOrderPhone,
  isValidVin,
  normalizeVin,
  validateOrderFields,
} from "@/lib/order-field-validation";

const labelDefault =
  "block text-left text-[11px] font-medium uppercase tracking-[0.04em] text-[#6e6e73]";

const inputDefault =
  "mt-2 box-border min-h-11 w-full rounded-none border-0 border-b border-[#050505]/75 bg-transparent px-0 py-2.5 text-[15px] font-normal text-[#1d1d1f] outline-none transition-[border-color] placeholder:text-[#86868b] focus:border-provin-accent focus:ring-0 focus-visible:ring-0 sm:min-h-0 sm:text-[16px]";

const firstStepInfoTextSizeClass = "text-[10.5px] sm:text-[11px]";

type HeroStep2FieldKey = "vin" | "listing" | "email" | "phone";

function buildHeroStep2FieldMessages(
  vinTrim: string,
  listingTrim: string,
  emailTrim: string,
  phoneTrim: string,
  t: (key: string) => string,
): Record<HeroStep2FieldKey, string | null> {
  const vn = normalizeVin(vinTrim);
  const vinMsg = !vn || !isValidVin(vn) ? (!vn ? t("validation.fieldEmpty") : t("validation.vin")) : null;
  const listingMsg =
    listingTrim && !isPlausibleListingUrl(listingTrim) ? t("validation.listing") : null;
  const et = emailTrim.trim();
  const emailMsg = !et ? t("validation.fieldEmpty") : !isValidOrderEmail(emailTrim) ? t("validation.invalidFormat") : null;
  const pt = phoneTrim.trim();
  const phoneMsg = !pt ? t("validation.fieldEmpty") : !isValidOrderPhone(phoneTrim) ? t("validation.invalidFormat") : null;
  return { vin: vinMsg, listing: listingMsg, email: emailMsg, phone: phoneMsg };
}

type OrderFormProps = {
  className?: string;
  variant?: "default" | "compact" | "hero";
  formId?: string;
  hideStepOneCta?: boolean;
  onStepChange?: (step: 1 | 2) => void;
};

export function OrderForm({
  className,
  variant = "default",
  formId,
  hideStepOneCta = false,
  onStepChange,
}: OrderFormProps) {
  const t = useTranslations("Order");
  const te = useTranslations("Order.errors");
  const locale = useLocale();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [heroStep1Errors, setHeroStep1Errors] = useState<{ vin: string | null; listing: string | null }>({
    vin: null,
    listing: null,
  });
  const [heroStep2FieldErrors, setHeroStep2FieldErrors] = useState<Record<HeroStep2FieldKey, string | null>>({
    vin: null,
    listing: null,
    email: null,
    phone: null,
  });
  const [consentError, setConsentError] = useState<string | null>(null);
  const hero = variant === "hero";
  const compact = variant === "compact";
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const lenis = useLenis();

  useEffect(() => {
    onStepChange?.(step);
  }, [onStepChange, step]);

  useEffect(() => {
    if (!hero || step !== 1) return;
    if (!heroStep1Errors.vin && !heroStep1Errors.listing) return;
    const id = heroStep1Errors.vin ? "order-vin" : "order-url";
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.focus()));
  }, [hero, step, heroStep1Errors.vin, heroStep1Errors.listing]);

  useEffect(() => {
    if (!error || !hero) return;
    const el = errorRef.current;
    if (!el) return;
    const show = () => {
      if (lenis) {
        lenis.scrollTo(el, {
          offset: -16,
          duration: 0.55,
        });
      } else {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(show));
  }, [error, hero, lenis]);

  const labelClass = labelDefault;
  const inputBase = inputDefault;

  function goToStepTwo() {
    const vinNormalized = normalizeVin(vin);
    const vinOk = Boolean(vinNormalized && isValidVin(vinNormalized));
    const listingTrim = listingUrl.trim();
    const listingValidIfPresent = !listingTrim || isPlausibleListingUrl(listingTrim);

    if (vinOk && listingValidIfPresent) {
      setHeroStep1Errors({ vin: null, listing: null });
      setVin(vinNormalized);
      setStep(2);
      return;
    }

    const vinMsg = vinOk ? null : !vinNormalized ? t("validation.fieldEmpty") : t("validation.vin");
    const listingMsg =
      listingTrim && !isPlausibleListingUrl(listingTrim) ? t("validation.listing") : null;

    if (hero) {
      setHeroStep1Errors({ vin: vinMsg, listing: listingMsg });
      return;
    }

    if (!vinOk) {
      setError(!vinNormalized ? t("validation.fieldEmpty") : t("validation.vin"));
      return;
    }
    if (listingTrim && !isPlausibleListingUrl(listingTrim)) {
      setError(t("validation.listing"));
      return;
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConsentError(null);
    if (hero) {
      setHeroStep2FieldErrors({ vin: null, listing: null, email: null, phone: null });
    }
    if (step === 1) {
      goToStepTwo();
      return;
    }

    const nameTrim = name.trim();
    const emailTrim = email.trim();
    const phoneTrim = phone.trim();
    const vinTrim = vin.trim();
    const listingTrim = listingUrl.trim();
    const notesTrim = notes.trim();

    if (hero) {
      const msgs = buildHeroStep2FieldMessages(vinTrim, listingTrim, emailTrim, phoneTrim, t);
      if (msgs.vin || msgs.listing || msgs.email || msgs.phone) {
        setHeroStep2FieldErrors(msgs);
        const firstId = msgs.vin ? "order-vin" : msgs.listing ? "order-url" : msgs.email ? "order-email" : "order-phone";
        requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(firstId)?.focus()));
        return;
      }
    } else {
      const fieldError = validateOrderFields({ vin: vinTrim, listingUrl: listingTrim, email: emailTrim, phone: phoneTrim });
      if (fieldError) {
        setError(t(`validation.${fieldError}`));
        return;
      }
    }

    if (!withdrawalConsent) {
      setConsentError(te("withdrawalRequired"));
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("order-checkout-consent")?.focus()));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameTrim || undefined,
          email: emailTrim,
          phone: phoneTrim,
          vin: vinTrim,
          listingUrl: listingTrim,
          notes: notesTrim || undefined,
          locale,
          withdrawalConsent: true,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string; errors?: string[] };
      if (!res.ok) {
        const msg = data.errors?.[0] ?? data.error ?? te("checkoutFailed");
        setError(msg);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(te("noUrl"));
    } catch {
      setError(te("network"));
    } finally {
      setLoading(false);
    }
  }

  const formShell =
    hero
      ? `space-y-4 rounded-none border-0 bg-transparent px-0 py-0 ${className ?? ""}`
      : compact
        ? `mt-6 space-y-4 border-t border-black/[0.06] pt-6 ${className ?? ""}`
        : `mt-10 space-y-6 rounded-none border-0 border-y border-black/[0.08] bg-white/[0.55] px-5 py-8 sm:px-10 sm:py-10 ${className ?? ""}`;

  const gridGap = hero ? "gap-3" : compact ? "gap-4" : "gap-6";
  const notesRows = hero ? 3 : compact ? 3 : 4;

  const hintClass = hero
    ? "order-form-hero-hint mt-1.5 text-[11px] font-normal leading-snug text-[#e5e7eb]/55"
    : "mt-1 text-[11px] font-normal leading-snug text-[#86868b]";

  const reqStarClass = hero ? "text-red-400" : "text-red-600";
  const firstStepVinInputClassDefault = `${inputBase} tracking-normal ${firstStepInfoTextSizeClass}`;
  const firstStepListingInputClassDefault = `${inputBase} ${firstStepInfoTextSizeClass}`;
  const secondStepVinInputClassDefault = `${inputBase} font-mono uppercase tracking-wide`;
  function goBackToStepOne() {
    setStep(1);
    setError(null);
    setConsentError(null);
    setHeroStep1Errors({ vin: null, listing: null });
    setHeroStep2FieldErrors({ vin: null, listing: null, email: null, phone: null });
  }

  const footerClass = hero
    ? step === 1
      ? "order-form-hero-footer mt-3 space-y-3 border-0 pt-0"
      : "order-form-hero-footer mt-6 space-y-5 border-t border-[#c0c0c0]/25 pt-5"
    : compact
      ? step === 1
        ? "mt-4 flex flex-col gap-3 border-0 pt-0"
        : "mt-6 flex flex-col gap-3 border-t border-black/[0.06] pt-6"
      : step === 1
        ? "mt-4 flex flex-col gap-3 border-0 pt-0"
        : "mt-8 flex flex-col gap-3 border-t border-black/[0.06] pt-8";

  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      className={`${formShell}${hero ? " order-form--hero" : ""}`}
      noValidate
    >
      <div className={`grid min-w-0 w-full max-w-full sm:grid-cols-2 ${gridGap}`}>
        <div className="sm:col-span-2">
          {hero ? (
            <>
              <label
                className={`${demoHeroFields.field} ${
                  (step === 1 && heroStep1Errors.vin) || (step === 2 && heroStep2FieldErrors.vin)
                    ? demoHeroFields.fieldInvalid
                    : ""
                }`}
              >
                <span className={demoHeroFields.fieldLabel}>{t("vinLabel")}</span>
                <input
                  id="order-vin"
                  name="vin"
                  type="text"
                  required
                  maxLength={17}
                  spellCheck={false}
                  value={vin}
                  className={step === 2 ? "w-full font-mono uppercase tracking-wide" : "w-full tracking-normal"}
                  placeholder={step === 1 ? t("vinPlaceholderStep1") : t("vinPlaceholderHero")}
                  aria-invalid={
                    (step === 1 && Boolean(heroStep1Errors.vin)) || (step === 2 && Boolean(heroStep2FieldErrors.vin))
                  }
                  aria-describedby={
                    (step === 1 && heroStep1Errors.vin) || (step === 2 && heroStep2FieldErrors.vin)
                      ? "order-hero-vin-error"
                      : undefined
                  }
                  onChange={(e) => {
                    const el = e.target;
                    const value = el.value.toUpperCase().slice(0, 17);
                    setVin(value);
                    if (step === 1) setHeroStep1Errors((p) => ({ ...p, vin: null }));
                    if (step === 2) setHeroStep2FieldErrors((p) => ({ ...p, vin: null }));
                  }}
                />
              </label>
              {(step === 1 && heroStep1Errors.vin) || (step === 2 && heroStep2FieldErrors.vin) ? (
                <p
                  id="order-hero-vin-error"
                  className="order-form-hero-field-error mt-1.5 px-0.5 text-left text-[12px] font-normal leading-snug text-red-300 sm:text-[11px]"
                  aria-live="polite"
                >
                  {step === 1 ? heroStep1Errors.vin : heroStep2FieldErrors.vin}
                </p>
              ) : null}
            </>
          ) : (
            <>
              {step === 2 ? (
                <label htmlFor="order-vin" className={labelClass}>
                  {t("vinLabel")}
                </label>
              ) : null}
              <input
                id="order-vin"
                name="vin"
                type="text"
                required
                maxLength={17}
                spellCheck={false}
                value={vin}
                className={step === 1 ? firstStepVinInputClassDefault : secondStepVinInputClassDefault}
                placeholder={step === 1 ? t("vinPlaceholderStep1") : t("vinPlaceholder")}
                onChange={(e) => {
                  const el = e.target;
                  const value = el.value.toUpperCase().slice(0, 17);
                  setVin(value);
                }}
              />
            </>
          )}
          {step === 2 ? (
            <p className={hero ? hintClass : "mt-1 text-[11px] font-normal leading-snug text-[#aeaeb2]"}>
              {t("vinHint")}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          {hero ? (
            <>
              <label
                className={`${demoHeroFields.field} ${
                  (step === 1 && heroStep1Errors.listing) || (step === 2 && heroStep2FieldErrors.listing)
                    ? demoHeroFields.fieldInvalid
                    : ""
                }`}
              >
                <span className={demoHeroFields.fieldLabel}>{t("listingLabel")}</span>
                <input
                  id="order-url"
                  name="listingUrl"
                  type="url"
                  value={listingUrl}
                  className="w-full"
                  placeholder={step === 1 ? t("listingPlaceholderStep1") : t("urlPlaceholder")}
                  aria-invalid={
                    (step === 1 && Boolean(heroStep1Errors.listing)) ||
                    (step === 2 && Boolean(heroStep2FieldErrors.listing))
                  }
                  aria-describedby={
                    (step === 1 && heroStep1Errors.listing) || (step === 2 && heroStep2FieldErrors.listing)
                      ? "order-hero-listing-error"
                      : undefined
                  }
                  onChange={(e) => {
                    setListingUrl(e.target.value);
                    if (step === 1) setHeroStep1Errors((p) => ({ ...p, listing: null }));
                    if (step === 2) setHeroStep2FieldErrors((p) => ({ ...p, listing: null }));
                  }}
                />
              </label>
              {(step === 1 && heroStep1Errors.listing) || (step === 2 && heroStep2FieldErrors.listing) ? (
                <p
                  id="order-hero-listing-error"
                  className="order-form-hero-field-error mt-1.5 px-0.5 text-left text-[12px] font-normal leading-snug text-red-300 sm:text-[11px]"
                  aria-live="polite"
                >
                  {step === 1 ? heroStep1Errors.listing : heroStep2FieldErrors.listing}
                </p>
              ) : null}
            </>
          ) : (
            <>
              {step === 2 ? (
                <label htmlFor="order-url" className={labelClass}>
                  {t("listingLabel")}
                </label>
              ) : null}
              <input
                id="order-url"
                name="listingUrl"
                type="url"
                value={listingUrl}
                className={step === 1 ? firstStepListingInputClassDefault : inputBase}
                placeholder={step === 1 ? t("listingPlaceholderStep1") : t("urlPlaceholder")}
                onChange={(e) => setListingUrl(e.target.value)}
              />
            </>
          )}
          {step === 2 ? <p className={hintClass}>{t("listingHint")}</p> : null}
        </div>
        {step === 2 ? (
          <>
            <div className="sm:col-span-2">
              {hero ? (
                <label className={demoHeroFields.field}>
                  <span className={demoHeroFields.fieldLabel}>{t("nameLabel")}</span>
                  <input
                    id="order-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full"
                    placeholder={t("namePlaceholder")}
                  />
                </label>
              ) : (
                <>
                  <label htmlFor="order-name" className={labelClass}>
                    {t("nameLabel")}
                  </label>
                  <input
                    id="order-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputBase}
                    placeholder={t("namePlaceholder")}
                  />
                </>
              )}
            </div>
            <div className="min-w-0 sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4">
              <div>
                {hero ? (
                  <>
                    <label
                      className={`${demoHeroFields.field} ${heroStep2FieldErrors.email ? demoHeroFields.fieldInvalid : ""}`}
                    >
                      <span className={demoHeroFields.fieldLabel}>
                        {t("emailLabel")} <span className={reqStarClass}>*</span>
                      </span>
                      <input
                        id="order-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setHeroStep2FieldErrors((p) => ({ ...p, email: null }));
                        }}
                        className="w-full"
                        placeholder={t("emailPlaceholder")}
                        aria-invalid={Boolean(heroStep2FieldErrors.email)}
                        aria-describedby={heroStep2FieldErrors.email ? "order-hero-email-error" : undefined}
                      />
                    </label>
                    {heroStep2FieldErrors.email ? (
                      <p
                        id="order-hero-email-error"
                        className="order-form-hero-field-error mt-1.5 px-0.5 text-left text-[12px] font-normal leading-snug text-red-300 sm:text-[11px]"
                        aria-live="polite"
                      >
                        {heroStep2FieldErrors.email}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <label htmlFor="order-email" className={labelClass}>
                      {t("emailLabel")} <span className={reqStarClass}>*</span>
                    </label>
                    <input
                      id="order-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputBase}
                      placeholder={t("emailPlaceholder")}
                    />
                  </>
                )}
                <p className={hintClass}>{t("emailHint")}</p>
              </div>
              <div>
                {hero ? (
                  <>
                    <label
                      className={`${demoHeroFields.field} ${heroStep2FieldErrors.phone ? demoHeroFields.fieldInvalid : ""}`}
                    >
                      <span className={demoHeroFields.fieldLabel}>
                        {t("phoneLabel")} <span className={reqStarClass}>*</span>
                      </span>
                      <input
                        id="order-phone"
                        name="phone"
                        type="tel"
                        required
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setHeroStep2FieldErrors((p) => ({ ...p, phone: null }));
                        }}
                        className="w-full"
                        placeholder={t("phonePlaceholder")}
                        aria-invalid={Boolean(heroStep2FieldErrors.phone)}
                        aria-describedby={heroStep2FieldErrors.phone ? "order-hero-phone-error" : undefined}
                      />
                    </label>
                    {heroStep2FieldErrors.phone ? (
                      <p
                        id="order-hero-phone-error"
                        className="order-form-hero-field-error mt-1.5 px-0.5 text-left text-[12px] font-normal leading-snug text-red-300 sm:text-[11px]"
                        aria-live="polite"
                      >
                        {heroStep2FieldErrors.phone}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <label htmlFor="order-phone" className={labelClass}>
                      {t("phoneLabel")} <span className={reqStarClass}>*</span>
                    </label>
                    <input
                      id="order-phone"
                      name="phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputBase}
                      placeholder={t("phonePlaceholder")}
                    />
                  </>
                )}
                <p className={hintClass}>{t("phoneHint")}</p>
              </div>
            </div>
            <div className="sm:col-span-2">
              {hero ? (
                <label className={demoHeroFields.field}>
                  <span className={demoHeroFields.fieldLabel}>{t("notesLabel")}</span>
                  <textarea
                    id="order-notes"
                    name="notes"
                    rows={notesRows}
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[5.75rem] w-full resize-y md:resize-y"
                    placeholder={t("notesPlaceholder")}
                  />
                </label>
              ) : (
                <>
                  <label htmlFor="order-notes" className={labelClass}>
                    {t("notesLabel")}
                  </label>
                  <textarea
                    id="order-notes"
                    name="notes"
                    rows={notesRows}
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`${inputBase} min-h-[88px] resize-y sm:min-h-[72px]`}
                    placeholder={t("notesPlaceholder")}
                  />
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      {error && (
        <p
          ref={errorRef}
          className={
            hero
              ? "order-form-hero-alert mt-3 rounded-md border border-red-500/35 bg-red-950/30 px-3 py-2.5 text-left text-[13px] font-normal leading-snug text-red-200 max-md:text-[calc(13px*1.2)]"
              : "mt-4 rounded-lg border border-red-200/90 bg-red-50/95 px-3 py-2.5 text-left text-[13px] font-normal leading-snug text-red-900"
          }
          aria-live="polite"
        >
          {error}
        </p>
      )}

      <div
        className={footerClass}
      >
        {hero ? (
          <>
            {step === 2 ? (
              <div className="order-form-hero-rule border-b border-[#c0c0c0]/35 pb-4" role="group" aria-label={t("ariaSummary")}>
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="order-form-hero-summary-label min-w-0 shrink text-[13px] font-medium text-[#e5e7eb]">{t("summaryLabel")}</span>
                  <span className="order-form-hero-price shrink-0 text-[1.85rem] font-bold tabular-nums tracking-tight text-[#c0c0c0] sm:text-[2rem]">
                    79,99&nbsp;€
                  </span>
                </div>
                <p className="order-form-hero-summary-note mt-2 text-[11px] font-normal leading-snug text-[#e5e7eb]/58 sm:text-[12px]">
                  {t("summaryNote")}
                </p>
              </div>
            ) : null}
            {step === 1 && !hideStepOneCta ? (
              <div className="flex w-full justify-center">
                <button
                  type="button"
                  onClick={goToStepTwo}
                  className="provin-home-pill-cta provin-home-pill-cta--fit z-10 mt-1 flex w-fit min-h-[50px] max-w-full touch-manipulation items-center justify-center whitespace-nowrap text-center shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
                >
                  {t("heroOrderCta")}
                </button>
              </div>
            ) : null}
            {step === 2 ? (
              <div className="order-form-hero-rule border-b border-[#c0c0c0]/35 pb-4">
                <label
                  htmlFor="order-checkout-consent"
                  className="flex min-h-11 cursor-pointer items-start gap-3 text-left sm:min-h-0"
                >
                  <input
                    id="order-checkout-consent"
                    type="checkbox"
                    name="withdrawalConsent"
                    checked={withdrawalConsent}
                    onChange={(e) => {
                      setWithdrawalConsent(e.target.checked);
                      setConsentError(null);
                    }}
                    className="order-form-hero-checkbox mt-1 h-4 w-4 shrink-0 rounded border-[#c0c0c0] bg-transparent text-provin-accent focus:ring-1 focus:ring-[#0066ff]/40 sm:mt-0.5 sm:h-4 sm:w-4"
                    aria-invalid={Boolean(consentError)}
                    aria-describedby={consentError ? "order-hero-consent-error" : undefined}
                    aria-label={t("checkoutConsentAria")}
                  />
                  <span className="order-form-hero-consent-text text-[12px] font-normal leading-snug text-[#e5e7eb] sm:text-[13px]">
                    {t.rich("checkoutConsent", {
                      terms: (chunks) => (
                        <Link
                          href="/lietosanas-noteikumi"
                          className="font-medium text-provin-accent underline decoration-provin-accent/30 underline-offset-2 transition hover:decoration-provin-accent/60"
                        >
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link
                          href="/privatuma-politika"
                          className="font-medium text-provin-accent underline decoration-provin-accent/30 underline-offset-2 transition hover:decoration-provin-accent/60"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                {consentError ? (
                  <p
                    id="order-hero-consent-error"
                    className="order-form-hero-field-error mt-2 px-0.5 text-left text-[12px] font-normal leading-snug text-red-300 sm:text-[11px]"
                    aria-live="polite"
                  >
                    {consentError}
                  </p>
                ) : null}
              </div>
            ) : null}
            {step === 2 ? (
            <button
              type="submit"
              disabled={loading}
              className="provin-home-pill-cta provin-home-pill-cta--wide mx-auto mt-1 flex min-h-12 max-w-[min(100%,20rem)] touch-manipulation items-center justify-center gap-2 disabled:opacity-60 sm:min-h-[50px]"
            >
              {loading ? (
                t("payLoading")
              ) : (
                <>
                  {t("payButton")}
                  <ArrowRight
                    className="order-form-hero-pay-arrow h-4 w-4 shrink-0 text-white/90"
                    strokeWidth={2}
                    aria-hidden
                  />
                </>
              )}
            </button>
            ) : null}
            {step === 2 ? (
              <button
                type="button"
                onClick={goBackToStepOne}
                className="mx-auto text-center text-[12px] font-medium text-[#e5e7eb]/70 underline decoration-[#e5e7eb]/30 underline-offset-2 hover:text-[#e5e7eb]"
              >
                {t("backToFirstStep")}
              </button>
            ) : null}
            {step === 2 ? (
              <p className="order-form-hero-stripe-note text-center text-[10px] font-normal leading-relaxed text-[#e5e7eb]/48 sm:text-[11px]">
                {t("stripeNote")}
              </p>
            ) : null}
          </>
        ) : (
          <>
            {step === 2 ? (
              <div className="border-b border-[#050505]/12 pb-4">
                <label
                  htmlFor="order-checkout-consent"
                  className="flex min-h-11 cursor-pointer items-start gap-3 text-left sm:min-h-0"
                >
                  <input
                    id="order-checkout-consent"
                    type="checkbox"
                    name="withdrawalConsent"
                    checked={withdrawalConsent}
                    onChange={(e) => {
                      setWithdrawalConsent(e.target.checked);
                      setConsentError(null);
                    }}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-[#050505]/35 text-provin-accent focus:ring-1 focus:ring-provin-accent/25 sm:mt-0.5 sm:h-4 sm:w-4"
                    aria-invalid={Boolean(consentError)}
                    aria-describedby={consentError ? "order-consent-error" : undefined}
                    aria-label={t("checkoutConsentAria")}
                  />
                  <span className="text-[12px] font-normal leading-snug text-[#424245] sm:text-[13px]">
                    {t.rich("checkoutConsent", {
                      terms: (chunks) => (
                        <Link
                          href="/lietosanas-noteikumi"
                          className="font-medium text-provin-accent underline decoration-provin-accent/30 underline-offset-2 transition hover:decoration-provin-accent/60"
                        >
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link
                          href="/privatuma-politika"
                          className="font-medium text-provin-accent underline decoration-provin-accent/30 underline-offset-2 transition hover:decoration-provin-accent/60"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                {consentError ? (
                  <p
                    id="order-consent-error"
                    className="mt-2 text-left text-[12px] font-normal leading-snug text-red-700 sm:text-[13px]"
                    aria-live="polite"
                  >
                    {consentError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div
              className={`flex flex-col gap-2 ${compact ? "sm:flex-row sm:items-center sm:justify-between sm:gap-4" : "sm:flex-row sm:items-center sm:justify-between"}`}
            >
              {step === 1 ? (
                !hideStepOneCta ? (
                  <div className="flex w-full justify-center">
                    <button
                      type="button"
                      onClick={goToStepTwo}
                      className="provin-home-pill-cta provin-home-pill-cta--fit z-10 flex w-fit min-h-[50px] max-w-full touch-manipulation items-center justify-center whitespace-nowrap text-center shadow-[0_7px_24px_rgba(0,0,0,0.18)] active:scale-95"
                    >
                      {t("heroOrderCta")}
                    </button>
                  </div>
                ) : null
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="provin-btn provin-btn--compact inline-flex min-h-11 w-full min-w-[180px] items-center justify-center rounded-full px-7 py-[10px] text-[14px] font-normal shadow-[0_4px_14px_rgba(0,0,0,0.12)] disabled:opacity-60 sm:w-auto sm:min-h-10"
                >
                  {loading ? t("payLoading") : t("payButton")}
                </button>
              )}
              {step === 2 ? (
                <button
                  type="button"
                  onClick={goBackToStepOne}
                  className="text-[12px] font-medium text-[#6e6e73] underline decoration-[#6e6e73]/35 underline-offset-2 hover:text-[#1d1d1f]"
                >
                  {t("backToFirstStep")}
                </button>
              ) : null}
              {step === 2 ? (
                <p className="text-center text-[10px] font-normal leading-snug text-[#aeaeb2] sm:max-w-[14rem] sm:text-right">
                  {t("stripeNote")}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </form>
  );
}
