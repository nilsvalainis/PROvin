"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
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
    if (expanded) return;
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
        <div className="mx-auto w-full max-w-2xl">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7eb0ff]/90">
                {t("eyebrow")}
              </p>
              <h2
                id={`${baseId}-heading`}
                className="mt-3 text-balance text-[1.55rem] font-semibold tracking-tight text-white sm:text-[1.85rem] lg:text-[2rem]"
              >
                {t("title")}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-white/50 sm:text-[15px]">
                {t("subtitle")}
              </p>
            </div>

            {!expanded && !success ? (
              <div className="mt-7 flex justify-center">
                <button
                  type="button"
                  onClick={openForm}
                  aria-expanded={false}
                  className="group inline-flex min-h-[48px] items-center gap-3 rounded-full border border-white/[0.14] bg-white/[0.03] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/75 transition hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
                >
                  {t("triggerCta")}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-white/50 transition group-hover:border-white/30 group-hover:text-white/80">
                    <ArrowDown className="h-3.5 w-3.5 transition group-hover:translate-y-0.5" strokeWidth={2} aria-hidden />
                  </span>
                </button>
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
                  <div className="mt-7 border-t border-white/[0.08] pt-7">
                    <AnimatePresence mode="wait" initial={false}>
                      {success ? (
                        <motion.div
                          key="success"
                          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.25 }}
                          role="status"
                          className="flex flex-col items-center text-center"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/[0.04]">
                            <Check className="h-4 w-4 text-white/75" strokeWidth={2} aria-hidden />
                          </div>
                          <h3 className="mt-4 text-[1.2rem] font-semibold tracking-tight text-white sm:text-[1.35rem]">
                            {t("success.title")}
                          </h3>
                          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/50 sm:text-[15px]">
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
                          transition={{ duration: reduceMotion ? 0 : 0.22 }}
                          className="mx-auto max-w-md"
                        >
                          <div className={tp5Styles.inlineFields}>
                            <input
                              id={`${baseId}-listing`}
                              type="url"
                              inputMode="url"
                              autoComplete="url"
                              required
                              placeholder={t("form.listingPlaceholder")}
                              aria-label={t("form.listingLabel")}
                              value={listingUrl}
                              onChange={(e) => setListingUrl(e.target.value)}
                              onBlur={() => {
                                if (listingTrim) {
                                  safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
                                }
                              }}
                              className={`${tp5Styles.inlineInput} ${listingTouchedInvalid ? tp5Styles.inlineInputError : ""}`}
                            />
                            {listingTouchedInvalid ? (
                              <p className={tp5Styles.inlineFieldError}>{t("errors.listing")}</p>
                            ) : null}
                            <input
                              id={`${baseId}-email`}
                              type="email"
                              autoComplete="email"
                              required
                              placeholder={t("form.emailPlaceholder")}
                              aria-label={t("form.emailLabel")}
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className={tp5Styles.inlineInput}
                            />
                            <input
                              id={`${baseId}-phone`}
                              type="tel"
                              autoComplete="tel"
                              inputMode="tel"
                              required
                              placeholder={t("form.phonePlaceholder")}
                              aria-label={t("form.phoneLabel")}
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className={tp5Styles.inlineInput}
                            />
                          </div>

                          {formError ? (
                            <div className="mt-3" role="alert">
                              <p className="text-[13px] leading-relaxed text-amber-200/90">{formError}</p>
                              {rateLimited ? (
                                <Link
                                  href={homeHeroCheckoutHref("audits")}
                                  onClick={() => safeTrack("risk_guide_audits_clicked")}
                                  className="mt-3 inline-flex min-h-[40px] items-center gap-2 text-[12px] font-medium uppercase tracking-[0.1em] text-white/55 transition hover:text-white"
                                >
                                  {t("errors.rateLimitedCta")}
                                  <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                                </Link>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="mt-5">
                            <button
                              type="submit"
                              disabled={pending}
                              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/90 transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-50"
                            >
                              {pending ? t("form.submitting") : t("form.submit")}
                              {!pending ? (
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
                              ) : null}
                            </button>
                            <p className="mt-3 text-center text-[12px] leading-relaxed text-white/35">
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
    </section>
  );
}
