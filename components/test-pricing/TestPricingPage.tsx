"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import styles from "@/app/test-pricing/test-pricing.module.css";
import { useSiteTheme } from "@/components/providers/SiteThemeProvider";
import {
  TEST_PRICING_FEATURE_ROWS,
  TEST_PRICING_PLANS,
  validateTestPricingCheckout,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";
import { normalizeVin } from "@/lib/order-field-validation";

type ColumnState = {
  listingUrl: string;
  vin: string;
};

const initialColumnState = (): ColumnState => ({ listingUrl: "", vin: "" });

export function TestPricingPage() {
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useSiteTheme();
  const [consent, setConsent] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<TestPricingPlanId | null>(null);
  const [fields, setFields] = useState<Record<TestPricingPlanId, ColumnState>>({
    listing_filter: initialColumnState(),
    mini: initialColumnState(),
    premium: initialColumnState(),
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<TestPricingPlanId, { listingUrl?: string; vin?: string; consent?: string }>>
  >({});

  const cancelled = searchParams.get("atcelts") === "1";

  const updateField = useCallback(
    (planId: TestPricingPlanId, key: keyof ColumnState, value: string) => {
      setFields((prev) => ({
        ...prev,
        [planId]: { ...prev[planId], [key]: value },
      }));
      setFieldErrors((prev) => {
        const col = prev[planId];
        if (!col) return prev;
        const next = { ...col };
        if (key === "listingUrl") delete next.listingUrl;
        if (key === "vin") delete next.vin;
        return { ...prev, [planId]: next };
      });
    },
    [],
  );

  const checkout = useCallback(
    async (planId: TestPricingPlanId) => {
      const plan = TEST_PRICING_PLANS.find((p) => p.id === planId);
      if (!plan) return;
      const col = fields[planId];
      setGlobalError(null);
      const validation = validateTestPricingCheckout(plan, col.listingUrl, col.vin, consent);
      if (!validation.ok) {
        setFieldErrors((prev) => ({ ...prev, [planId]: validation.errors }));
        if (validation.errors.consent) {
          setGlobalError(validation.errors.consent);
        }
        return;
      }
      setFieldErrors((prev) => ({ ...prev, [planId]: {} }));
      setLoadingPlan(planId);
      try {
        const res = await fetch("/api/checkout/test-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            listingUrl: col.listingUrl.trim(),
            vin: normalizeVin(col.vin),
            locale: "lv",
            withdrawalConsent: consent,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; errors?: string[] };
        if (!res.ok || !data.url) {
          throw new Error(data.errors?.[0] ?? data.error ?? "Neizdevās sākt maksājumu.");
        }
        window.location.href = data.url;
      } catch (e) {
        setGlobalError(e instanceof Error ? e.message : "Neizdevās sākt maksājumu.");
      } finally {
        setLoadingPlan(null);
      }
    },
    [consent, fields],
  );

  const themeLabel = useMemo(() => (theme === "dark" ? "Gaišs" : "Tumšs"), [theme]);

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.topBar}>
          <p className={styles.brand}>PROVIN.LV — testa cenas</p>
          <div className={styles.topActions}>
            <button type="button" className={styles.themeBtn} onClick={toggleTheme}>
              {themeLabel}
            </button>
            <Link href="/lv" className={styles.ghostLink}>
              Sākums
            </Link>
          </div>
        </header>

        <h1 className={styles.pageTitle}>Izvēlies audita paketi</h1>
        <p className={styles.pageLead}>
          Izolēta testa lapa — neskar galvenās lapas hero formu. Pēc apmaksas Stripe savāc e-pastu un tālruni.
        </p>

        {cancelled ? (
          <p className={styles.cancelNote}>Maksājums tika atcelts. Vari mēģināt vēlreiz.</p>
        ) : null}
        {globalError ? <p className={styles.globalError}>{globalError}</p> : null}

        <div className={styles.grid}>
          {TEST_PRICING_PLANS.map((plan) => {
            const col = fields[plan.id];
            const errs = fieldErrors[plan.id];
            const isPremium = plan.id === "premium";
            const ctaClass = isPremium
              ? `${demoStyles.ctaButton} w-full !mt-0 !max-w-none`
              : `${demoStyles.ctaButtonSecondary} w-full !mt-0 !max-w-none`;

            return (
              <article
                key={plan.id}
                className={`${styles.card} ${isPremium ? styles.cardPremium : ""}`}
              >
                {isPremium ? <span className={styles.badgePopular}>POPULĀRĀKĀ IZVĒLE</span> : null}
                <h2 className={styles.cardTitle}>{plan.title}</h2>
                <p className={styles.cardPrice}>{plan.priceLabel}</p>
                <p className={styles.cardDesc}>{plan.description}</p>

                <ul className={styles.featureList}>
                  {TEST_PRICING_FEATURE_ROWS.map((row) => {
                    const on = plan.features[row.id];
                    return (
                      <li key={row.id} className={styles.featureRow}>
                        <span className={styles.featureIcon} aria-hidden>
                          {on ? "✔️" : "❌"}
                        </span>
                        <span className={on ? undefined : styles.featureOff}>{row.label}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className={styles.inputsBlock}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor={`${plan.id}-listing`}>
                      Sludinājuma saite
                    </label>
                    <input
                      id={`${plan.id}-listing`}
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      placeholder="Iekopē linku..."
                      className={`${styles.fieldInput} ${errs?.listingUrl ? styles.fieldInputError : ""}`}
                      value={col.listingUrl}
                      onChange={(e) => updateField(plan.id, "listingUrl", e.target.value)}
                    />
                    {errs?.listingUrl ? <p className={styles.fieldError}>{errs.listingUrl}</p> : null}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor={`${plan.id}-vin`}>
                      VIN numurs
                      {plan.vinRequired ? (
                        <span className="normal-case tracking-normal text-[#f87171]"> *</span>
                      ) : null}
                    </label>
                    <input
                      id={`${plan.id}-vin`}
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={17}
                      placeholder={plan.vinPlaceholder}
                      className={`${styles.fieldInput} ${errs?.vin ? styles.fieldInputError : ""}`}
                      value={col.vin}
                      onChange={(e) => updateField(plan.id, "vin", e.target.value.toUpperCase())}
                    />
                    {errs?.vin ? <p className={styles.fieldError}>{errs.vin}</p> : null}
                  </div>
                </div>

                <p className={styles.turnaround}>{plan.turnaround}</p>

                <div className={styles.ctaWrap}>
                  <button
                    type="button"
                    className={ctaClass}
                    disabled={loadingPlan !== null}
                    onClick={() => void checkout(plan.id)}
                  >
                    {loadingPlan === plan.id ? "Novirza uz Stripe…" : plan.ctaLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.consentBlock}>
          <label className={styles.consentRow}>
            <input
              type="checkbox"
              className={styles.consentCheckbox}
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setGlobalError(null);
              }}
            />
            <span className={styles.consentText}>
              Apstiprinu{" "}
              <Link href="/lv/lietosanas-noteikumi" target="_blank" rel="noopener noreferrer">
                lietošanas noteikumus
              </Link>
              ,{" "}
              <Link href="/lv/privatuma-politika" target="_blank" rel="noopener noreferrer">
                privātuma politiku
              </Link>{" "}
              un piekrītu digitālā satura tūlītējai izpildei (atteikuma tiesību zaudēšana).
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
