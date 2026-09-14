"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { useRouter } from "@/i18n/navigation";
import { B2bPartnerBuyReports } from "@/components/b2b/B2bPartnerBuyReports";
import { getB2bCatalogPlan, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import type { B2bPartnerPriceOverrides, B2bPartnerPublicProfile } from "@/lib/b2b-partner-account";
import { emptyB2bCreditRemaining, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { isValidVin } from "@/lib/order-field-validation";

const LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";

function PackageMark({ title }: { title: string }) {
  if (title !== "PROVIN BUSINESS") return <>{title}</>;
  return (
    <>
      PRO<span className="text-[#2563EB]">VIN</span> BUSINESS
    </>
  );
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/10 pb-3 text-[0.78rem] text-zinc-400">
        <span>{t("statusLoading")}</span>
      </div>
    );
  }
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/10 pb-3 text-[0.78rem] text-zinc-400">
      <span>
        {dealerEnabled ? (
          <>
            {t("creditChipBusiness")} <b className="font-semibold text-zinc-100">{credits.business}</b>
            {" · "}
            {t("creditChipDealer")} <b className="font-semibold text-zinc-100">{credits.dealer}</b>
          </>
        ) : (
          <>
            {t("statusRemainingAudits", { count: credits.business })}
          </>
        )}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {t("statusDealerLabel")}
        <span
          className={
            dealerEnabled
              ? "rounded-[0.25rem] bg-emerald-500/20 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.06em] text-emerald-200"
              : "rounded-[0.25rem] bg-white/[0.06] px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.06em] text-zinc-500"
          }
        >
          {dealerEnabled ? t("statusOn") : t("statusOff")}
        </span>
      </span>
    </div>
  );
}

export function B2bPartnerHome() {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const router = useRouter();
  const [remaining, setRemaining] = useState<B2bCreditRemaining | null>(null);
  const [dealerEnabled, setDealerEnabled] = useState(false);
  const [prices, setPrices] = useState<B2bPartnerPriceOverrides | null>(null);
  const [vin, setVin] = useState("");
  const [service, setService] = useState<B2bPartnerPlanId | null>(null);
  const [vinError, setVinError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitOk, setSubmitOk] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [creditsRes, meRes] = await Promise.all([
          fetch("/api/partner/credits", { credentials: "include" }),
          fetch("/api/partner/me", { credentials: "include" }),
        ]);
        if (creditsRes.status === 401 || meRes.status === 401) {
          router.replace("/partneriem");
          return;
        }
        const creditsData = (await creditsRes.json()) as { remaining?: B2bCreditRemaining };
        const meData = (await meRes.json()) as { partner?: B2bPartnerPublicProfile };
        if (cancelled) return;
        const next = creditsData.remaining ?? emptyB2bCreditRemaining();
        const enabled = meData.partner?.dealerEnabled === true;
        setDealerEnabled(enabled);
        setPrices(meData.partner?.prices ?? null);
        setRemaining({
          business: Math.max(0, next.business ?? 0),
          dealer: enabled ? Math.max(0, next.dealer ?? 0) : 0,
        });
      } catch {
        if (!cancelled) {
          setRemaining(emptyB2bCreditRemaining());
          setDealerEnabled(false);
          setPrices(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const credits = remaining ?? emptyB2bCreditRemaining();
  const loaded = remaining !== null;
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
    setServiceError("");
    setFormError("");
    setSubmitOk("");
    if (!isValidVin(vin)) {
      setVinError(t("vinError"));
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
        body: JSON.stringify({ vin, plan }),
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
      setService(null);
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

            {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
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
