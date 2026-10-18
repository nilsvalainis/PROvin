"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Link, useRouter } from "@/i18n/navigation";
import { B2bPartnerBuyReports } from "@/components/b2b/B2bPartnerBuyReports";
import { B2bPartnerBulkVin } from "@/components/b2b/B2bPartnerBulkVin";
import { getB2bCatalogPlan, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import type { B2bPartnerPriceOverrides } from "@/lib/b2b-partner-account";
import {
  buildSubmittedPartnerArchiveRow,
  formatPartnerVinDuplicateDate,
  rememberPendingPartnerArchiveRow,
} from "@/lib/b2b-partner-archive-rows";
import { emptyB2bCreditRemaining, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { isIncompleteVinLength, isPlausibleListingUrl, isValidVin, sanitizeVinInput } from "@/lib/order-field-validation";
import { vinNeedsCheckDigitWarning } from "@/lib/vin-iso3779";
import { trackMetaLead } from "@/lib/meta-pixel";
import {
  isPartnerAuditPurpose,
  type B2bPartnerAuditPurpose,
  type B2bPartnerOrderRow,
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
  const [duplicate, setDuplicate] = useState<{ date: string; reportHref: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [packPaidOk, setPackPaidOk] = useState(false);
  const [vinMode, setVinMode] = useState<"single" | "bulk">("single");

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
    setDuplicate(null);
  };

  const onSubmit = async (opts?: { reorder?: boolean }) => {
    setVinError("");
    setListingError("");
    setAuditPurposeError("");
    setServiceError("");
    setFormError("");
    setSubmitOk("");
    setDuplicate(null);
    if (!auditPurpose || !isPartnerAuditPurpose(auditPurpose)) {
      setAuditPurposeError(t("auditPurposeError"));
      return;
    }
    if (!isValidVin(vin)) {
      setVinError(isIncompleteVinLength(vin) ? t("vinLengthError") : t("vinError"));
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
      trackMetaLead();
      const reorder = opts?.reorder === true;
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ord_${Date.now()}`;
      const res = await fetch("/api/partner/orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          vin,
          plan,
          auditPurpose,
          ...(listing ? { listingUrl: listing } : {}),
          ...(reorder ? { reorder: true } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        duplicate?: boolean;
        orderedAt?: string;
        reportHref?: string | null;
        orderId?: string;
        order?: B2bPartnerOrderRow;
      };
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
      if (data.duplicate) {
        setDuplicate({
          date: formatPartnerVinDuplicateDate(data.orderedAt || Date.now() / 1000),
          reportHref: typeof data.reportHref === "string" && data.reportHref.trim() ? data.reportHref : null,
        });
        return;
      }
      const pending =
        data.order ??
        (data.orderId
          ? buildSubmittedPartnerArchiveRow({ id: data.orderId, vin, plan })
          : null);
      if (pending) rememberPendingPartnerArchiveRow(pending);
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
          <>
            <div
              className="mt-5 flex rounded-[0.35rem] border border-white/12 p-0.5"
              role="tablist"
              aria-label={t("bulkModeAria")}
            >
              {(["single", "bulk"] as const).map((mode) => {
                const active = vinMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={
                      active
                        ? "flex-1 rounded-[0.28rem] bg-white/10 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-100"
                        : "flex-1 rounded-[0.28rem] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-zinc-200"
                    }
                    onClick={() => setVinMode(mode)}
                  >
                    {mode === "single" ? t("bulkModeSingle") : t("bulkModeMany")}
                  </button>
                );
              })}
            </div>
            {vinMode === "bulk" ? (
              <B2bPartnerBulkVin
                availablePlans={availablePlans}
                credits={credits}
                dealerEnabled={dealerEnabled}
                prices={prices}
                locale={locale}
                service={service}
                onPickService={pickService}
                onCreditsReload={loadCredits}
              />
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
                        setDuplicate(null);
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
                  setVin(sanitizeVinInput(event.target.value));
                  setVinError("");
                  setSubmitOk("");
                  setDuplicate(null);
                }}
                onPaste={(event) => {
                  event.preventDefault();
                  setVin(sanitizeVinInput(event.clipboardData.getData("text")));
                  setVinError("");
                  setSubmitOk("");
                  setDuplicate(null);
                }}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
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
                  setDuplicate(null);
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
            {!vinError && vinNeedsCheckDigitWarning(vin) ? (
              <p className={styles.inlineFieldError} role="status">
                {t("vinCheckDigitWarning")}
              </p>
            ) : null}
            {listingError ? <p className={styles.inlineFieldError}>{listingError}</p> : null}
            {serviceError ? <p className={styles.inlineFieldError}>{serviceError}</p> : null}
            {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}
            {duplicate ? (
              <div className="flex flex-col gap-2.5 rounded-[0.35rem] bg-amber-400/10 px-3 py-3">
                <p className="text-[0.8125rem] font-medium leading-snug text-amber-200">
                  {t("vinDuplicateNotice", { date: duplicate.date })}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {duplicate.reportHref ? (
                    <a
                      href={duplicate.reportHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-zinc-200 underline-offset-2 hover:text-white hover:underline"
                    >
                      {t("vinDuplicateOpenReport")}
                    </a>
                  ) : (
                    <Link
                      href="/partneriem/konts/profils"
                      className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-zinc-200 underline-offset-2 hover:text-white hover:underline"
                    >
                      {t("vinDuplicateOpenReport")}
                    </Link>
                  )}
                  <button
                    type="button"
                    className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-emerald-300 underline-offset-2 hover:text-emerald-200 hover:underline disabled:opacity-50"
                    disabled={submitting}
                    onClick={() => {
                      if (!submitting) void onSubmit({ reorder: true });
                    }}
                  >
                    {t("vinDuplicateReorder")}
                  </button>
                </div>
              </div>
            ) : null}
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
          </>
        )}
      </section>
    </div>
  );
}
