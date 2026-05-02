"use client";

import { AlertTriangle, Filter, Layers, MessageSquare, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import demoPageStyles from "@/app/[locale]/demo/page.module.css";
import { DiagnosticScanLine } from "@/components/DiagnosticScanLine";
import { PROVIN_SELECT_FORM_HASH, PROVIN_SELECT_SECTION_ID } from "@/lib/provin-select-section";
import { heroPillarCardIconClass, heroPillarCardTitleClass } from "@/lib/home-layout";
import { renderProvinText } from "@/lib/provin-wordmark";

const subsectionHeadingClass =
  "iriss-editorial-heading font-semibold uppercase tracking-[0.08em] text-white/90";

const SELECT_CARD_ICONS: LucideIcon[] = [Layers, Filter, AlertTriangle, MessageSquare];

const selectGridWidthClass = "w-full max-w-[min(100%,68rem)]";

const selectCardClass =
  "marketing-hero-pillar marketing-hero-pillar--soft marketing-hero-pillar--mobile-card demo-design-dir__card flex min-h-0 flex-col items-center justify-start gap-2.5 px-2 py-3 text-center sm:gap-3 sm:px-3 sm:py-4";

const NOTES_MAX = 500;

type IncludedRow = { title: string; body: string };

export function ProvinSelectSection() {
  const t = useTranslations("ProvinSelect");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const rawIncluded = t.raw("included");
  const includedRows: IncludedRow[] = Array.isArray(rawIncluded)
    ? (rawIncluded as IncludedRow[]).filter((r) => r && typeof r.title === "string" && typeof r.body === "string")
    : [];

  const rawDeliverySteps = t.raw("deliverySteps");
  const deliveryRows: IncludedRow[] = Array.isArray(rawDeliverySteps)
    ? (rawDeliverySteps as IncludedRow[]).filter((r) => r && typeof r.title === "string" && typeof r.body === "string")
    : [];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const scrollToFormIfHash = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== `#${PROVIN_SELECT_FORM_HASH}`) return;
    window.requestAnimationFrame(() => {
      document.getElementById(PROVIN_SELECT_FORM_HASH)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    scrollToFormIfHash();
    window.addEventListener("hashchange", scrollToFormIfHash);
    return () => window.removeEventListener("hashchange", scrollToFormIfHash);
  }, [scrollToFormIfHash]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setConsentError(null);
    if (!withdrawalConsent) {
      setConsentError(tOrder("errors.withdrawalRequired"));
      requestAnimationFrame(() => document.getElementById("provin-select-checkout-consent")?.focus());
      return;
    }

    setPhase("loading");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutLine: "provin_select",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: message.trim().slice(0, NOTES_MAX),
          locale,
          withdrawalConsent: true,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string; errors?: string[] };
      if (!res.ok) {
        const msg = data.errors?.[0] ?? data.error ?? tOrder("errors.checkoutFailed");
        setErrMsg(msg);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErrMsg(tOrder("errors.noUrl"));
    } catch {
      setErrMsg(tOrder("errors.network"));
    } finally {
      setPhase("idle");
    }
  };

  return (
    <section
      id={PROVIN_SELECT_SECTION_ID}
      aria-labelledby="provin-select-heading"
      className={`provin-select-section home-hero-intro-surface ${demoPageStyles.heroIntroSurface} home-body-ink relative scroll-mt-16 overflow-x-clip py-16 sm:py-20`}
    >
      <div className="demo-design-dir__shell relative">
        <div className="mx-auto max-w-[min(100%,48rem)] text-center">
          <h2
            id="provin-select-heading"
            className="demo-design-dir__title mx-auto max-w-[min(100%,48rem)] text-balance"
          >
            {renderProvinText(t("eyebrow"), { proAndSuffixClassName: "provin-wordmark-pro" })}
          </h2>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="alongPingPong" className="w-full" />
          </div>
          <p className="demo-design-dir__body mx-auto mt-3 max-w-[min(100%,40rem)] text-balance font-medium sm:mt-4">
            {t("lead")}
          </p>
        </div>

        <ul
          className={`mx-auto mt-10 grid list-none grid-cols-1 gap-3 sm:gap-4 md:mt-12 md:grid-cols-2 md:gap-5 lg:grid-cols-4 ${selectGridWidthClass}`}
        >
          {includedRows.map((row, i) => {
            const Icon = SELECT_CARD_ICONS[i] ?? Layers;
            return (
              <li key={row.title} className="min-w-0">
                <div className={`${selectCardClass} h-full`}>
                  <Icon className={`${heroPillarCardIconClass} provin-select-pillar-icon`} aria-hidden strokeWidth={1.5} />
                  <h3 className={heroPillarCardTitleClass}>{row.title}</h3>
                  <p className="home-muted-foreground line-clamp-2 max-w-[14rem] text-[11px] leading-relaxed sm:max-w-none sm:text-[12px]">
                    {row.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className={`mx-auto mt-10 max-w-[min(100%,48rem)] md:mt-12`}>
          <h3 className={`${subsectionHeadingClass} text-center`}>{t("deliveryTitle")}</h3>
          <div className="mx-auto mt-3 w-full max-w-[min(100%,42rem)] px-1 sm:px-2">
            <DiagnosticScanLine variant="rail" motion="none" className="w-full" />
          </div>

          <ol
            className={`mx-auto mt-6 grid list-none grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 lg:mt-8 lg:grid-cols-4 lg:gap-4 ${selectGridWidthClass}`}
          >
            {deliveryRows.map((row, idx) => (
              <li
                key={row.title}
                className="provin-select-delivery-step relative flex gap-3 rounded-xl px-3 py-3 backdrop-blur-sm sm:px-3.5 sm:py-3.5 lg:flex-col lg:items-center lg:gap-2 lg:px-2 lg:py-4 lg:text-center"
              >
                <span
                  className="provin-select-delivery-step__badge flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums sm:h-10 sm:w-10 sm:text-[12px]"
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 lg:flex-none">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-white/90 sm:text-[11px]">
                    {row.title}
                  </p>
                  <p className="home-muted-foreground mt-1 line-clamp-2 text-[11px] leading-snug sm:text-[12px]">
                    {row.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="provin-select-delivery-important mx-auto mt-6 max-w-[min(100%,40rem)] text-center text-[10px] font-normal leading-snug text-white/55 sm:mt-7 sm:text-[11px]">
            {renderProvinText(t("deliveryImportant"))}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-[min(100%,40rem)] space-y-10 text-left text-pretty md:mt-14">
          <div id={PROVIN_SELECT_FORM_HASH} className="scroll-mt-[calc(3.5rem+8px)]">
            <h3 className={subsectionHeadingClass}>{t("formTitle")}</h3>
            <div className="mt-3 w-full">
              <DiagnosticScanLine variant="rail" motion="none" className="w-full" />
            </div>
            <div className={`${demoPageStyles.heroFormCard} mx-auto mt-4 w-full max-w-[520px]`}>
              <form
                onSubmit={(e) => void onSubmit(e)}
                className="order-form--hero !mt-0 w-full space-y-3 !px-0 !py-0 sm:!px-0 sm:!py-0"
              >
              <label className={demoPageStyles.field}>
                <span className={demoPageStyles.fieldLabel}>{t("nameLabel")}</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                  required
                  minLength={3}
                  disabled={phase === "loading"}
                />
              </label>
              <label className={demoPageStyles.field}>
                <span className={demoPageStyles.fieldLabel}>{t("phoneLabel")}</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full"
                  required
                  disabled={phase === "loading"}
                />
              </label>
              <label className={demoPageStyles.field}>
                <span className={demoPageStyles.fieldLabel}>{t("emailLabel")}</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  required
                  disabled={phase === "loading"}
                />
              </label>
              <label className={demoPageStyles.field}>
                <span className={demoPageStyles.fieldLabel}>{t("messageLabel")}</span>
                <textarea
                  name="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("messagePlaceholder")}
                  className="w-full min-h-[7.5rem]"
                  required
                  minLength={20}
                  maxLength={NOTES_MAX}
                  disabled={phase === "loading"}
                />
              </label>
              <p className="demo-design-dir__body text-[11px] leading-relaxed opacity-80">{t("followupNote")}</p>

              <div className="order-form-hero-rule border-b border-[#c0c0c0]/35 pb-4 pt-2">
                <label
                  htmlFor="provin-select-checkout-consent"
                  className="flex min-h-11 cursor-pointer items-start gap-3 text-left sm:min-h-0"
                >
                  <input
                    id="provin-select-checkout-consent"
                    type="checkbox"
                    name="withdrawalConsent"
                    checked={withdrawalConsent}
                    onChange={(e) => {
                      setWithdrawalConsent(e.target.checked);
                      setConsentError(null);
                    }}
                    className="order-form-hero-checkbox mt-1 h-4 w-4 shrink-0 rounded border-[#c0c0c0] bg-transparent text-provin-accent focus:ring-1 focus:ring-emerald-400/45 sm:mt-0.5 sm:h-4 sm:w-4"
                    aria-invalid={Boolean(consentError)}
                    aria-describedby={consentError ? "provin-select-consent-error" : undefined}
                    aria-label={tOrder("checkoutConsentAria")}
                    disabled={phase === "loading"}
                  />
                  <span className="order-form-hero-consent-text text-[12px] font-normal leading-snug text-[#e5e7eb] sm:text-[13px]">
                    {tOrder.rich("checkoutConsent", {
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
                    id="provin-select-consent-error"
                    className="order-form-hero-field-error mt-2 px-0.5 text-left text-[12px] font-normal leading-snug text-red-300 sm:text-[11px]"
                    role="alert"
                    aria-live="polite"
                  >
                    {consentError}
                  </p>
                ) : null}
              </div>

              {errMsg ? (
                <p className="provin-select-form-error text-[12px]" role="alert">
                  {errMsg}
                </p>
              ) : null}
              <div className="flex flex-col items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={phase === "loading"}
                  className={`${demoPageStyles.ctaButtonHeroConsult} !mt-0 w-full max-w-[520px] disabled:cursor-wait disabled:opacity-60 sm:w-[min(100%,520px)]`}
                >
                  {phase === "loading" ? tOrder("payLoading") : t("submit")}
                </button>
                <p className="order-form-hero-stripe-note text-center text-[10px] font-normal leading-relaxed text-[#e5e7eb]/48 sm:text-[11px]">
                  {tOrder("stripeNote")}
                </p>
              </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
