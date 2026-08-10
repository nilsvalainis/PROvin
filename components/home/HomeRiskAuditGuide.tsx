"use client";

import { useEffect, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { track } from "@vercel/analytics";
import { useTranslations } from "next-intl";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { Link } from "@/i18n/navigation";
import { homeHeroCheckoutHref } from "@/lib/home-hero-plan";
import {
  isPlausibleListingUrl,
  isValidOrderEmail,
  isValidOrderPhone,
} from "@/lib/order-field-validation";

function safeTrack(event: string, data?: Record<string, string | number | boolean>) {
  try {
    track(event, data);
  } catch {
    /* ignore */
  }
}

export function HomeRiskAuditGuide() {
  const t = useTranslations("RiskAuditGuide");
  const baseId = useId();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [listingUrl, setListingUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const listingTrim = listingUrl.trim();
  const listingOk = listingTrim.length > 0 && isPlausibleListingUrl(listingTrim);
  const listingTouchedInvalid = listingTrim.length > 0 && !listingOk;

  useEffect(() => {
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("provin-risk-guide-view")) {
        return;
      }
      sessionStorage.setItem("provin-risk-guide-view", "1");
    } catch {
      /* private mode */
    }
    safeTrack("risk_guide_view");
  }, []);

  function openForm() {
    setExpanded(true);
    setFormError(null);
    setRateLimited(false);
    safeTrack("risk_guide_expand");
  }

  function submitFree(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setRateLimited(false);

    const url = listingUrl.trim();
    const mail = email.trim();
    const tel = phone.trim();
    if (!url || !isPlausibleListingUrl(url)) {
      setFormError(t("errors.listing"));
      return;
    }
    if (!mail || !isValidOrderEmail(mail)) {
      setFormError(t("errors.email"));
      return;
    }
    if (!tel || !isValidOrderPhone(tel)) {
      setFormError(t("errors.phone"));
      return;
    }

    startTransition(async () => {
      safeTrack("risk_guide_free_submitted");
      try {
        const res = await fetch("/api/listing-peek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: mail, phone: tel, listingUrl: url }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;

        if (res.status === 429) {
          safeTrack("risk_guide_rate_limited");
          if (data?.error === "contact_rate_limited" || data?.error === "email_rate_limited") {
            setRateLimited(true);
            setFormError(t("errors.rateLimited"));
          } else if (data?.error === "ip_rate_limited") {
            setFormError(t("errors.ipRateLimited"));
          } else {
            setFormError(t("errors.rateLimited"));
            setRateLimited(true);
          }
          return;
        }
        if (!res.ok) {
          if (data?.error === "invalid_listing") setFormError(t("errors.listing"));
          else if (data?.error === "invalid_email") setFormError(t("errors.email"));
          else if (data?.error === "invalid_phone") setFormError(t("errors.phone"));
          else setFormError(t("errors.generic"));
          return;
        }

        safeTrack("risk_guide_free_success");
        setSuccess(true);
        setFormError(null);
        setRateLimited(false);
      } catch {
        setFormError(t("errors.generic"));
      }
    });
  }

  function LiquidBtn({
    children,
    onClick,
    disabled,
    type = "button",
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
  }) {
    return (
      <button type={type} onClick={onClick} disabled={disabled} className={tp5Styles.liquidCta}>
        <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
        <span className={`${tp5Styles.liquidCtaLabel} inline-flex items-center justify-center gap-2`}>
          {children}
        </span>
      </button>
    );
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-white/[0.12] bg-black/20 px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-[#0066ff]/50 focus:ring-1 focus:ring-[#0066ff]/25";

  return (
    <section
      id="riska-celvedis"
      className="home-body-ink relative scroll-mt-14 bg-transparent"
      aria-labelledby={`${baseId}-heading`}
    >
      <div
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] py-10 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-12 lg:px-8 lg:pb-16 lg:pt-14">
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
          <header className="lg:col-span-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7eb0ff]">
              {t("eyebrow")}
            </p>
            <h2
              id={`${baseId}-heading`}
              className="mt-2 text-balance text-[1.65rem] font-semibold tracking-tight text-white sm:text-[2rem] lg:text-[2.15rem]"
            >
              {t("title")}
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/50 sm:text-[16px]">
              {t("subtitle")}
            </p>
          </header>

          <div className="min-w-0 lg:col-span-7">
            {!success ? (
              <div className="max-w-lg">
                <LiquidBtn onClick={openForm}>
                  {t("triggerCta")}
                  <ArrowDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </LiquidBtn>
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {(expanded || success) && (
                <motion.div
                  key="peek-panel"
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { height: { duration: 0.42, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.28 } }
                  }
                  className="overflow-hidden"
                >
                  <div className={!success ? "mt-8 border-t border-white/[0.08] pt-8" : "mt-2"}>
                    <AnimatePresence mode="wait" initial={false}>
                      {success ? (
                        <motion.div
                          key="success"
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.28 }}
                          className="rounded-2xl border border-white/[0.1] bg-white/[0.03] px-5 py-6 sm:px-6 sm:py-7"
                          role="status"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#0066ff]/40 bg-[#0066ff]/[0.12]">
                            <Check className="h-5 w-5 text-[#7eb0ff]" strokeWidth={2.25} aria-hidden />
                          </div>
                          <h3 className="mt-4 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.5rem]">
                            {t("success.title")}
                          </h3>
                          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-white/50">
                            {t("success.body")}
                          </p>
                        </motion.div>
                      ) : (
                        <motion.form
                          key="form"
                          onSubmit={submitFree}
                          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.25 }}
                          className="space-y-4"
                        >
                          <div>
                            <label
                              htmlFor={`${baseId}-listing`}
                              className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
                            >
                              {t("form.listingLabel")}
                            </label>
                            <input
                              id={`${baseId}-listing`}
                              type="url"
                              inputMode="url"
                              autoComplete="url"
                              required
                              placeholder={t("form.listingPlaceholder")}
                              value={listingUrl}
                              onChange={(e) => setListingUrl(e.target.value)}
                              onBlur={() => {
                                if (listingTrim) {
                                  safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
                                }
                              }}
                              className={inputClass}
                            />
                            {listingTouchedInvalid ? (
                              <p className="mt-2 text-[13px] text-amber-200/90">{t("errors.listing")}</p>
                            ) : null}
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`${baseId}-email`}
                                className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
                              >
                                {t("form.emailLabel")}
                              </label>
                              <input
                                id={`${baseId}-email`}
                                type="email"
                                autoComplete="email"
                                required
                                placeholder={t("form.emailPlaceholder")}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`${baseId}-phone`}
                                className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
                              >
                                {t("form.phoneLabel")}
                              </label>
                              <input
                                id={`${baseId}-phone`}
                                type="tel"
                                autoComplete="tel"
                                inputMode="tel"
                                required
                                placeholder={t("form.phonePlaceholder")}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className={inputClass}
                              />
                            </div>
                          </div>

                          {formError ? (
                            <div role="alert">
                              <p className="text-[13px] leading-relaxed text-amber-200/90">{formError}</p>
                              {rateLimited ? (
                                <Link
                                  href={homeHeroCheckoutHref("audits")}
                                  onClick={() => safeTrack("risk_guide_audits_clicked")}
                                  className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#7eb0ff] transition hover:text-white"
                                >
                                  {t("errors.rateLimitedCta")}
                                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                                </Link>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="max-w-md pt-1">
                            <LiquidBtn type="submit" disabled={pending}>
                              {pending ? t("form.submitting") : t("form.submit")}
                              {!pending ? (
                                <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                              ) : null}
                            </LiquidBtn>
                            <p className="mt-3 text-[12px] leading-relaxed text-white/40">
                              {t("form.disclaimer")}
                            </p>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
