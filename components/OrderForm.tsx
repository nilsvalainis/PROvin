"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";

const labelHero =
  "block text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#86868b]";

const labelDefault =
  "block text-left text-[11px] font-medium uppercase tracking-[0.04em] text-[#6e6e73]";

const inputHero =
  "mt-2 w-full rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 text-[16px] font-normal text-[#1d1d1f] shadow-[0_1px_8px_rgba(0,0,0,0.04)] outline-none backdrop-blur-sm transition placeholder:text-[#aeaeb2] focus:border-provin-accent/35 focus:ring-2 focus:ring-provin-accent/15 sm:text-[17px]";

const inputDefault =
  "mt-1 w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2.5 text-[15px] font-normal text-[#1d1d1f] outline-none transition placeholder:text-[#aeaeb2] focus:border-provin-accent/35 focus:ring-1 focus:ring-provin-accent/25 sm:text-[16px]";

type OrderFormProps = {
  className?: string;
  variant?: "default" | "compact" | "hero";
};

export function OrderForm({ className, variant = "default" }: OrderFormProps) {
  const t = useTranslations("Order");
  const te = useTranslations("Order.errors");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const hero = variant === "hero";
  const compact = variant === "compact";

  const labelClass = hero ? labelHero : labelDefault;
  const inputBase = hero ? inputHero : inputDefault;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!withdrawalConsent) {
      setError(te("withdrawalRequired"));
      return;
    }
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const vin = String(fd.get("vin") ?? "").trim();
    const listingUrl = String(fd.get("listingUrl") ?? "").trim();
    const notes = String(fd.get("notes") ?? "").trim();

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          email,
          phone,
          vin,
          listingUrl,
          notes: notes || undefined,
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
      ? `space-y-5 ${className ?? ""}`
      : compact
        ? `mt-6 space-y-4 border-t border-black/[0.06] pt-6 ${className ?? ""}`
        : `provin-lift-strong mt-10 rounded-3xl border border-black/[0.06] bg-gradient-to-b from-[#f5f5f7] to-provin-surface-2 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.05)] sm:p-10 ${className ?? ""}`;

  const gridGap = hero ? "gap-5" : compact ? "gap-4" : "gap-6";
  const notesRows = hero ? 3 : compact ? 3 : 4;

  const hintClass = hero ? "mt-1.5 text-[11px] font-normal leading-snug text-[#86868b]" : "mt-1 text-[11px] font-normal leading-snug text-[#86868b]";

  return (
    <form onSubmit={onSubmit} className={formShell} noValidate>
      <div className={`grid sm:grid-cols-2 ${gridGap}`}>
        <div className="sm:col-span-2">
          <label htmlFor="order-name" className={labelClass}>
            {t("nameLabel")}{" "}
            <span className="font-normal normal-case tracking-normal text-[#aeaeb2]">{t("optional")}</span>
          </label>
          <input
            id="order-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={120}
            className={inputBase}
            placeholder={t("namePlaceholder")}
          />
        </div>
        <div className="sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4">
          <div>
            <label htmlFor="order-email" className={labelClass}>
              {t("emailLabel")} <span className="text-red-600">*</span>
            </label>
            <input
              id="order-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputBase}
              placeholder={t("emailPlaceholder")}
            />
            <p className={hintClass}>{t("emailHint")}</p>
          </div>
          <div>
            <label htmlFor="order-phone" className={labelClass}>
              {t("phoneLabel")} <span className="text-red-600">*</span>
            </label>
            <input
              id="order-phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              className={inputBase}
              placeholder={t("phonePlaceholder")}
            />
            <p className={hintClass}>{t("phoneHint")}</p>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="order-vin" className={labelClass}>
            {t("vinLabel")} <span className="text-red-600">*</span>
          </label>
          <input
            id="order-vin"
            name="vin"
            type="text"
            required
            maxLength={17}
            spellCheck={false}
            className={`${inputBase} font-mono uppercase tracking-wide`}
            placeholder={t("vinPlaceholder")}
          />
          <p className={hero ? "mt-1.5 text-[11px] font-normal text-[#aeaeb2]" : "mt-1 text-[11px] font-normal text-[#aeaeb2]"}>
            {t("vinHint")}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="order-url" className={labelClass}>
            {t("listingLabel")} <span className="text-red-600">*</span>
          </label>
          <input
            id="order-url"
            name="listingUrl"
            type="url"
            required
            className={inputBase}
            placeholder={t("urlPlaceholder")}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="order-notes" className={labelClass}>
            {t("notesLabel")}{" "}
            <span className="font-normal normal-case tracking-normal text-[#aeaeb2]">{t("optional")}</span>
          </label>
          <textarea
            id="order-notes"
            name="notes"
            rows={notesRows}
            maxLength={500}
            className={`${inputBase} min-h-[72px] resize-y`}
            placeholder={t("notesPlaceholder")}
          />
        </div>
      </div>

      <div
        className={
          hero
            ? "mt-8 space-y-4 border-t border-black/[0.08] pt-8"
            : compact
              ? "mt-4 flex flex-col gap-3"
              : "mt-8 flex flex-col gap-3 border-t border-black/[0.06] pt-8"
        }
      >
        {hero ? (
          <>
            <div
              className="rounded-xl border border-black/[0.06] bg-white/70 px-4 py-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-sm sm:px-5"
              role="group"
              aria-label={t("ariaSummary")}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] font-medium text-[#6e6e73]">{t("summaryLabel")}</span>
                <span className="text-[1.65rem] font-semibold tabular-nums tracking-tight text-[#1d1d1f] sm:text-[1.75rem]">
                  49,99&nbsp;€
                </span>
              </div>
              <p className="mt-2 text-[11px] font-normal leading-snug text-[#86868b] sm:text-[12px]">
                {t("summaryNote")}
              </p>
            </div>
            <label
              htmlFor="order-checkout-consent"
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.08] bg-white/60 px-3 py-3 text-left shadow-[0_1px_6px_rgba(0,0,0,0.03)] sm:px-4"
            >
              <input
                id="order-checkout-consent"
                type="checkbox"
                name="withdrawalConsent"
                checked={withdrawalConsent}
                onChange={(e) => setWithdrawalConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#c7c7cc] text-provin-accent focus:ring-provin-accent/30"
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
            <button
              type="submit"
              disabled={loading || !withdrawalConsent}
              className="provin-btn flex w-full min-h-[48px] items-center justify-center rounded-full px-8 py-3.5 text-[16px] font-normal shadow-[0_4px_16px_rgba(0,102,214,0.28)] disabled:opacity-60"
            >
              {loading ? t("payLoading") : t("payButton")}
            </button>
            <p className="text-center text-[10px] font-normal leading-relaxed text-[#aeaeb2] sm:text-[11px]">
              {t("stripeNote")}
            </p>
          </>
        ) : (
          <>
            <label
              htmlFor="order-checkout-consent"
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.08] bg-white/80 px-3 py-3 text-left shadow-[0_1px_6px_rgba(0,0,0,0.03)] sm:px-4"
            >
              <input
                id="order-checkout-consent"
                type="checkbox"
                name="withdrawalConsent"
                checked={withdrawalConsent}
                onChange={(e) => setWithdrawalConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#c7c7cc] text-provin-accent focus:ring-provin-accent/30"
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
            <div
              className={`flex flex-col gap-2 ${compact ? "sm:flex-row sm:items-center sm:justify-between sm:gap-4" : "sm:flex-row sm:items-center sm:justify-between"}`}
            >
              <button
                type="submit"
                disabled={loading || !withdrawalConsent}
                className="provin-btn inline-flex min-h-[44px] w-full min-w-[200px] items-center justify-center rounded-full px-8 py-3 text-[16px] font-normal shadow-[0_4px_16px_rgba(0,102,214,0.28)] disabled:opacity-60 sm:w-auto"
              >
                {loading ? t("payLoading") : t("payButton")}
              </button>
              <p className="text-center text-[10px] font-normal leading-snug text-[#aeaeb2] sm:max-w-[14rem] sm:text-right">
                {t("stripeNote")}
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p
          className={
            hero
              ? "mt-5 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-center text-[13px] font-normal text-red-800 backdrop-blur-sm"
              : "mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-[13px] font-normal text-red-800"
          }
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
