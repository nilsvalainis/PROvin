"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { Link, useRouter } from "@/i18n/navigation";
import { B2B_CATALOG, type B2bPartnerPlanId } from "@/lib/b2b-partner-copy";
import { emptyB2bCreditRemaining, hasAnyB2bCredit, type B2bCreditRemaining } from "@/lib/b2b-partner-credits";
import { isValidVin } from "@/lib/order-field-validation";

const LABEL_CLASS = "mb-1.5 block text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-zinc-500";
const PLANS: B2bPartnerPlanId[] = ["business", "dealer"];

function PackageMark({ title }: { title: string }) {
  if (title !== "PROVIN BUSINESS") return <>{title}</>;
  return (
    <>
      PRO<span className="text-[#2563EB]">VIN</span> BUSINESS
    </>
  );
}

export function B2bPartnerHome() {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [remaining, setRemaining] = useState<B2bCreditRemaining | null>(null);
  const [vin, setVin] = useState("");
  const [picked, setPicked] = useState<Record<B2bPartnerPlanId, boolean>>({
    business: false,
    dealer: false,
  });
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

  const togglePlan = (plan: B2bPartnerPlanId) => {
    if (credits[plan] < 1) return;
    setPicked((prev) => ({ ...prev, [plan]: !prev[plan] }));
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
    const selected = PLANS.filter((plan) => picked[plan]);
    if (selected.length === 0) {
      setServiceError(t("needService"));
      return;
    }
    if (selected.some((plan) => credits[plan] < 1)) {
      setFormError(t("noCredits"));
    }
  };

  return (
    <section className="mx-auto w-full max-w-[22rem]" aria-labelledby="b2b-partner-home-title">
      <h1 id="b2b-partner-home-title" className="text-balance text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] text-zinc-100">
        {t("vinSubmitTitle")}
      </h1>

      <ul className="mt-6 grid gap-2" aria-label={t("creditsHeading")}>
        {PLANS.map((plan) => (
          <li
            key={plan}
            className="flex items-baseline justify-between gap-3 border-b border-white/10 py-2 text-[0.9rem]"
          >
            <span className="min-w-0 font-medium text-zinc-100">
              <PackageMark title={B2B_CATALOG[plan].title} />
            </span>
            <span className="shrink-0 tabular-nums text-zinc-400">
              {loaded ? t("creditLeft", { count: credits[plan] }) : "…"}
            </span>
          </li>
        ))}
      </ul>

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
          <div className="flex flex-col gap-3">
            {PLANS.map((plan) => {
              const disabled = !loaded || credits[plan] < 1;
              return (
                <label
                  key={plan}
                  className={`flex cursor-pointer items-center gap-3 ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={picked[plan]}
                    disabled={disabled}
                    onChange={() => togglePlan(plan)}
                    className="h-4 w-4 shrink-0 rounded border-zinc-500 bg-transparent text-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40"
                  />
                  <span className="text-[0.9rem] font-medium text-zinc-100">
                    <PackageMark title={B2B_CATALOG[plan].title} />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {vinError ? <p className={styles.inlineFieldError}>{vinError}</p> : null}
        {serviceError ? <p className={styles.inlineFieldError}>{serviceError}</p> : null}
        {formError ? <p className={styles.inlineFieldError}>{formError}</p> : null}
        {loaded && !canSubmit ? (
          <p className="text-[0.78rem] leading-snug text-zinc-400">
            {t.rich("noCreditsHint", {
              packs: (chunks) => (
                <Link href="/partneriem/konts/pakas" className="font-medium text-[#60a5fa] underline-offset-2 hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : null}

        <button type="submit" className={styles.liquidCta} disabled={!canSubmit}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{t("vinSubmit")}</span>
        </button>
      </form>
    </section>
  );
}
