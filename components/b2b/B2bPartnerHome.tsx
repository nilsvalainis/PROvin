"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { useRouter } from "@/i18n/navigation";
import { B2bPartnerBuyReports } from "@/components/b2b/B2bPartnerBuyReports";
import { B2bPartnerCatalog } from "@/components/b2b/B2bPartnerCatalog";
import { getB2bCatalogPlan, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { emptyB2bCreditRemaining, hasAnyB2bCredit, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { isValidVin } from "@/lib/order-field-validation";

const LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const PLANS: B2bPartnerPlanId[] = ["dealer", "business"];

function PackageMark({ title }: { title: string }) {
  if (title !== "PROVIN BUSINESS") return <>{title}</>;
  return (
    <>
      PRO<span className="text-[#2563EB]">VIN</span> BUSINESS
    </>
  );
}

function CreditStrip({
  credits,
  loaded,
  labels,
  listAria,
}: {
  credits: B2bCreditRemaining;
  loaded: boolean;
  labels: Record<B2bPartnerPlanId, string>;
  listAria: string;
}) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5" role="list" aria-label={listAria}>
      {PLANS.map((plan) => {
        const n = credits[plan];
        const empty = loaded && n < 1;
        return (
          <div
            key={plan}
            role="listitem"
            className="rounded-[0.7rem] border border-white/10 bg-white/[0.03] px-3 py-3"
          >
            <div className="text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {labels[plan]}
            </div>
            <div
              className={
                empty
                  ? "mt-1.5 text-[1.15rem] font-semibold tabular-nums leading-none text-[#93c5fd]"
                  : "mt-1.5 text-[1.15rem] font-semibold tabular-nums leading-none text-zinc-100"
              }
            >
              {loaded ? n : "…"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function B2bPartnerHome() {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const router = useRouter();
  const [remaining, setRemaining] = useState<B2bCreditRemaining | null>(null);
  const [vin, setVin] = useState("");
  const [service, setService] = useState<B2bPartnerPlanId | null>(null);
  const [vinError, setVinError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/partner/credits", { credentials: "include" });
        if (res.status === 401) {
          router.replace("/partneriem");
          return;
        }
        const data = (await res.json()) as { remaining?: B2bCreditRemaining };
        if (cancelled) return;
        const next = data.remaining ?? emptyB2bCreditRemaining();
        setRemaining({
          business: Math.max(0, next.business ?? 0),
          dealer: Math.max(0, next.dealer ?? 0),
        });
      } catch {
        if (!cancelled) setRemaining(emptyB2bCreditRemaining());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const credits = remaining ?? emptyB2bCreditRemaining();
  const loaded = remaining !== null;
  const canSubmit = loaded && hasAnyB2bCredit(credits);
  const chipLabels: Record<B2bPartnerPlanId, string> = {
    business: t("creditChipBusiness"),
    dealer: t("creditChipDealer"),
  };

  useEffect(() => {
    if (!loaded || service === null) return;
    if (credits[service] < 1) setService(null);
  }, [loaded, service, credits.business, credits.dealer]);

  const pickService = (plan: B2bPartnerPlanId) => {
    if (credits[plan] < 1) return;
    setService(plan);
    setServiceError("");
  };

  const onSubmit = () => {
    setVinError("");
    setServiceError("");
    setFormError("");
    if (!isValidVin(vin)) {
      setVinError(t("vinError"));
      return;
    }
    if (!service) {
      setServiceError(t("needService"));
      return;
    }
    if (credits[service] < 1) {
      setFormError(t("noCredits"));
    }
  };

  return (
    <div>
      <section
        className="mx-auto flex min-h-[calc(100svh-6.75rem)] w-full max-w-[22rem] flex-col"
        aria-labelledby="b2b-partner-home-title"
      >
        <h1 id="b2b-partner-home-title" className="text-balance text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] text-zinc-100">
          {canSubmit ? t("vinSubmitTitle") : t("creditsHeading")}
        </h1>

        {!canSubmit ? (
          <>
            <CreditStrip
              credits={credits}
              loaded={loaded}
              labels={chipLabels}
              listAria={t("creditsHeading")}
            />
            {loaded ? (
              <div className="mt-7">
                <p className="text-[0.95rem] font-medium leading-snug text-zinc-100">{t("noCreditsLead")}</p>
                <B2bPartnerBuyReports mode="primary" />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <CreditStrip
              credits={credits}
              loaded={loaded}
              labels={chipLabels}
              listAria={t("creditsHeading")}
            />
            <form
              className="mt-8 flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
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
                  autoCapitalize="characters"
                  maxLength={17}
                  placeholder={t("vinPlaceholder")}
                  aria-label={t("vinAria")}
                  aria-invalid={vinError ? true : undefined}
                  enterKeyHint="done"
                />
              </label>

              <fieldset className="min-w-0">
                <legend className={LABEL_CLASS}>{t("servicePick")}</legend>
                <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("servicePick")}>
                  {PLANS.map((plan) => {
                    const disabled = !loaded || credits[plan] < 1;
                    return (
                      <label
                        key={plan}
                        className={`flex cursor-pointer items-center gap-3 ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                      >
                        <input
                          type="radio"
                          name="b2b-partner-service"
                          checked={service === plan}
                          disabled={disabled}
                          onChange={() => pickService(plan)}
                          className="h-4 w-4 shrink-0 border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                        />
                        <span className="text-[0.9rem] font-medium text-zinc-100">
                          <PackageMark title={getB2bCatalogPlan(plan, locale).title} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
              {serviceError ? <p className={styles.inlineFieldError}>{serviceError}</p> : null}
              {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}

              <button type="submit" className={styles.liquidCta} disabled={!canSubmit}>
                <span className={styles.liquidCtaShimmer} aria-hidden />
                <span className={styles.liquidCtaLabel}>{t("vinSubmit")}</span>
              </button>
              <B2bPartnerBuyReports mode="secondary" />
            </form>
          </>
        )}
      </section>

      <section className="mt-10 border-t border-white/10 pt-12 sm:mt-14 sm:pt-14" aria-labelledby="b2b-included-title">
        <h2 id="b2b-included-title" className="text-balance text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-100">
          {t("includedHeading")}
        </h2>
        <B2bPartnerCatalog />
      </section>
    </div>
  );
}
