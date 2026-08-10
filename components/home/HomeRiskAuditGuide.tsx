"use client";

import { useEffect, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { track } from "@vercel/analytics";
import { useTranslations } from "next-intl";
import tp5Styles from "@/app/test-pricing-5/test-pricing-5.module.css";
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
  const progressPct = (step / 3) * 100;

  const progressLabels = [t("progress.step1"), t("progress.step2"), t("progress.step3")] as const;

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
        <span className={tp5Styles.liquidCtaLabel}>{children}</span>
      </button>
    );
  }

  function LiquidLink({ href, onClick, children }: { href: string; onClick?: () => void; children: ReactNode }) {
    return (
      <Link href={href} onClick={onClick} className={tp5Styles.liquidCtaLink}>
        <span className={tp5Styles.liquidCtaShimmer} aria-hidden />
        <span className={tp5Styles.liquidCtaLabel}>{children}</span>
      </Link>
    );
  }

  function GhostBtn({
    children,
    onClick,
    disabled,
    className = "",
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/80 transition hover:border-white/30 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
      >
        {children}
      </button>
    );
  }

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
      <Link
        href={href}
        onClick={onClick}
        className="inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-white/80 transition hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
      >
        {children}
      </Link>
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
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-16">
          <header className="lg:col-span-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
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

          <div className="lg:col-span-7" aria-label={t("progress.aria")}>
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-[#0066ff] transition-[width] duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <ol className="mt-3 grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((n) => {
                const unlocked = n <= unlockedThrough;
                const active = n === step;
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
                        className={`block text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          active ? "text-white" : unlocked ? "text-white/45" : "text-white/30"
                        }`}
                      >
                        {n} · {progressLabels[n - 1]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div className="mt-10 lg:mt-14">
          {step === 1 ? (
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-16 lg:items-center">
              <div className="lg:col-span-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {t("step1.label")} / 3
                </p>
                <h3 className="mt-3 text-balance text-[1.35rem] font-semibold leading-[1.2] tracking-tight text-white sm:text-[1.65rem] lg:text-[1.85rem]">
                  {t("step1.question")}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-white/45 sm:text-[15px]">
                  {t("step1.hint")}
                </p>
              </div>

              <div
                className="grid gap-3 sm:grid-cols-2 lg:col-span-7"
                role="radiogroup"
                aria-label={t("step1.question")}
              >
                {(
                  [
                    { id: "lv" as const, title: t("step1.lvTitle") },
                    { id: "abroad" as const, title: t("step1.abroadTitle") },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={location === opt.id}
                    onClick={() => selectLocation(opt.id)}
                    className="group relative flex min-h-[7.5rem] flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.1] bg-[rgb(3_4_6/0.55)] px-5 py-5 text-left shadow-[0_20px_52px_rgb(0_0_0/0.35)] backdrop-blur-md transition duration-300 hover:border-[#0066ff]/40 hover:bg-[#0066ff]/[0.09] sm:min-h-[8.5rem] sm:px-6 sm:py-6"
                  >
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0066ff]/50 to-transparent opacity-0 transition group-hover:opacity-100" />
                    <span className="text-[1.05rem] font-semibold tracking-tight text-white sm:text-[1.2rem]">
                      {opt.title}
                    </span>
                    <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7eb0ff]">
                      {t("progress.step2")}
                      <ArrowRight
                        className="h-3.5 w-3.5 transition duration-300 group-hover:translate-x-1"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-16">
              <div className="lg:col-span-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {t("step2.label")} / 3
                </p>
                <h3 className="mt-3 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.65rem]">
                  {t("step2.title")}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-white/45 sm:text-[15px]">
                  {t("step2.hint")}
                </p>
              </div>

              <div className="lg:col-span-7">
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
                  className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] px-5 py-4 text-[16px] text-white placeholder:text-white/30 outline-none backdrop-blur-md transition focus:border-[#0066ff]/50 focus:ring-1 focus:ring-[#0066ff]/25"
                />
                {listingTouchedInvalid ? (
                  <p className="mt-2 text-[13px] text-amber-200/90">{t("errors.listing")}</p>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 sm:max-w-xs">
                    <LiquidBtn onClick={goStep3} disabled={listingTouchedInvalid}>
                      {listingTrim ? t("step2.continue") : t("step2.skip")}
                    </LiquidBtn>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex min-h-[44px] items-center justify-center px-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:text-white/70"
                  >
                    {t("step2.back")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 && location ? (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    {t("step3.label")} / 3
                  </p>
                  <h3 className="mt-3 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.65rem]">
                    {success ? t("success.title") : t("step3.title")}
                  </h3>
                  {success ? (
                    <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/50 sm:text-[15px]">
                      {t("success.body")}
                    </p>
                  ) : null}
                </div>
                {!success ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowFreeForm(false);
                      setStep(2);
                    }}
                    className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/40 transition hover:text-white/70"
                  >
                    {t("step3.back")}
                  </button>
                ) : null}
              </div>

              {success ? (
                <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:max-w-2xl">
                  <LiquidLink
                    href={homeHeroCheckoutHref(location === "abroad" ? "audits" : "mini")}
                    onClick={() =>
                      safeTrack(
                        location === "abroad" ? "risk_guide_audits_clicked" : "risk_guide_mini_clicked",
                      )
                    }
                  >
                    {location === "abroad" ? t("success.ctaAudits") : t("success.ctaMini")}
                  </LiquidLink>
                  <GhostLink
                    href={homeHeroCheckoutHref(location === "abroad" ? "mini" : "audits")}
                    onClick={() =>
                      safeTrack(
                        location === "abroad" ? "risk_guide_mini_clicked" : "risk_guide_audits_clicked",
                      )
                    }
                  >
                    {location === "abroad" ? t("success.ctaMini") : t("success.ctaAudits")}
                  </GhostLink>
                </div>
              ) : (
                <div className="mt-8 space-y-3">
                  {(
                    [
                      {
                        key: "free",
                        title: t("options.free.title"),
                        price: t("options.free.price"),
                        body: listingOk ? t("options.free.body") : t("options.free.needUrl"),
                        muted: !listingOk,
                        recommended: false,
                        action: (
                          <GhostBtn disabled={!listingOk} onClick={openFreeForm}>
                            {t("options.free.cta")}
                          </GhostBtn>
                        ),
                      },
                      {
                        key: "mini",
                        title: t("options.mini.title"),
                        price: t("options.mini.price"),
                        body: t("options.mini.body"),
                        muted: false,
                        recommended: recommended === "lv",
                        action:
                          recommended === "lv" ? (
                            <LiquidLink
                              href={homeHeroCheckoutHref("mini")}
                              onClick={() => safeTrack("risk_guide_mini_clicked")}
                            >
                              {t("options.mini.cta")}
                            </LiquidLink>
                          ) : (
                            <GhostLink
                              href={homeHeroCheckoutHref("mini")}
                              onClick={() => safeTrack("risk_guide_mini_clicked")}
                            >
                              {t("options.mini.cta")}
                            </GhostLink>
                          ),
                      },
                      {
                        key: "audits",
                        title: t("options.audits.title"),
                        price: t("options.audits.price"),
                        body: t("options.audits.body"),
                        muted: false,
                        recommended: recommended === "abroad",
                        action:
                          recommended === "abroad" ? (
                            <LiquidLink
                              href={homeHeroCheckoutHref("audits")}
                              onClick={() => safeTrack("risk_guide_audits_clicked")}
                            >
                              {t("options.audits.cta")}
                            </LiquidLink>
                          ) : (
                            <GhostLink
                              href={homeHeroCheckoutHref("audits")}
                              onClick={() => safeTrack("risk_guide_audits_clicked")}
                            >
                              {t("options.audits.cta")}
                            </GhostLink>
                          ),
                      },
                    ] as const
                  ).map((row) => (
                    <div
                      key={row.key}
                      className={`grid gap-4 rounded-2xl border px-5 py-5 transition sm:grid-cols-[1fr_minmax(11rem,14rem)] sm:items-center sm:gap-8 sm:px-6 ${
                        row.recommended
                          ? "border-[#0066ff]/40 bg-[#0066ff]/[0.08] shadow-[0_20px_52px_rgb(0_0_0/0.28)]"
                          : "border-white/[0.08] bg-white/[0.02]"
                      } ${row.muted ? "opacity-45" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <p className="text-[15px] font-semibold tracking-tight text-white sm:text-[16px]">
                            {row.title}
                          </p>
                          <span className="text-[13px] text-white/45">{row.price}</span>
                          {row.recommended ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7eb0ff]">
                              {t("recommended")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-white/50 sm:text-[14px]">
                          {row.body}
                        </p>
                      </div>
                      <div className="min-w-0">{row.action}</div>
                    </div>
                  ))}

                  <p className="pt-2 text-[13px] text-white/40">
                    {t("dealer.prefix")}{" "}
                    <Link
                      href={homeHeroCheckoutHref("dealer")}
                      className="text-white/70 underline decoration-white/25 underline-offset-2 transition hover:text-white hover:decoration-white/50"
                    >
                      {t("dealer.link")}
                    </Link>
                  </p>

                  {showFreeForm ? (
                    <form
                      onSubmit={submitFree}
                      className="mt-2 space-y-4 rounded-2xl border border-white/[0.1] bg-white/[0.03] px-5 py-5 sm:px-6"
                    >
                      <p className="text-[14px] leading-relaxed text-white/55">{t("form.boundary")}</p>
                      <div className="grid gap-4 sm:grid-cols-2">
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
                            className="mt-2 w-full rounded-xl border border-white/[0.12] bg-transparent px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#0066ff]/50"
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
                            className="mt-2 w-full rounded-xl border border-white/[0.12] bg-transparent px-3.5 py-3 text-[15px] text-white outline-none focus:border-[#0066ff]/50"
                          />
                        </div>
                      </div>
                      {formError ? (
                        <p className="text-[13px] text-amber-200/90" role="alert">
                          {formError}
                        </p>
                      ) : null}
                      <div className="max-w-xs">
                        <LiquidBtn type="submit" disabled={pending}>
                          {pending ? t("form.submitting") : t("form.submit")}
                        </LiquidBtn>
                      </div>
                    </form>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
