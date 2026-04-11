"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { VinInputSpeedometerDeco } from "@/components/home/VinInputSpeedometerDeco";
import { validateOrderFields } from "@/lib/order-field-validation";

const labelHero =
  "block text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#e5e7eb]";

const labelDefault =
  "block text-left text-[11px] font-medium uppercase tracking-[0.04em] text-[#6e6e73]";

/** Dark cockpit: tikai apakšējā sudraba līnija (bez box-shadow — novērš malu zilo/balto artefaktus) */
const inputHero =
  "relative z-10 mt-2 box-border min-h-11 w-full appearance-none rounded-none border-x-0 border-t-0 border-b border-solid border-[#c0c0c0] bg-transparent px-0 py-2.5 text-[15px] font-normal text-[#e5e7eb] shadow-none outline-none ring-0 transition-[border-color,color] placeholder:text-[#e5e7eb]/38 focus:border-[#0066ff] focus:shadow-none focus:outline-none focus:ring-0 focus-visible:ring-0 sm:min-h-0 sm:text-[16px]";

const inputDefault =
  "mt-2 box-border min-h-11 w-full rounded-none border-0 border-b border-[#050505]/75 bg-transparent px-0 py-2.5 text-[15px] font-normal text-[#1d1d1f] outline-none transition-[border-color] placeholder:text-[#86868b] focus:border-provin-accent focus:ring-0 focus-visible:ring-0 sm:min-h-0 sm:text-[16px]";

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

    const fieldError = validateOrderFields({ vin, listingUrl, email, phone });
    if (fieldError) {
      setError(te(`validation.${fieldError}`));
      return;
    }

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
      ? `space-y-5 rounded-none border-0 bg-transparent px-1 py-5 sm:px-2 sm:py-6 ${className ?? ""}`
      : compact
        ? `mt-6 space-y-4 border-t border-black/[0.06] pt-6 ${className ?? ""}`
        : `mt-10 space-y-6 rounded-none border-0 border-y border-black/[0.08] bg-white/[0.55] px-5 py-8 sm:px-10 sm:py-10 ${className ?? ""}`;

  const gridGap = hero ? "gap-4" : compact ? "gap-4" : "gap-6";
  const notesRows = hero ? 3 : compact ? 3 : 4;

  const hintClass = hero
    ? "mt-1.5 text-[11px] font-normal leading-snug text-[#e5e7eb]/55"
    : "mt-1 text-[11px] font-normal leading-snug text-[#86868b]";

  const optionalMutedClass = hero ? "text-[#e5e7eb]/45" : "text-[#aeaeb2]";
  const reqStarClass = hero ? "text-red-400" : "text-red-600";

  return (
    <form onSubmit={onSubmit} className={formShell} noValidate>
      <div className={`grid sm:grid-cols-2 ${gridGap}`}>
        <div className="sm:col-span-2">
          <label htmlFor="order-name" className={labelClass}>
            {t("nameLabel")}{" "}
            <span className={`font-normal normal-case tracking-normal ${optionalMutedClass}`}>
              {t("optional")}
            </span>
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
              {t("emailLabel")} <span className={reqStarClass}>*</span>
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
              {t("phoneLabel")} <span className={reqStarClass}>*</span>
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
            {t("vinLabel")} <span className={reqStarClass}>*</span>
          </label>
          {hero ? (
            <div className="vin-wrapper w-full overflow-visible pb-8">
              <input
                id="order-vin"
                name="vin"
                type="text"
                required
                maxLength={17}
                spellCheck={false}
                className={`${inputBase} font-mono uppercase tracking-wide`}
                placeholder={t("vinPlaceholderHero")}
                onChange={(e) => {
                  const el = e.target;
                  el.value = el.value.toUpperCase().slice(0, 17);
                }}
              />
              <VinInputSpeedometerDeco />
            </div>
          ) : (
            <input
              id="order-vin"
              name="vin"
              type="text"
              required
              maxLength={17}
              spellCheck={false}
              className={`${inputBase} font-mono uppercase tracking-wide`}
              placeholder={t("vinPlaceholder")}
              onChange={(e) => {
                const el = e.target;
                el.value = el.value.toUpperCase().slice(0, 17);
              }}
            />
          )}
          <p className={hero ? "mt-1.5 text-[11px] font-normal text-[#e5e7eb]/52" : "mt-1 text-[11px] font-normal text-[#aeaeb2]"}>
            {t("vinHint")}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="order-url" className={labelClass}>
            {t("listingLabel")} <span className={reqStarClass}>*</span>
          </label>
          <input
            id="order-url"
            name="listingUrl"
            type="url"
            required
            className={inputBase}
            placeholder={t("urlPlaceholder")}
          />
          <p className={hintClass}>{t("listingHint")}</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="order-notes" className={labelClass}>
            {t("notesLabel")}{" "}
            <span className={`font-normal normal-case tracking-normal ${optionalMutedClass}`}>
              {t("optional")}
            </span>
          </label>
          <textarea
            id="order-notes"
            name="notes"
            rows={notesRows}
            maxLength={500}
            className={`${inputBase} min-h-[88px] resize-y sm:min-h-[72px]`}
            placeholder={t("notesPlaceholder")}
          />
        </div>
      </div>

      <div
        className={
          hero
            ? "mt-6 space-y-5 border-t border-[#c0c0c0]/25 pt-5"
            : compact
              ? "mt-4 flex flex-col gap-3"
              : "mt-8 flex flex-col gap-3 border-t border-black/[0.06] pt-8"
        }
      >
        {hero ? (
          <>
            <div className="border-b border-[#c0c0c0]/35 pb-4" role="group" aria-label={t("ariaSummary")}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] font-medium text-[#e5e7eb]">{t("summaryLabel")}</span>
                <span className="text-[1.85rem] font-bold tabular-nums tracking-tight text-[#c0c0c0] sm:text-[2rem]">
                  79,99&nbsp;€
                </span>
              </div>
              <p className="mt-2 text-[11px] font-normal leading-snug text-[#e5e7eb]/58 sm:text-[12px]">{t("summaryNote")}</p>
            </div>
            <label
              htmlFor="order-checkout-consent"
              className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-[#c0c0c0]/35 pb-4 text-left sm:min-h-0"
            >
              <input
                id="order-checkout-consent"
                type="checkbox"
                name="withdrawalConsent"
                checked={withdrawalConsent}
                onChange={(e) => setWithdrawalConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-[#c0c0c0] bg-transparent text-provin-accent focus:ring-1 focus:ring-[#0066ff]/40 sm:mt-0.5 sm:h-4 sm:w-4"
                aria-label={t("checkoutConsentAria")}
              />
              <span className="text-[12px] font-normal leading-snug text-[#e5e7eb] sm:text-[13px]">
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
              className="provin-btn provin-btn--compact home-cta-blueprint mx-auto mt-1 flex min-h-12 w-full max-w-[min(100%,20rem)] items-center justify-center gap-2.5 rounded-none px-7 py-3.5 text-center text-[15px] font-bold text-[#f3f4f6] hover:!translate-y-0 disabled:opacity-60 sm:min-h-[50px]"
            >
              {loading ? (
                t("payLoading")
              ) : (
                <>
                  {t("payButton")}
                  <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                </>
              )}
            </button>
            <p className="text-center text-[10px] font-normal leading-relaxed text-[#e5e7eb]/48 sm:text-[11px]">{t("stripeNote")}</p>
          </>
        ) : (
          <>
            <label
              htmlFor="order-checkout-consent"
              className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-[#050505]/12 pb-4 text-left sm:min-h-0"
            >
              <input
                id="order-checkout-consent"
                type="checkbox"
                name="withdrawalConsent"
                checked={withdrawalConsent}
                onChange={(e) => setWithdrawalConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-[#050505]/35 text-provin-accent focus:ring-1 focus:ring-provin-accent/25 sm:mt-0.5 sm:h-4 sm:w-4"
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
                className="provin-btn provin-btn--compact inline-flex min-h-11 w-full min-w-[180px] items-center justify-center rounded-full px-7 py-[10px] text-[14px] font-normal shadow-[0_4px_14px_rgba(0,0,0,0.12)] disabled:opacity-60 sm:w-auto sm:min-h-10"
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
              ? "mt-5 border-b border-red-500/40 bg-transparent px-1 py-3 text-center text-[13px] font-normal text-red-300"
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
