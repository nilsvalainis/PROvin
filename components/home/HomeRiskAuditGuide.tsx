"use client";

import { useEffect, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { track } from "@vercel/analytics";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { homeHeroCheckoutHref } from "@/lib/home-hero-plan";
import { isPlausibleListingUrl, isValidOrderEmail } from "@/lib/order-field-validation";

type LocationId = "lv" | "abroad";
type WizardStep = 1 | 2 | 3;

function safeTrack(event: string, data?: Record<string, string | number | boolean>) {
  try {
    track(event, data);
  } catch {
    /* ignore */
  }
}

function ProgressRail({
  active,
  unlockedThrough,
  onJump,
  labels,
  ariaLabel,
  nowLabel,
}: {
  active: WizardStep;
  unlockedThrough: WizardStep;
  onJump: (step: WizardStep) => void;
  labels: [string, string, string];
  ariaLabel: string;
  nowLabel: string;
}) {
  const steps: WizardStep[] = [1, 2, 3];
  return (
    <nav aria-label={ariaLabel} className="mt-7">
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {steps.map((step, i) => {
          const unlocked = step <= unlockedThrough;
          const isActive = step === active;
          const done = unlocked && step < active;
          return (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && onJump(step)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-0.5 py-1 text-left transition disabled:cursor-default ${
                  unlocked ? "cursor-pointer" : "opacity-40"
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold tabular-nums transition sm:h-8 sm:w-8 sm:text-[13px] ${
                    isActive
                      ? "border-[#0066ff] bg-[#0066ff] text-white"
                      : done
                        ? "border-white/35 bg-white/10 text-white"
                        : "border-white/20 bg-transparent text-white/45"
                  }`}
                >
                  {step}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.14em] ${
                      isActive ? "text-white" : done ? "text-white/70" : "text-white/40"
                    }`}
                  >
                    {labels[i]}
                  </span>
                  {isActive ? (
                    <span className="mt-0.5 hidden text-[10px] text-[#7eb0ff] sm:block">
                      ← {nowLabel}
                    </span>
                  ) : null}
                </span>
              </button>
              {i < steps.length - 1 ? (
                <ChevronRight
                  className={`h-4 w-4 shrink-0 ${
                    step < unlockedThrough ? "text-[#0066ff]/80" : "text-white/25"
                  }`}
                  strokeWidth={2}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function HomeRiskAuditGuide() {
  const t = useTranslations("RiskAuditGuide");
  const baseId = useId();
  const [location, setLocation] = useState<LocationId | null>(null);
  const [listingUrl, setListingUrl] = useState("");
  const [step, setStep] = useState<WizardStep>(1);
  const [showFreeForm, setShowFreeForm] = useState(false);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const listingTrim = listingUrl.trim();
  const listingOk = listingTrim.length > 0 && isPlausibleListingUrl(listingTrim);
  const listingTouchedInvalid = listingTrim.length > 0 && !listingOk;
  const recommended: LocationId | null = location;
  const unlockedThrough: WizardStep = location ? 3 : 1;

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

  function onListingBlur() {
    if (listingTrim) {
      safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
    }
  }

  function goStep3() {
    if (listingTouchedInvalid) return;
    if (listingTrim) {
      safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
    }
    setStep(3);
  }

  function openFreeForm() {
    if (!listingOk) return;
    setShowFreeForm(true);
    setFormError(null);
    safeTrack("risk_guide_free_clicked");
  }

  function submitFree(e: FormEvent) {
    e.preventDefault();
    if (!location) return;
    setFormError(null);

    const url = listingUrl.trim();
    const mail = email.trim();
    if (!url || !isPlausibleListingUrl(url)) {
      setFormError(t("errors.listing"));
      return;
    }
    if (!mail || !isValidOrderEmail(mail)) {
      setFormError(t("errors.email"));
      return;
    }

    startTransition(async () => {
      safeTrack("risk_guide_free_submitted");
      try {
        const res = await fetch("/api/listing-peek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: mail, listingUrl: url, location }),
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (res.status === 429) {
          safeTrack("risk_guide_rate_limited");
          if (data?.error === "listing_rate_limited") {
            setFormError(t("errors.listingRateLimited"));
          } else if (data?.error === "ip_rate_limited") {
            setFormError(t("errors.ipRateLimited"));
          } else {
            setFormError(t("errors.rateLimited"));
          }
          return;
        }
        if (!res.ok) {
          if (data?.error === "invalid_listing") setFormError(t("errors.listing"));
          else if (data?.error === "invalid_email") setFormError(t("errors.email"));
          else setFormError(t("errors.generic"));
          return;
        }

        safeTrack("risk_guide_free_success");
        setSuccess(true);
        setShowFreeForm(false);
        setStep(3);
      } catch {
        setFormError(t("errors.generic"));
      }
    });
  }

  function optionRow(opts: {
    title: string;
    price: string;
    body: string;
    recommended?: boolean;
    muted?: boolean;
    action: ReactNode;
  }) {
    return (
      <div
        className={`flex flex-col gap-3 border-b border-white/[0.08] py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8 ${
          opts.recommended ? "border-l-2 border-l-[#0066ff] pl-3 sm:pl-4" : ""
        } ${opts.muted ? "opacity-40" : ""}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-[14px] font-semibold tracking-tight text-white">{opts.title}</p>
            <span className="text-[12px] text-white/45">{opts.price}</span>
            {opts.recommended ? (
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7eb0ff]">
                {t("recommended")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-white/50">{opts.body}</p>
        </div>
        <div className="shrink-0 sm:min-w-[11rem]">{opts.action}</div>
      </div>
    );
  }

  function ctaPrimary(className = "") {
    return `inline-flex min-h-[44px] w-full items-center justify-center border border-[#0066ff]/45 bg-[#0066ff]/15 px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#0066ff]/25 sm:w-full ${className}`;
  }

  function ctaGhost(className = "") {
    return `inline-flex min-h-[44px] w-full items-center justify-center border border-white/15 px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/75 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-full ${className}`;
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

      <div className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] py-10 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-12 lg:px-8 lg:pb-14 lg:pt-12">
        <div className="mx-auto w-full max-w-xl">
          <header className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              {t("eyebrow")}
            </p>
            <h2
              id={`${baseId}-heading`}
              className="mt-2 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.55rem]"
            >
              {t("title")}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-white/55 sm:text-[15px]">
              {t("subtitle")}
            </p>
          </header>

          <ProgressRail
            active={step}
            unlockedThrough={unlockedThrough}
            onJump={setStep}
            labels={[t("progress.step1"), t("progress.step2"), t("progress.step3")]}
            ariaLabel={t("progress.aria")}
            nowLabel={t("progress.now")}
          />

          <div className="mt-8 min-h-[14rem]">
            {step === 1 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7eb0ff]">
                  {t("step1.label")} · {t("progress.now")}
                </p>
                <h3 className="mt-2 text-[1.1rem] font-semibold leading-snug tracking-tight text-white sm:text-[1.25rem]">
                  {t("step1.question")}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">{t("step1.hint")}</p>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] font-medium text-white/50 sm:justify-start">
                  <span>{t("step1.actionCue")}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#0066ff]" strokeWidth={2} aria-hidden />
                </p>
                <div
                  className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label={t("step1.question")}
                >
                  {(
                    [
                      { id: "lv" as const, title: t("step1.lvTitle"), hint: t("step1.lvHint") },
                      {
                        id: "abroad" as const,
                        title: t("step1.abroadTitle"),
                        hint: t("step1.abroadHint"),
                      },
                    ] as const
                  ).map((opt) => {
                    const active = location === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => selectLocation(opt.id)}
                        className={`group flex min-h-[4.5rem] flex-col justify-center border border-white/[0.12] px-4 py-3.5 text-left transition hover:border-[#0066ff]/45 hover:bg-[#0066ff]/[0.08] ${
                          active ? "border-[#0066ff]/55 bg-[#0066ff]/[0.12]" : "bg-transparent"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[15px] font-semibold tracking-tight text-white">
                            {opt.title}
                          </span>
                          <ArrowRight
                            className="h-4 w-4 shrink-0 text-[#0066ff] opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </span>
                        <span className="mt-1 block text-[12px] leading-snug text-white/40">
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7eb0ff]">
                  {t("step2.label")} · {t("progress.now")}
                </p>
                <h3 className="mt-2 text-[1.1rem] font-semibold tracking-tight text-white sm:text-[1.25rem]">
                  {t("step2.title")}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">{t("step2.hint")}</p>
                <label htmlFor={`${baseId}-listing`} className="sr-only">
                  {t("step2.title")}
                </label>
                <input
                  id={`${baseId}-listing`}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder={t("step2.placeholder")}
                  value={listingUrl}
                  onChange={(e) => {
                    setListingUrl(e.target.value);
                    setSuccess(false);
                  }}
                  onBlur={onListingBlur}
                  className="mt-5 w-full border-0 border-b border-white/[0.18] bg-transparent px-0 py-2.5 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-[#0066ff]/70"
                />
                {listingTouchedInvalid ? (
                  <p className="mt-2 text-[12px] text-amber-200/90">{t("errors.listing")}</p>
                ) : null}

                <div className="mt-7 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={goStep3}
                    disabled={listingTouchedInvalid}
                    className="provin-home-pill-cta inline-flex min-h-[50px] w-full items-center justify-center gap-2 px-5 text-[12px] font-semibold uppercase tracking-[0.08em] disabled:opacity-40"
                  >
                    <span>{listingTrim ? t("step2.continue") : t("step2.skip")}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex min-h-[40px] items-center justify-center text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45 transition hover:text-white/75"
                  >
                    {t("step2.back")}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 && location ? (
              <div>
                {success ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7eb0ff]">
                      {t("step3.label")}
                    </p>
                    <h3 className="mt-2 text-[1.1rem] font-semibold tracking-tight text-white sm:text-[1.25rem]">
                      {t("success.title")}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/55">{t("success.body")}</p>
                    <div className="mt-5 flex flex-col gap-2">
                      <Link
                        href={homeHeroCheckoutHref(location === "abroad" ? "audits" : "mini")}
                        onClick={() =>
                          safeTrack(
                            location === "abroad"
                              ? "risk_guide_audits_clicked"
                              : "risk_guide_mini_clicked",
                          )
                        }
                        className={ctaPrimary()}
                      >
                        {location === "abroad" ? t("success.ctaAudits") : t("success.ctaMini")}
                      </Link>
                      <Link
                        href={homeHeroCheckoutHref(location === "abroad" ? "mini" : "audits")}
                        onClick={() =>
                          safeTrack(
                            location === "abroad"
                              ? "risk_guide_mini_clicked"
                              : "risk_guide_audits_clicked",
                          )
                        }
                        className={ctaGhost()}
                      >
                        {location === "abroad" ? t("success.ctaMini") : t("success.ctaAudits")}
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7eb0ff]">
                          {t("step3.label")} · {t("progress.now")}
                        </p>
                        <h3 className="mt-2 text-[1.1rem] font-semibold tracking-tight text-white sm:text-[1.25rem]">
                          {t("step3.title")}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowFreeForm(false);
                          setStep(2);
                        }}
                        className="shrink-0 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:text-white/70"
                      >
                        {t("step3.back")}
                      </button>
                    </div>

                    <div className="mt-4 border-t border-white/[0.1]">
                      {optionRow({
                        title: t("options.free.title"),
                        price: t("options.free.price"),
                        body: listingOk ? t("options.free.body") : t("options.free.needUrl"),
                        muted: !listingOk,
                        action: (
                          <button
                            type="button"
                            disabled={!listingOk}
                            onClick={openFreeForm}
                            className={ctaGhost()}
                          >
                            {t("options.free.cta")}
                          </button>
                        ),
                      })}

                      {optionRow({
                        title: t("options.mini.title"),
                        price: t("options.mini.price"),
                        body: t("options.mini.body"),
                        recommended: recommended === "lv",
                        action: (
                          <Link
                            href={homeHeroCheckoutHref("mini")}
                            onClick={() => safeTrack("risk_guide_mini_clicked")}
                            className={recommended === "lv" ? ctaPrimary() : ctaGhost()}
                          >
                            {t("options.mini.cta")}
                          </Link>
                        ),
                      })}

                      {optionRow({
                        title: t("options.audits.title"),
                        price: t("options.audits.price"),
                        body: t("options.audits.body"),
                        recommended: recommended === "abroad",
                        action: (
                          <Link
                            href={homeHeroCheckoutHref("audits")}
                            onClick={() => safeTrack("risk_guide_audits_clicked")}
                            className={recommended === "abroad" ? ctaPrimary() : ctaGhost()}
                          >
                            {t("options.audits.cta")}
                          </Link>
                        ),
                      })}
                    </div>

                    <p className="mt-5 text-[12px] text-white/40">
                      {t("dealer.prefix")}{" "}
                      <Link
                        href={homeHeroCheckoutHref("dealer")}
                        className="text-white/65 underline decoration-white/25 underline-offset-2 transition hover:text-white hover:decoration-white/50"
                      >
                        {t("dealer.link")}
                      </Link>
                    </p>

                    {showFreeForm ? (
                      <form
                        onSubmit={submitFree}
                        className="mt-6 space-y-4 border-t border-white/[0.1] pt-5"
                      >
                        <p className="text-[13px] leading-relaxed text-white/50">{t("form.boundary")}</p>
                        <div>
                          <label
                            htmlFor={`${baseId}-form-listing`}
                            className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
                          >
                            {t("form.listingLabel")}
                          </label>
                          <input
                            id={`${baseId}-form-listing`}
                            type="url"
                            required
                            value={listingUrl}
                            onChange={(e) => setListingUrl(e.target.value)}
                            className="mt-1.5 w-full border-0 border-b border-white/[0.18] bg-transparent px-0 py-2.5 text-[15px] text-white outline-none focus:border-[#0066ff]/70"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`${baseId}-form-email`}
                            className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
                          >
                            {t("form.emailLabel")}
                          </label>
                          <input
                            id={`${baseId}-form-email`}
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1.5 w-full border-0 border-b border-white/[0.18] bg-transparent px-0 py-2.5 text-[15px] text-white outline-none focus:border-[#0066ff]/70"
                          />
                        </div>
                        {formError ? (
                          <p className="text-[13px] text-amber-200/90" role="alert">
                            {formError}
                          </p>
                        ) : null}
                        <button
                          type="submit"
                          disabled={pending}
                          className="provin-home-pill-cta inline-flex min-h-[48px] w-full items-center justify-center px-5 text-[12px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
                        >
                          {pending ? t("form.submitting") : t("form.submit")}
                        </button>
                      </form>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
