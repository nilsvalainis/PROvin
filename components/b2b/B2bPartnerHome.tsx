"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { useRouter } from "@/i18n/navigation";
import { B2bPartnerBuyReports } from "@/components/b2b/B2bPartnerBuyReports";
import { getB2bCatalogPlan, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import type { B2bPartnerPriceOverrides } from "@/lib/b2b-partner-account";
import { emptyB2bCreditRemaining, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { isPlausibleListingUrl, isValidVin } from "@/lib/order-field-validation";
import {
  isPartnerAuditPurpose,
  type B2bPartnerAuditPurpose,
} from "@/lib/b2b-partner-orders";

const LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

function PackageMark({ title }: { title: string }) {
  if (title !== "PROVIN BUSINESS") return <>{title}</>;
  return (
    <>
      PRO<span className="text-[#2563EB]">VIN</span> BUSINESS
    </>
  );
}

function creditCountClass(count: number) {
  return count >= 1
    ? "font-semibold text-emerald-400"
    : "font-semibold text-red-400";
}

function StatusBar({
  loaded,
  credits,
  dealerEnabled,
}: {
  loaded: boolean;
  credits: B2bCreditRemaining;
  dealerEnabled: boolean;
}) {
  const t = useTranslations("Partner");
  if (!loaded) {
    return (
      <div className="mb-6 border-b border-white/10 pb-3 text-[0.78rem] text-zinc-400">
        {t("statusLoading")}
      </div>
    );
  }
  if (dealerEnabled) {
    return (
      <div className="mb-6 border-b border-white/10 pb-3 text-[0.78rem] text-zinc-400">
        <p>{t("statusAvailableHeading")}</p>
        <p className="mt-1">
          {t("statusPlanBusiness")}{" "}
          <span className={creditCountClass(credits.business)}>{credits.business}</span>
        </p>
        <p>
          {t("statusPlanDealer")}{" "}
          <span className={creditCountClass(credits.dealer)}>{credits.dealer}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="mb-6 border-b border-white/10 pb-3 text-[0.78rem] text-zinc-400">
      {t.rich("statusAvailable", {
        count: () => (
          <span className={creditCountClass(credits.business)}>{credits.business}</span>
        ),
      })}
    </div>
  );
}

export function B2bPartnerHome({
  initialCredits,
  initialDealerEnabled,
  initialPrices,
}: {
  initialCredits: B2bCreditRemaining;
  initialDealerEnabled: boolean;
  initialPrices: B2bPartnerPriceOverrides | null;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const router = useRouter();
  const [remaining, setRemaining] = useState<B2bCreditRemaining>(initialCredits);
  const [dealerEnabled, setDealerEnabled] = useState(initialDealerEnabled);
  const [prices, setPrices] = useState<B2bPartnerPriceOverrides | null>(initialPrices);
  const [vin, setVin] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [auditPurpose, setAuditPurpose] = useState<B2bPartnerAuditPurpose | null>(null);
  const [service, setService] = useState<B2bPartnerPlanId | null>(null);
  const [vinError, setVinError] = useState("");
  const [listingError, setListingError] = useState("");
  const [auditPurposeError, setAuditPurposeError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitOk, setSubmitOk] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [packPaidOk, setPackPaidOk] = useState(false);

  const loadCredits = useCallback(
    async (signal?: { cancelled: boolean }): Promise<B2bCreditRemaining | null> => {
      const [creditsRes, meRes] = await Promise.all([
        fetch("/api/partner/credits", { credentials: "include" }),
        fetch("/api/partner/me", { credentials: "include" }),
      ]);
      if (creditsRes.status === 401 || meRes.status === 401) {
        router.replace("/partneriem");
        return null;
      }
      const creditsData = (await creditsRes.json()) as { remaining?: B2bCreditRemaining };
      const meData = (await meRes.json()) as {
        partner?: { dealerEnabled?: boolean; prices?: B2bPartnerPriceOverrides | null };
      };
      if (signal?.cancelled) return null;
      const next = creditsData.remaining ?? emptyB2bCreditRemaining();
      const enabled = meData.partner?.dealerEnabled === true;
      const remainingNext: B2bCreditRemaining = {
        business: Math.max(0, next.business ?? 0),
        dealer: enabled ? Math.max(0, next.dealer ?? 0) : 0,
      };
      setDealerEnabled(enabled);
      setPrices(meData.partner?.prices ?? null);
      setRemaining(remainingNext);
      return remainingNext;
    },
    [router],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("pack") === "1") {
      setPackPaidOk(true);
    }
  }, []);

  useEffect(() => {
    if (!packPaidOk) return;
    const baseline = initialCredits.business + initialCredits.dealer;
    const signal = { cancelled: false };
    let attempts = 0;
    const poll = async () => {
      if (signal.cancelled) return;
      try {
        const next = await loadCredits(signal);
        if (signal.cancelled || !next) return;
        if (next.business + next.dealer > baseline) return;
      } catch {
        /* webhook var kavēties; nākamais polls mēģina vēlreiz */
      }
      attempts += 1;
      if (attempts >= 15 || signal.cancelled) return;
      window.setTimeout(() => void poll(), 2000);
    };
    void poll();
    return () => {
      signal.cancelled = true;
    };
  }, [packPaidOk, initialCredits.business, initialCredits.dealer, loadCredits]);

  const credits = remaining;
  const loaded = true;
  const availablePlans = useMemo(() => {
    const plans: B2bPartnerPlanId[] = [];
    if (credits.business > 0) plans.push("business");
    if (dealerEnabled && credits.dealer > 0) plans.push("dealer");
    return plans;
  }, [credits.business, credits.dealer, dealerEnabled]);
  const canSubmit = loaded && availablePlans.length > 0;

  useEffect(() => {
    if (!loaded) return;
    if (service !== null && !availablePlans.includes(service)) setService(null);
    if (service === null && availablePlans.length === 1) setService(availablePlans[0]!);
  }, [loaded, service, availablePlans]);

  const pickService = (plan: B2bPartnerPlanId) => {
    if (!availablePlans.includes(plan)) return;
    setService(plan);
    setServiceError("");
    setSubmitOk("");
  };

  const onSubmit = async () => {
    setVinError("");
    setListingError("");
    setAuditPurposeError("");
    setServiceError("");
    setFormError("");
    setSubmitOk("");
    if (!auditPurpose || !isPartnerAuditPurpose(auditPurpose)) {
      setAuditPurposeError(t("auditPurposeError"));
      return;
    }
    if (!isValidVin(vin)) {
      setVinError(t("vinError"));
      return;
    }
    const listing = listingUrl.trim();
    if (listing && !isPlausibleListingUrl(listing)) {
      setListingError(t("listingError"));
      return;
    }
    const plan = service ?? (availablePlans.length === 1 ? availablePlans[0]! : null);
    if (!plan) {
      setServiceError(t("needService"));
      return;
    }
    if (!availablePlans.includes(plan)) {
      setFormError(t("noCredits"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/partner/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin,
          plan,
          auditPurpose,
          ...(listing ? { listingUrl: listing } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (res.status === 401) {
        router.replace("/partneriem");
        return;
      }
      if (res.status === 403 || data.error === "dealer_disabled") {
        setFormError(t("dealerDisabled"));
        return;
      }
      if (res.status === 402 || data.error === "no_credits") {
        setFormError(t("noCredits"));
        setRemaining(emptyB2bCreditRemaining());
        return;
      }
      if (data.error === "vin" || (res.status === 400 && data.error === "vin")) {
        setVinError(t("vinError"));
        return;
      }
      if (data.error === "listing" || (res.status === 400 && data.error === "listing")) {
        setListingError(t("listingError"));
        return;
      }
      if (data.error === "audit_purpose") {
        setAuditPurposeError(t("auditPurposeError"));
        return;
      }
      if (data.error === "service") {
        setServiceError(t("needService"));
        return;
      }
      if (!res.ok || !data.ok) {
        setFormError(t("payNetwork"));
        return;
      }
      setSubmitOk(t("vinSubmitOk"));
      setVin("");
      setListingUrl("");
      setAuditPurpose(null);
      setService(null);
      try {
        await loadCredits();
      } catch {
        /* atlikums atjaunosies nākamajā ielādē */
      }
    } catch {
      setFormError(t("payNetwork"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <section
        className="mx-auto flex min-h-[calc(100svh-6.75rem)] w-full max-w-[22rem] flex-col lg:max-w-[45rem]"
        aria-labelledby="b2b-partner-home-title"
      >
        <StatusBar loaded={loaded} credits={credits} dealerEnabled={dealerEnabled} />
        {packPaidOk ? (
          <p className="mb-4 text-[0.8125rem] font-medium leading-snug text-emerald-300">{t("packPaidOk")}</p>
        ) : null}

        <h1
          id="b2b-partner-home-title"
          className="text-balance text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] text-zinc-100"
        >
          {canSubmit ? t("vinSubmitTitle") : t("creditsHeading")}
        </h1>

        {!canSubmit ? (
          loaded ? (
            <div className="mt-5">
              <p className="text-[0.95rem] font-medium leading-snug text-zinc-100">{t("noCreditsLead")}</p>
              <B2bPartnerBuyReports mode="primary" dealerEnabled={dealerEnabled} prices={prices} />
            </div>
          ) : null
        ) : (
          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!submitting) void onSubmit();
            }}
          >
            <fieldset className="min-w-0" disabled={submitting}>
              <legend className={LABEL_CLASS}>{t("auditPurposeLabel")}</legend>
              <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("auditPurposeAria")}>
                {(["client", "internal"] as const).map((purpose) => (
                  <label key={purpose} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="b2b-partner-audit-purpose"
                      checked={auditPurpose === purpose}
                      onChange={() => {
                        setAuditPurpose(purpose);
                        setAuditPurposeError("");
                        setSubmitOk("");
                      }}
                      className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                    />
                    <span className="text-[0.9rem] font-medium text-zinc-100">
                      {purpose === "client" ? t("auditPurposeClient") : t("auditPurposeInternal")}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block min-w-0">
              <span className={LABEL_CLASS}>{t("vinLabel")}</span>
              <input
                type="text"
                className={`${styles.inlineInput} font-mono uppercase tracking-wide${vinError ? ` ${styles.inlineInputError}` : ""}`}
                value={vin}
                onChange={(event) => {
                  setVin(event.target.value.toUpperCase());
                  setVinError("");
                  setSubmitOk("");
                }}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
                maxLength={17}
                placeholder={t("vinPlaceholder")}
                aria-label={t("vinAria")}
                aria-invalid={vinError ? true : undefined}
                enterKeyHint="done"
                disabled={submitting}
              />
            </label>

            <label className="block min-w-0">
              <span className={LABEL_CLASS}>{t("listingLabel")}</span>
              <input
                type="url"
                className={`${styles.inlineInput}${listingError ? ` ${styles.inlineInputError}` : ""}`}
                value={listingUrl}
                onChange={(event) => {
                  setListingUrl(event.target.value);
                  setListingError("");
                  setSubmitOk("");
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder={t("listingPlaceholder")}
                aria-label={t("listingAria")}
                aria-invalid={listingError ? true : undefined}
                disabled={submitting}
              />
            </label>

            {availablePlans.length > 1 ? (
              <fieldset className="min-w-0" disabled={submitting}>
                <legend className={LABEL_CLASS}>{t("servicePick")}</legend>
                <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("servicePick")}>
                  {availablePlans.map((plan) => (
                    <label key={plan} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="radio"
                        name="b2b-partner-service"
                        checked={service === plan}
                        onChange={() => pickService(plan)}
                        className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                      />
                      <span className="text-[0.9rem] font-medium text-zinc-100">
                        <PackageMark title={getB2bCatalogPlan(plan, locale).title} />
                        <span className="ml-1.5 text-zinc-500">({credits[plan]})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {auditPurposeError ? <p className={styles.inlineFieldError}>{auditPurposeError}</p> : null}
            {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
            {listingError ? <p className={styles.inlineFieldError}>{listingError}</p> : null}
            {serviceError ? <p className={styles.inlineFieldError}>{serviceError}</p> : null}
            {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}
            {submitOk ? (
              <p className="text-[0.8125rem] font-medium leading-snug text-emerald-300">{submitOk}</p>
            ) : null}

            <button type="submit" className={styles.liquidCta} disabled={!canSubmit || submitting}>
              <span className={styles.liquidCtaShimmer} aria-hidden />
              <span className={styles.liquidCtaLabel}>
                {submitting ? t("vinSubmitLoading") : t("vinSubmit")}
              </span>
            </button>
            <B2bPartnerBuyReports mode="secondary" dealerEnabled={dealerEnabled} prices={prices} />
          </form>
        )}
      </section>
    </div>
  );
}
