"use client";

import { useEffect, useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
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
  interactive,
}: {
  active: WizardStep;
  unlockedThrough: WizardStep;
  onJump?: (step: WizardStep) => void;
  labels: [string, string, string];
  ariaLabel: string;
  interactive: boolean;
}) {
  const steps: WizardStep[] = [1, 2, 3];
  return (
    <nav aria-label={ariaLabel} className="mt-6">
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {steps.map((step, i) => {
          const unlocked = step <= unlockedThrough;
          const isActive = step === active;
          const lineClass = `h-px w-full transition ${
            isActive
              ? "bg-[#0066ff]"
              : unlocked
                ? "bg-white/35"
                : "bg-white/15"
          }`;
          const labelClass = `text-[10px] font-semibold uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.16em] ${
            isActive ? "text-white" : unlocked ? "text-white/50" : "text-white/30"
          }`;
          const wrapClass = `flex w-full flex-col items-start gap-1.5 text-left ${
            unlocked ? "" : "opacity-35"
          }`;

          return (
            <li key={step} className="min-w-0">
              {interactive ? (
                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && onJump?.(step)}
                  className={`group ${wrapClass} transition disabled:cursor-default ${
                    unlocked ? "cursor-pointer" : ""
                  }`}
                >
                  <span
                    className={`${lineClass} ${unlocked && !isActive ? "group-hover:bg-white/55" : ""}`}
                    aria-hidden
                  />
                  <span className={labelClass}>
                    {step}. {labels[i]}
                  </span>
                </button>
              ) : (
                <div className={wrapClass} aria-current={isActive ? "step" : undefined}>
                  <span className={lineClass} aria-hidden />
                  <span className={labelClass}>
                    {step}. {labels[i]}
                  </span>
                </div>
              )}
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
  const [mobileStep, setMobileStep] = useState<WizardStep>(1);
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
  const desktopActive: WizardStep = !location ? 1 : success || showFreeForm ? 3 : 2;

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
    setMobileStep(2);
    safeTrack("risk_guide_location_selected", { location: next });
  }

  function onListingBlur() {
    if (listingTrim) {
      safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
    }
  }

  function goMobileStep3() {
    if (listingTouchedInvalid) return;
    if (listingTrim) {
      safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
    }
    setMobileStep(3);
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
          setFormError(t("errors.rateLimited"));
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
        setMobileStep(3);
      } catch {
        setFormError(t("errors.generic"));
      }
    });
  }

  function renderStep1Body() {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {t("step1.label")}
        </p>
        <h3 className="mt-2 text-[1.05rem] font-semibold leading-snug tracking-tight text-white sm:text-[1.15rem]">
          {t("step1.question")}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">{t("step1.hint")}</p>
        <div
          className="mt-5 grid grid-cols-1 gap-0 border-t border-white/[0.1] sm:grid-cols-2"
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
          ).map((opt, idx) => {
            const active = location === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectLocation(opt.id)}
                className={`min-h-[3.5rem] border-b border-white/[0.1] px-0 py-3.5 text-left transition sm:px-4 ${
                  idx === 0 ? "sm:border-r sm:border-white/[0.1]" : ""
                } ${
                  active
                    ? "text-white"
                    : "text-white/65 hover:text-white"
                }`}
              >
                <span
                  className={`block text-[14px] font-semibold tracking-tight ${
                    active ? "text-white" : ""
                  }`}
                >
                  {opt.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-white/40">{opt.hint}</span>
                <span
                  className={`mt-2 block h-px w-10 transition ${
                    active ? "bg-[#0066ff]" : "bg-transparent"
                  }`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderStep2Body(opts: { showNav: boolean }) {
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {t("step2.label")}
        </p>
        <h3 className="mt-2 text-[1.05rem] font-semibold tracking-tight text-white sm:text-[1.15rem]">
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
          className="mt-4 w-full border-0 border-b border-white/[0.18] bg-transparent px-0 py-2.5 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-[#0066ff]/70"
        />
        {listingTouchedInvalid ? (
          <p className="mt-2 text-[12px] text-amber-200/90">{t("errors.listing")}</p>
        ) : null}

        {opts.showNav ? (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={goMobileStep3}
              disabled={listingTouchedInvalid}
              className="provin-home-pill-cta inline-flex min-h-[48px] w-full items-center justify-center px-5 text-[12px] font-semibold uppercase tracking-[0.08em] disabled:opacity-40 sm:w-auto"
            >
              {listingTrim ? t("step2.continue") : t("step2.skip")}
            </button>
            <button
              type="button"
              onClick={() => setMobileStep(1)}
              className="inline-flex min-h-[44px] items-center justify-center px-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45 transition hover:text-white/75"
            >
              {t("step2.back")}
            </button>
          </div>
        ) : null}
      </div>
    );
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

  function renderStep3Body(opts: { showBack: boolean; locked: boolean }) {
    if (opts.locked || !location) {
      return (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {t("step3.label")}
          </p>
          <h3 className="mt-2 text-[1.05rem] font-semibold tracking-tight text-white/50 sm:text-[1.15rem]">
            {t("step3.title")}
          </h3>
          <p className="mt-3 text-[13px] leading-relaxed text-white/35">{t("step3.locked")}</p>
        </div>
      );
    }

    if (success) {
      return (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {t("step3.label")}
          </p>
          <h3 className="mt-2 text-[1.05rem] font-semibold tracking-tight text-white sm:text-[1.15rem]">
            {t("success.title")}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">{t("success.body")}</p>
          <div className="mt-5 flex flex-col gap-2 sm:max-w-md">
            <Link
              href={homeHeroCheckoutHref(location === "abroad" ? "audits" : "mini")}
              onClick={() =>
                safeTrack(
                  location === "abroad" ? "risk_guide_audits_clicked" : "risk_guide_mini_clicked",
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
                  location === "abroad" ? "risk_guide_mini_clicked" : "risk_guide_audits_clicked",
                )
              }
              className={ctaGhost()}
            >
              {location === "abroad" ? t("success.ctaMini") : t("success.ctaAudits")}
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {t("step3.label")}
            </p>
            <h3 className="mt-2 text-[1.05rem] font-semibold tracking-tight text-white sm:text-[1.15rem]">
              {t("step3.title")}
            </h3>
          </div>
          {opts.showBack ? (
            <button
              type="button"
              onClick={() => {
                setShowFreeForm(false);
                setMobileStep(2);
              }}
              className="shrink-0 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40 transition hover:text-white/70"
            >
              {t("step3.back")}
            </button>
          ) : null}
        </div>

        <div className="mt-2 border-t border-white/[0.1]">
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
          <form onSubmit={submitFree} className="mt-6 space-y-4 border-t border-white/[0.1] pt-5">
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
              className="provin-home-pill-cta inline-flex min-h-[48px] w-full items-center justify-center px-5 text-[12px] font-semibold uppercase tracking-[0.08em] disabled:opacity-50 sm:w-auto"
            >
              {pending ? t("form.submitting") : t("form.submit")}
            </button>
          </form>
        ) : null}
      </div>
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

      <div className="mx-auto w-full max-w-[80rem] px-[max(1rem,env(safe-area-inset-left,0px))] py-10 pr-[max(1rem,env(safe-area-inset-right,0px))] sm:py-12 lg:px-8 lg:pb-14 lg:pt-12">
        <header className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-2xl lg:text-left">
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

        {/* Mobile: wizard A — one step at a time */}
        <div className="mx-auto mt-6 max-w-xl lg:hidden">
          <ProgressRail
            active={mobileStep}
            unlockedThrough={unlockedThrough}
            onJump={setMobileStep}
            interactive
            labels={[t("progress.step1"), t("progress.step2"), t("progress.step3")]}
            ariaLabel={t("progress.aria")}
          />
          <div className="mt-8">
            {mobileStep === 1 ? renderStep1Body() : null}
            {mobileStep === 2 ? renderStep2Body({ showNav: true }) : null}
            {mobileStep === 3 ? renderStep3Body({ showBack: true, locked: !location }) : null}
          </div>
        </div>

        {/* Desktop: stacked B — next steps visible but locked */}
        <div className="mt-8 hidden lg:block">
          <ProgressRail
            active={desktopActive}
            unlockedThrough={unlockedThrough}
            interactive={false}
            labels={[t("progress.step1"), t("progress.step2"), t("progress.step3")]}
            ariaLabel={t("progress.aria")}
          />

          <div className="mt-10 grid grid-cols-12 gap-12">
            <div className="col-span-5 space-y-10">
              {renderStep1Body()}
              <div className={location ? "" : "pointer-events-none opacity-35"}>
                {renderStep2Body({ showNav: false })}
              </div>
            </div>
            <div className={`col-span-7 ${location ? "" : "opacity-45"}`}>
              {renderStep3Body({ showBack: false, locked: !location })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
