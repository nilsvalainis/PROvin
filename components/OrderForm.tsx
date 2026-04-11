"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Link } from "@/i18n/navigation";
import { validateOrderFields } from "@/lib/order-field-validation";

/** Blueprint / spec sheet — uz sudraba virsmas */
const labelSheet =
  "block text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-[#050505]";

const labelDefault =
  "block text-left text-[11px] font-medium uppercase tracking-[0.04em] text-[#6e6e73]";

const inputSheet =
  "box-border min-h-11 w-full appearance-none rounded-none border-x-0 border-t-0 border-b border-solid border-[#050505] bg-transparent px-0 py-2.5 text-[15px] font-normal text-[#050505] shadow-none outline-none ring-0 transition-[border-color,color] placeholder:text-[rgba(5,5,5,0.4)] focus:border-[#0066ff] focus:shadow-none focus:outline-none focus:ring-0 focus-visible:ring-0 sm:min-h-0 sm:text-[16px]";

const inputDefault =
  "mt-2 box-border min-h-11 w-full rounded-none border-0 border-b border-[#050505] bg-transparent px-0 py-2.5 text-[15px] font-normal text-[#1d1d1f] outline-none transition-[border-color] placeholder:text-[rgba(5,5,5,0.4)] focus:border-provin-accent focus:ring-0 focus-visible:ring-0 sm:min-h-0 sm:text-[16px]";

const hintSheet =
  "mt-2 text-[11px] font-normal leading-snug text-[rgba(5,5,5,0.52)] sm:text-[12px]";

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

  const labelClass = hero ? labelSheet : labelDefault;
  const inputBase = hero ? inputSheet : inputDefault;

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

  const formInner =
    hero
      ? "space-y-8"
      : compact
        ? `mt-6 space-y-4 border-t border-black/[0.06] pt-6 ${className ?? ""}`
        : `mt-10 space-y-6 border-t border-black/[0.08] pt-8 ${className ?? ""}`;

  const gridGap = hero ? "gap-y-10 gap-x-6" : compact ? "gap-4" : "gap-6";
  const notesRows = hero ? 3 : compact ? 3 : 4;

  const hintClass = hero ? hintSheet : "mt-1 text-[11px] font-normal leading-snug text-[#86868b]";

  const optionalMutedClass = hero ? "text-[rgba(5,5,5,0.45)]" : "text-[#aeaeb2]";
  const reqStarClass = hero ? "text-red-600" : "text-red-600";

  const fieldStack = "flex flex-col gap-6";

  const formBody = (
    <form onSubmit={onSubmit} className={formInner} noValidate>
      {hero ? (
        <header className="max-w-[42ch]">
          <h2 className="text-left text-[1.35rem] font-bold leading-tight tracking-tight text-[#050505] sm:text-[1.45rem]">
            {t("sheetTitle")}
          </h2>
          <p className="mt-5 text-left text-[13px] font-normal leading-relaxed text-[rgba(5,5,5,0.55)] sm:text-[14px] sm:leading-relaxed">
            {t("sheetSubtitle")}
          </p>
        </header>
      ) : null}

      <div className={`grid sm:grid-cols-2 ${gridGap}`}>
        <div className={`sm:col-span-2 ${fieldStack}`}>
          <label htmlFor="order-name" className={labelClass}>
            {t("nameLabel")}{" "}
            <span className={`font-normal normal-case tracking-normal ${optionalMutedClass}`}>
              {t("optional")}
            </span>
          </label>
          <div>
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
        </div>
        <div className="sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10">
          <div className={fieldStack}>
            <label htmlFor="order-email" className={labelClass}>
              {t("emailLabel")} <span className={reqStarClass}>*</span>
            </label>
            <div>
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
          </div>
          <div className={fieldStack}>
            <label htmlFor="order-phone" className={labelClass}>
              {t("phoneLabel")} <span className={reqStarClass}>*</span>
            </label>
            <div>
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
        </div>
        <div className={`sm:col-span-2 ${fieldStack}`}>
          <label htmlFor="order-vin" className={labelClass}>
            {t("vinLabel")} <span className={reqStarClass}>*</span>
          </label>
          <div>
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
            <p className={hintClass}>{t("vinHint")}</p>
          </div>
        </div>
        <div className={`sm:col-span-2 ${fieldStack}`}>
          <label htmlFor="order-url" className={labelClass}>
            {t("listingLabel")} <span className={reqStarClass}>*</span>
          </label>
          <div>
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
        </div>
        <div className={`sm:col-span-2 ${fieldStack}`}>
          <label htmlFor="order-notes" className={labelClass}>
            {t("notesLabel")}{" "}
            <span className={`font-normal normal-case tracking-normal ${optionalMutedClass}`}>
              {t("optional")}
            </span>
          </label>
          <div>
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
      </div>

      <div className={hero ? "mt-2 space-y-10" : compact ? "mt-4 flex flex-col gap-3" : "mt-8 flex flex-col gap-3"}>
        {hero ? (
          <>
            <div className="space-y-5" role="group" aria-label={t("ariaSummary")}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#050505]">
                  {t("summaryLabel")}
                </span>
                <span className="text-[1.85rem] font-bold tabular-nums tracking-tight text-[#050505] sm:text-[2rem]">
                  79,99&nbsp;€
                </span>
              </div>
              <p className="max-w-[52ch] text-[11px] font-normal leading-relaxed text-[rgba(5,5,5,0.52)] sm:text-[12px]">
                {t("summaryNote")}
              </p>
            </div>
            <label
              htmlFor="order-checkout-consent"
              className="flex cursor-pointer items-start gap-3 text-left"
            >
              <input
                id="order-checkout-consent"
                type="checkbox"
                name="withdrawalConsent"
                checked={withdrawalConsent}
                onChange={(e) => setWithdrawalConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#050505]/40 bg-white/80 text-provin-accent focus:ring-1 focus:ring-[#0066ff]/35"
                aria-label={t("checkoutConsentAria")}
              />
              <span className="text-[12px] font-normal leading-snug text-[#050505] sm:text-[13px]">
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
            <p className="text-center text-[10px] font-normal leading-relaxed text-[rgba(5,5,5,0.48)] sm:text-[11px]">
              {t("stripeNote")}
            </p>
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
              <span className="text-[12px] font-normal leading-snug text-[#050505] sm:text-[13px]">
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
              ? "mt-6 border-b border-red-600/35 bg-transparent py-3 text-center text-[13px] font-normal text-red-800"
              : "mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-[13px] font-normal text-red-800"
          }
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );

  if (hero) {
    return (
      <div className={`order-spec-glass-host ${className ?? ""}`}>
        <div className="order-spec-blue-field" aria-hidden />
        <div className="order-spec-glass-panel px-5 py-9 sm:px-10 sm:py-11">{formBody}</div>
      </div>
    );
  }

  return formBody;
}
