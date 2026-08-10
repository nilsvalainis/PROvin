"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { track } from "@vercel/analytics";
import { useTranslations } from "next-intl";
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

  const inputClass =
    "mt-2 w-full border-0 border-b border-white/[0.14] bg-transparent px-0 py-3 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-white/45";

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
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            {t("eyebrow")}
          </p>
          <h2
            id={`${baseId}-heading`}
            className="mt-2 text-balance text-[1.65rem] font-semibold tracking-tight text-white sm:text-[2rem] lg:text-[2.15rem]"
          >
            {t("title")}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/50 sm:text-[16px]">{t("subtitle")}</p>

          {!success ? (
            <button
              type="button"
              onClick={openForm}
              aria-expanded={expanded}
              className="group mt-7 inline-flex min-h-[44px] items-center gap-2 border-b border-white/25 pb-1 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/80 transition hover:border-white/55 hover:text-white"
            >
              {t("triggerCta")}
              <ArrowDown
                className={`h-3.5 w-3.5 shrink-0 text-white/45 transition duration-300 group-hover:text-white/80 ${expanded ? "rotate-180" : ""}`}
                strokeWidth={2}
                aria-hidden
              />
            </button>
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
                    : { height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.25 } }
                }
                className="overflow-hidden"
              >
                <div className="pt-8">
                  <AnimatePresence mode="wait" initial={false}>
                    {success ? (
                      <motion.div
                        key="success"
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.25 }}
                        role="status"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20">
                          <Check className="h-4 w-4 text-white/70" strokeWidth={2} aria-hidden />
                        </div>
                        <h3 className="mt-4 text-[1.25rem] font-semibold tracking-tight text-white sm:text-[1.4rem]">
                          {t("success.title")}
                        </h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-white/50">{t("success.body")}</p>
                      </motion.div>
                    ) : (
                      <motion.form
                        key="form"
                        onSubmit={submitFree}
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.22 }}
                        className="space-y-5"
                      >
                        <div>
                          <label
                            htmlFor={`${baseId}-listing`}
                            className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/35"
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

                        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
                          <div>
                            <label
                              htmlFor={`${baseId}-email`}
                              className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/35"
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
                              className="block text-[11px] font-medium uppercase tracking-[0.14em] text-white/35"
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
                                className="mt-3 inline-flex min-h-[40px] items-center gap-2 text-[12px] font-medium uppercase tracking-[0.1em] text-white/55 transition hover:text-white"
                              >
                                {t("errors.rateLimitedCta")}
                                <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                              </Link>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="pt-1">
                          <button
                            type="submit"
                            disabled={pending}
                            className="inline-flex min-h-[44px] items-center gap-2 border border-white/20 bg-transparent px-5 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/85 transition hover:border-white/40 hover:bg-white/[0.04] hover:text-white disabled:cursor-wait disabled:opacity-50"
                          >
                            {pending ? t("form.submitting") : t("form.submit")}
                            {!pending ? (
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
                            ) : null}
                          </button>
                          <p className="mt-4 text-[12px] leading-relaxed text-white/35">{t("form.disclaimer")}</p>
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
