"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Link, useRouter } from "@/i18n/navigation";
import { B2B_CATALOG, B2B_PARTNER_PRICE, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { isValidVin } from "@/lib/order-field-validation";

const TITLE_CLASS = "text-balance text-lg font-bold leading-snug tracking-tight text-zinc-100 sm:text-xl";
const TITLE_RULE_CLASS = "mt-2.5 h-px w-full bg-white/10";
const LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

function PackageTitle({ title }: { title: string }) {
  return (
    <div>
      <h2 className={TITLE_CLASS}>
        {title === "PROVIN BUSINESS" ? (
          <>
            PRO<span className="text-[#2563EB]">VIN</span> BUSINESS
          </>
        ) : (
          title
        )}
      </h2>
      <div className={TITLE_RULE_CLASS} aria-hidden />
    </div>
  );
}

function OrderColumn({ plan }: { plan: B2bPartnerPlanId }) {
  const t = useTranslations("Partner");
  const tOrder = useTranslations("Order");
  const locale = useLocale();
  const router = useRouter();
  const pkg = B2B_CATALOG[plan];
  const [vin, setVin] = useState("");
  const [comment, setComment] = useState("");
  const [vinError, setVinError] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [payError, setPayError] = useState("");
  const [busy, setBusy] = useState(false);

  const onPay = async () => {
    setVinError("");
    setConsentError("");
    setPayError("");
    if (!isValidVin(vin)) {
      setVinError(t("vinError"));
      return;
    }
    if (!consent) {
      setConsentError(tOrder("errors.withdrawalRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/partner", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          vin,
          notes: comment,
          withdrawalConsent: true,
          locale,
        }),
      });
      if (res.status === 401) {
        router.replace("/partneriem");
        return;
      }
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setPayError(typeof data.error === "string" && data.error.trim() ? data.error : t("payError"));
        return;
      }
      window.location.href = data.url;
    } catch {
      setPayError(t("payNetwork"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex min-w-0 flex-col">
      <PackageTitle title={pkg.title} />
      <form
        className="mt-7 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void onPay();
        }}
      >
        <label className="block min-w-0">
          <span className={LABEL_CLASS}>{t("vinLabel")}</span>
          <input
            type="text"
            className={`${styles.inlineInput} font-mono uppercase tracking-wide${vinError ? ` ${styles.inlineInputError}` : ""}`}
            value={vin}
            onChange={(event) => {
              setVin(event.target.value.toUpperCase());
              setVinError("");
            }}
            autoComplete="off"
            spellCheck={false}
            maxLength={17}
            placeholder={t("vinPlaceholder")}
            aria-label={t("vinAria")}
            aria-invalid={vinError ? true : undefined}
          />
        </label>
        <label className="block min-w-0">
          <span className={LABEL_CLASS}>{t("commentLabel")}</span>
          <textarea
            className={`${styles.inlineInput} min-h-[6.5rem] resize-y py-3`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("commentPlaceholder")}
            aria-label={t("commentAria")}
            rows={3}
          />
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              setConsentError("");
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
            aria-label={tOrder("checkoutConsentAria")}
            aria-invalid={consentError ? true : undefined}
          />
          <span className="text-[12px] font-normal leading-snug text-zinc-400">
            {tOrder.rich("checkoutConsent", {
              terms: (chunks) => (
                <Link
                  href="/lietosanas-noteikumi"
                  className="font-medium text-[#60a5fa] underline decoration-[#60a5fa]/30 underline-offset-2 transition hover:decoration-[#60a5fa]/60"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privatuma-politika"
                  className="font-medium text-[#60a5fa] underline decoration-[#60a5fa]/30 underline-offset-2 transition hover:decoration-[#60a5fa]/60"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
        {consentError ? <p className={styles.inlineFieldError}>{consentError}</p> : null}
        {payError ? <p className={styles.inlineFieldError}>{payError}</p> : null}
        <button type="submit" className={styles.liquidCta} disabled={busy}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>
            {busy ? t("payLoading") : t("payCta", { price: B2B_PARTNER_PRICE[plan] })}
          </span>
        </button>
      </form>
    </article>
  );
}

export function B2bPartnerHome() {
  const t = useTranslations("Partner");
  return (
    <section aria-labelledby="b2b-partner-home-title">
      <h1 id="b2b-partner-home-title" className="sr-only">
        {t("navHome")}
      </h1>
      <div className="flex flex-col gap-10 lg:hidden">
        <OrderColumn plan="business" />
        <div className="h-px w-full bg-white/15" aria-hidden />
        <OrderColumn plan="dealer" />
      </div>
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] lg:items-start lg:gap-x-10">
        <OrderColumn plan="business" />
        <div className="self-stretch bg-white/15" aria-hidden />
        <OrderColumn plan="dealer" />
      </div>
    </section>
  );
}
