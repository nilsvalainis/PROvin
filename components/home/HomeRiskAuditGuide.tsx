"use client";

import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { track } from "@vercel/analytics";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { homeHeroCheckoutHref } from "@/lib/home-hero-plan";
import { isPlausibleListingUrl, isValidOrderEmail } from "@/lib/order-field-validation";

type LocationId = "lv" | "abroad";

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
  const [showFreeForm, setShowFreeForm] = useState(false);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const listingTrim = listingUrl.trim();
  const listingOk = listingTrim.length > 0 && isPlausibleListingUrl(listingTrim);
  const listingTouchedInvalid = listingTrim.length > 0 && !listingOk;
  const recommended: LocationId | null = location;

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
    safeTrack("risk_guide_location_selected", { location: next });
  }

  function onListingBlur() {
    if (listingTrim) {
      safeTrack("risk_guide_listing_entered", { hasUrl: listingOk });
    }
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
          retryAfterSec?: number;
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
      } catch {
        setFormError(t("errors.generic"));
      }
    });
  }

  const optionRowClass =
    "flex flex-col gap-3 border-b border-white/[0.08] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6";

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
        <header className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-xl lg:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            {t("eyebrow")}
          </p>
          <h2
            id={`${baseId}-heading`}
            className="mt-2 text-[1.35rem] font-semibold tracking-tight text-white sm:text-[1.5rem]"
          >
            {t("title")}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55 sm:text-[15px]">
            {t("subtitle")}
          </p>
        </header>

        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 space-y-6 lg:col-span-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                {t("step1.label")}
              </p>
              <div
                className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t("step1.label")}
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
                      className={`min-h-[3.25rem] rounded-xl border px-3.5 py-3 text-left transition ${
                        active
                          ? "border-[#0066ff]/45 bg-[#0066ff]/[0.12] text-white"
                          : "border-white/[0.1] bg-transparent text-white/70 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      <span className="block text-[13px] font-semibold tracking-tight">{opt.title}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-white/45">
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {location ? (
              <div>
                <label
                  htmlFor={`${baseId}-listing`}
                  className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40"
                >
                  {t("step2.label")}
                </label>
                <p className="mt-1 text-[12px] text-white/40">{t("step2.hint")}</p>
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
                  className="mt-2 w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/30 outline-none transition focus:border-[#0066ff]/50 focus:ring-1 focus:ring-[#0066ff]/30"
                />
                {listingTouchedInvalid ? (
                  <p className="mt-1.5 text-[12px] text-amber-200/90">{t("errors.listing")}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 lg:col-span-7">
            {!location ? (
              <p className="rounded-xl border border-dashed border-white/[0.12] px-4 py-8 text-center text-[14px] text-white/40 lg:py-12">
                {t("step3.pickLocationFirst")}
              </p>
            ) : success ? (
              <div className="rounded-xl border border-[#0066ff]/30 bg-[#0066ff]/[0.08] px-4 py-6 sm:px-5">
                <p className="text-[15px] font-semibold text-white">{t("success.title")}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{t("success.body")}</p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Link
                    href={homeHeroCheckoutHref(location === "abroad" ? "audits" : "mini")}
                    onClick={() =>
                      safeTrack(
                        location === "abroad" ? "risk_guide_audits_clicked" : "risk_guide_mini_clicked",
                      )
                    }
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#0066ff]/50 bg-[#0066ff]/20 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#0066ff]/30"
                  >
                    {location === "abroad" ? t("success.ctaAudits") : t("success.ctaMini")}
                  </Link>
                  {location === "lv" ? (
                    <Link
                      href={homeHeroCheckoutHref("audits")}
                      onClick={() => safeTrack("risk_guide_audits_clicked")}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70 transition hover:border-white/35 hover:text-white"
                    >
                      {t("success.ctaAudits")}
                    </Link>
                  ) : (
                    <Link
                      href={homeHeroCheckoutHref("mini")}
                      onClick={() => safeTrack("risk_guide_mini_clicked")}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/20 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70 transition hover:border-white/35 hover:text-white"
                    >
                      {t("success.ctaMini")}
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  {t("step3.label")}
                </p>

                <div className="mt-2">
                  <div className={optionRowClass}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-white">{t("options.free.title")}</p>
                        <span className="text-[12px] text-white/45">{t("options.free.price")}</span>
                      </div>
                      <p
                        className={`mt-1 text-[13px] leading-relaxed ${
                          listingOk ? "text-white/55" : "text-white/35"
                        }`}
                      >
                        {listingOk ? t("options.free.body") : t("options.free.needUrl")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!listingOk}
                      onClick={openFreeForm}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-white/20 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80 transition enabled:hover:border-white/40 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[11.5rem]"
                    >
                      {t("options.free.cta")}
                    </button>
                  </div>

                  <div
                    className={`${optionRowClass} ${
                      recommended === "lv" ? "rounded-xl border border-[#0066ff]/35 bg-[#0066ff]/[0.07] px-3 sm:px-4" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-white">{t("options.mini.title")}</p>
                        <span className="text-[12px] text-white/45">{t("options.mini.price")}</span>
                        {recommended === "lv" ? (
                          <span className="rounded border border-[#0066ff]/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7eb0ff]">
                            {t("recommended")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                        {t("options.mini.body")}
                      </p>
                    </div>
                    <Link
                      href={homeHeroCheckoutHref("mini")}
                      onClick={() => safeTrack("risk_guide_mini_clicked")}
                      className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.08em] transition sm:min-w-[11.5rem] ${
                        recommended === "lv"
                          ? "border border-[#0066ff]/50 bg-[#0066ff]/20 text-white hover:bg-[#0066ff]/30"
                          : "border border-white/20 text-white/80 hover:border-white/40 hover:text-white"
                      }`}
                    >
                      {t("options.mini.cta")}
                    </Link>
                  </div>

                  <div
                    className={`${optionRowClass} ${
                      recommended === "abroad"
                        ? "rounded-xl border border-[#0066ff]/35 bg-[#0066ff]/[0.07] px-3 sm:px-4"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-white">{t("options.audits.title")}</p>
                        <span className="text-[12px] text-white/45">{t("options.audits.price")}</span>
                        {recommended === "abroad" ? (
                          <span className="rounded border border-[#0066ff]/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7eb0ff]">
                            {t("recommended")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                        {t("options.audits.body")}
                      </p>
                    </div>
                    <Link
                      href={homeHeroCheckoutHref("audits")}
                      onClick={() => safeTrack("risk_guide_audits_clicked")}
                      className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.08em] transition sm:min-w-[11.5rem] ${
                        recommended === "abroad"
                          ? "border border-[#0066ff]/50 bg-[#0066ff]/20 text-white hover:bg-[#0066ff]/30"
                          : "border border-white/20 text-white/80 hover:border-white/40 hover:text-white"
                      }`}
                    >
                      {t("options.audits.cta")}
                    </Link>
                  </div>
                </div>

                <p className="mt-4 text-[12px] text-white/40">
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
                    className="mt-6 space-y-3 border-t border-white/[0.08] pt-5"
                  >
                    <p className="text-[13px] leading-relaxed text-white/55">{t("form.boundary")}</p>
                    <div>
                      <label
                        htmlFor={`${baseId}-form-listing`}
                        className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40"
                      >
                        {t("form.listingLabel")}
                      </label>
                      <input
                        id={`${baseId}-form-listing`}
                        type="url"
                        required
                        value={listingUrl}
                        onChange={(e) => setListingUrl(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-[#0066ff]/50 focus:ring-1 focus:ring-[#0066ff]/30"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`${baseId}-form-email`}
                        className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40"
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
                        className="mt-1.5 w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-[#0066ff]/50 focus:ring-1 focus:ring-[#0066ff]/30"
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
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#0066ff]/50 bg-[#0066ff]/20 px-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#0066ff]/30 disabled:opacity-50 sm:w-auto"
                    >
                      {pending ? t("form.submitting") : t("form.submit")}
                    </button>
                  </form>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
