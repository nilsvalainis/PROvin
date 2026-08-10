"use client";

import { useEffect, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

type LocationId = "lv" | "abroad";
type WizardStep = 1 | 2;

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
  const [location, setLocation] = useState<LocationId | null>(null);
  const [listingUrl, setListingUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<WizardStep>(1);
  const [showFreeForm, setShowFreeForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const listingTrim = listingUrl.trim();
  const listingOk = listingTrim.length > 0 && isPlausibleListingUrl(listingTrim);
  const listingTouchedInvalid = listingTrim.length > 0 && !listingOk;
  const unlockedThrough: WizardStep = location ? 2 : 1;
  const progressPct = success ? 100 : (step / 2) * 100;
  const progressLabels = [t("progress.step1"), t("progress.step2")] as const;

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

  function selectLocation(next: LocationId) {
    setLocation(next);
    setSuccess(false);
    setFormError(null);
    setShowFreeForm(false);
    setStep(2);
    safeTrack("risk_guide_location_selected", { location: next });
  }

  function openFreeForm() {
    setShowFreeForm(true);
    setFormError(null);
    safeTrack("risk_guide_free_clicked");
  }

  function goBackToStep1() {
    setShowFreeForm(false);
    setFormError(null);
    setStep(1);
  }

  function submitFree(e: FormEvent) {
    e.preventDefault();
    if (!location) return;
    setFormError(null);

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
          body: JSON.stringify({ email: mail, phone: tel, listingUrl: url, location }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;

        if (res.status === 429) {
          safeTrack("risk_guide_rate_limited");
          if (data?.error === "listing_rate_limited") setFormError(t("errors.listingRateLimited"));
          else if (data?.error === "ip_rate_limited") setFormError(t("errors.ipRateLimited"));
          else setFormError(t("errors.rateLimited"));
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
        setShowFreeForm(false);
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

  function LiquidLink({
    href,
    onClick,
    children,
  }: {
    href: string;
    onClick?: () => void;
    children: ReactNode;
  }) {
    return (
      <Link href={href} onClick={onClick} className={tp5Styles.liquidCtaLink}>
        <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
        <span className={`${tp5Styles.liquidCtaLabel} inline-flex items-center justify-center gap-2`}>
          {children}
        </span>
      </Link>
    );
  }

  const ghostCtaClass =
    "inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white shadow-[0_8px_24px_rgb(0_0_0/0.25)] transition hover:border-white/40 hover:bg-white/[0.09] active:scale-[0.98]";

  function GhostLink({
    href,
    onClick,
    children,
  }: {
    href: string;
    onClick?: () => void;
    children: ReactNode;
  }) {
    return (
      <Link href={href} onClick={onClick} className={ghostCtaClass}>
        {children}
      </Link>
    );
  }

  function GhostBtn({
    onClick,
    children,
  }: {
    onClick?: () => void;
    children: ReactNode;
  }) {
    return (
      <button type="button" onClick={onClick} className={ghostCtaClass}>
        {children}
      </button>
    );
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
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-16">
          <header className="lg:col-span-5 lg:sticky lg:top-24">
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
            <div aria-label={t("progress.aria")}>
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[#0066ff] transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <ol className="mt-3 grid grid-cols-2 gap-2">
                {([1, 2] as const).map((n) => {
                  const unlocked = n <= unlockedThrough;
                  const active = n === step && !success;
                  return (
                    <li key={n}>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => unlocked && setStep(n)}
                        className={`w-full text-left transition disabled:cursor-default ${
                          unlocked ? "cursor-pointer" : "opacity-35"
                        }`}
                        aria-current={active ? "step" : undefined}
                      >
                        <span
                          className={`block text-[12px] font-semibold uppercase tracking-[0.14em] sm:text-[13px] ${
                            active ? "text-white" : unlocked ? "text-white/45" : "text-white/30"
                          }`}
                        >
                          {progressLabels[n - 1]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="mt-8 border-t border-white/[0.08] pt-8 lg:mt-10 lg:pt-10">
              {step === 1 ? (
                <div>
                  <h3 className="text-balance text-[1.55rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[1.85rem] lg:text-[2.05rem]">
                    {t("step1.question")}
                  </h3>

                  <div
                    className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4"
                    role="radiogroup"
                    aria-label={t("step1.question")}
                  >
                    {(
                      [
                        { id: "abroad" as const, title: t("step1.abroadTitle") },
                        { id: "lv" as const, title: t("step1.lvTitle") },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={location === opt.id}
                        onClick={() => selectLocation(opt.id)}
                        className="group flex min-h-[5.5rem] items-center justify-between gap-4 rounded-2xl border border-white/[0.14] bg-white/[0.03] px-5 py-5 text-left transition duration-200 hover:border-[#0066ff]/45 hover:bg-[#0066ff]/[0.08] active:scale-[0.99] sm:min-h-[6.25rem] sm:px-6 sm:py-6"
                      >
                        <span className="text-[1.2rem] font-semibold tracking-tight text-white sm:text-[1.35rem]">
                          {opt.title}
                        </span>
                        <ArrowRight
                          className="h-5 w-5 shrink-0 text-white/35 transition duration-200 group-hover:translate-x-0.5 group-hover:text-[#7eb0ff]"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 2 && location ? (
                <div>
                  {!success ? (
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={goBackToStep1}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/80 transition hover:border-white/35 hover:bg-white/[0.08] hover:text-white"
                      >
                        <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                        {t("step2.back")}
                      </button>
                      <button
                        type="button"
                        onClick={goBackToStep1}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.1] px-3.5 text-[12px] text-white/55 transition hover:border-white/25 hover:text-white/80"
                      >
                        <span className="font-medium text-white/80">
                          {location === "lv" ? t("step1.lvTitle") : t("step1.abroadTitle")}
                        </span>
                        <span className="text-white/30">·</span>
                        <span className="font-semibold uppercase tracking-[0.08em] text-[#7eb0ff]">
                          {t("step2.changeChoice")}
                        </span>
                      </button>
                    </div>
                  ) : null}

                  <h3 className="text-balance text-[1.55rem] font-semibold leading-[1.15] tracking-tight text-white sm:text-[1.85rem] lg:text-[2.05rem]">
                    {success ? t("success.title") : t("step2.title")}
                  </h3>
                  <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/50 sm:text-[16px] lg:text-[17px]">
                    {success ? t("success.body") : t("step2.hint")}
                  </p>

                  {success ? (
                    <div className="mt-8 flex max-w-md flex-col gap-3">
                      <LiquidLink
                        href={homeHeroCheckoutHref("audits")}
                        onClick={() => safeTrack("risk_guide_audits_clicked")}
                      >
                        {t("success.ctaAudits")}
                        <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      </LiquidLink>
                      <Link
                        href={homeHeroCheckoutHref("mini")}
                        onClick={() => safeTrack("risk_guide_mini_clicked")}
                        className="inline-flex min-h-[44px] w-full items-center justify-center text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45 transition hover:text-white/75"
                      >
                        {t("success.ctaMini")}
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {step === 2 && location && !success ? (
          <div className="mt-8 lg:mt-10">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              <div className="order-2 flex flex-col rounded-2xl border border-white/[0.1] bg-[rgb(3_4_6/0.45)] px-5 py-6 backdrop-blur-md sm:px-6 sm:py-7 md:order-1">
                <h4 className="text-[1.1rem] font-semibold tracking-tight text-white sm:text-[1.2rem]">
                  {t("form.title")}
                </h4>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-white/50 sm:text-[15px]">
                  {t("form.boundary")}
                </p>
                <div className="mt-7">
                  <GhostBtn onClick={openFreeForm}>
                    {t("step2.freeCta")}
                    <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  </GhostBtn>
                </div>
              </div>

              <div className="order-1 flex flex-col rounded-2xl border border-[#0066ff]/45 bg-[#0066ff]/[0.1] px-5 py-6 shadow-[0_20px_52px_rgb(0_0_0/0.28)] sm:px-6 sm:py-7 md:order-2 md:-translate-y-1">
                <span className="inline-flex w-fit rounded border border-[#0066ff]/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7eb0ff]">
                  {t("recommended")}
                </span>
                <h4 className="mt-3 text-[1.1rem] font-semibold tracking-tight text-white sm:text-[1.2rem]">
                  {t("step2.auditsTitle")}
                </h4>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-white/60 sm:text-[15px]">
                  {t("step2.auditsBody")}
                </p>
                <div className="mt-7">
                  <LiquidLink
                    href={homeHeroCheckoutHref("audits")}
                    onClick={() => safeTrack("risk_guide_audits_clicked")}
                  >
                    {t("step2.auditsCta")}
                    <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  </LiquidLink>
                </div>
              </div>

              <div className="order-3 flex flex-col rounded-2xl border border-white/[0.1] bg-[rgb(3_4_6/0.45)] px-5 py-6 backdrop-blur-md sm:px-6 sm:py-7">
                <h4 className="text-[1.1rem] font-semibold tracking-tight text-white sm:text-[1.2rem]">
                  {t("step2.miniTitle")}
                </h4>
                <p className="mt-2 text-[14px] leading-relaxed text-white/50 sm:text-[15px]">
                  {t("step2.miniBody")}
                </p>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-amber-200/70">
                  ⚠️ {t("step2.miniWarning")}
                </p>
                <div className="mt-7">
                  <GhostLink
                    href={homeHeroCheckoutHref("mini")}
                    onClick={() => safeTrack("risk_guide_mini_clicked")}
                  >
                    {t("step2.miniCta")}
                    <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  </GhostLink>
                </div>
              </div>
            </div>

            {showFreeForm ? (
              <form
                onSubmit={submitFree}
                className="mt-4 space-y-4 rounded-2xl border border-white/[0.1] bg-white/[0.03] px-5 py-5 sm:px-6 sm:py-6 lg:px-8"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-white">{t("form.title")}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/45">{t("form.boundary")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFreeForm(false);
                      setFormError(null);
                    }}
                    className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:text-white/70"
                  >
                    {t("form.cancel")}
                  </button>
                </div>
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
                    placeholder={t("step2.placeholder")}
                    value={listingUrl}
                    onChange={(e) => setListingUrl(e.target.value)}
                    onBlur={() => {
                      if (listingTrim) {
                        safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
                      }
                    }}
                    className="mt-2 w-full rounded-xl border border-white/[0.12] bg-black/20 px-4 py-3.5 text-[15px] text-white placeholder:text-white/30 outline-none focus:border-[#0066ff]/50"
                  />
                  {listingTouchedInvalid ? (
                    <p className="mt-2 text-[13px] text-amber-200/90">{t("errors.listing")}</p>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/[0.12] bg-black/20 px-4 py-3.5 text-[15px] text-white outline-none focus:border-[#0066ff]/50"
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
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/[0.12] bg-black/20 px-4 py-3.5 text-[15px] text-white outline-none focus:border-[#0066ff]/50"
                    />
                  </div>
                </div>
                {formError ? (
                  <p className="text-[13px] text-amber-200/90" role="alert">
                    {formError}
                  </p>
                ) : null}
                <div className="max-w-sm">
                  <LiquidBtn type="submit" disabled={pending}>
                    {pending ? t("form.submitting") : t("form.submit")}
                    {!pending ? (
                      <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    ) : null}
                  </LiquidBtn>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
