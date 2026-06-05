"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import styles from "@/app/test-pricing/test-pricing.module.css";
import { useSiteTheme } from "@/components/providers/SiteThemeProvider";
import {
  TEST_PRICING_PLANS,
  type TestPricingFeatureItem,
  type TestPricingPlanConfig,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";

function FeatureRow({ item }: { item: TestPricingFeatureItem }) {
  if (item.kind === "exclusion") return null;

  if (item.kind === "includes") {
    return (
      <li className={styles.featureRow}>
        <span className={styles.featureIconBlue} aria-hidden>
          ✓
        </span>
        <span>
          Viss no{" "}
          <strong className={styles.featureBrand}>PROVIN {item.tierName}</strong>
        </span>
      </li>
    );
  }

  return (
    <li className={styles.featureRow}>
      <span className={styles.featureIcon} aria-hidden>
        ✔️
      </span>
      <span>{item.label}</span>
    </li>
  );
}

function PlanFeatures({ plan }: { plan: TestPricingPlanConfig }) {
  return (
    <ul className={styles.featureList}>
      {plan.features
        .filter((item) => item.kind !== "exclusion")
        .map((item) => (
          <FeatureRow key={featureRowKey(item)} item={item} />
        ))}
    </ul>
  );
}

function featureRowKey(item: TestPricingFeatureItem): string {
  if (item.kind === "includes") return `includes-${item.tierName}`;
  if (item.kind === "exclusion") return `exclusion-${item.label}`;
  return item.label;
}

export function TestPricingPage() {
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useSiteTheme();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<TestPricingPlanId | null>(null);

  const cancelled = searchParams.get("atcelts") === "1";

  const checkout = useCallback(async (planId: TestPricingPlanId) => {
    setGlobalError(null);
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/checkout/test-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, locale: "lv" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        errors?: string[];
      };
      if (!res.ok || !data.url) {
        throw new Error(data.errors?.[0] ?? data.error ?? "Neizdevās sākt maksājumu.");
      }
      window.location.href = data.url;
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Neizdevās sākt maksājumu.");
    } finally {
      setLoadingPlan(null);
    }
  }, []);

  const themeLabel = useMemo(() => (theme === "dark" ? "☀️ Gaišs" : "🌙 Tumšs"), [theme]);

  return (
    <div className={styles.page}>
      <button
        type="button"
        className={styles.themeFloat}
        onClick={toggleTheme}
        aria-label="Pārslēgt tēmu"
      >
        {themeLabel}
      </button>

      <div className={styles.pageInner}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Izvēlies audita paketi</h1>
          <p className={styles.pageLead}>
            Kompakta testa lapa — izvēlies paketi un turpini uz Stripe maksājumu.
          </p>
        </header>

        {cancelled ? (
          <p className={styles.cancelNote}>Maksājums tika atcelts. Vari mēģināt vēlreiz.</p>
        ) : null}
        {globalError ? <p className={styles.globalError}>{globalError}</p> : null}

        <div className={styles.grid}>
          {TEST_PRICING_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`${styles.card} ${plan.highlighted ? styles.cardPremium : ""}`}
            >
              {plan.highlighted ? (
                <span className={styles.badgePopular}>POPULĀRĀKĀ IZVĒLE</span>
              ) : null}

              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{plan.title}</h2>
                <p className={styles.cardPrice}>{plan.priceLabel}</p>
                <p className={styles.cardDesc}>{plan.description}</p>
                <div className={styles.featuresGrow}>
                  <PlanFeatures plan={plan} />
                </div>
              </div>

              <div className={styles.cardFooter}>
                <p className={styles.turnaround}>{plan.turnaround}</p>
                <div className={styles.ctaWrap}>
                  <button
                    type="button"
                    className={`${demoStyles.ctaButton} ${styles.ctaBtn}`}
                    disabled={loadingPlan !== null}
                    onClick={() => void checkout(plan.id)}
                  >
                    {loadingPlan === plan.id ? "Novirza uz Stripe…" : plan.ctaLabel}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
