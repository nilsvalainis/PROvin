"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import styles from "@/app/test-pricing-2/test-pricing-2.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { TestPricing2Step2Modal } from "@/components/test-pricing-2/TestPricing2Step2Modal";
import {
  TEST_PRICING_PLANS,
  type TestPricingFeatureItem,
  type TestPricingPlanConfig,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";

const TIER_ORDER: TestPricingPlanId[] = ["mini", "plus", "premium"];

function tierTabLabel(plan: TestPricingPlanConfig): string {
  const short = plan.id === "mini" ? "MINI" : plan.id === "plus" ? "PLUS" : "PREMIUM";
  return `${short} — ${plan.priceLabel}`;
}

function FeatureRow({ item }: { item: TestPricingFeatureItem }) {
  if (item.kind === "includes") {
    return (
      <li className={styles.featureRow}>
        <span className={styles.featureIconBlue} aria-hidden>
          ✓
        </span>
        <span>
          Viss no <strong className={styles.featureBrand}>{item.packageName}</strong>
        </span>
      </li>
    );
  }

  return (
    <li className={styles.featureRow}>
      <span className={styles.featureIcon} aria-hidden>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </li>
  );
}

export function TestPricing2Hero() {
  const tHero = useTranslations("Hero");
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<TestPricingPlanId>("premium");
  const [modalOpen, setModalOpen] = useState(false);

  const cancelled = searchParams.get("atcelts") === "1";
  const selectedPlan = useMemo(
    () => TEST_PRICING_PLANS.find((p) => p.id === selectedId) ?? TEST_PRICING_PLANS[2],
    [selectedId],
  );

  const productSubhead = tHero("productSubheadRich");

  return (
    <>
      <section className={styles.heroSurface} aria-labelledby="tp2-hero-title">
        <div className={styles.heroBackdrop} aria-hidden>
          <div className={`${demoStyles.heroVisualWrap} ${demoStyles.heroVisualWrapAmbient}`}>
            <HeroVisual />
          </div>
        </div>
        <div className={styles.heroScrim} aria-hidden />

        <div className={styles.heroInner}>
          {cancelled ? (
            <p className={styles.cancelNote}>Maksājums tika atcelts. Vari mēģināt vēlreiz.</p>
          ) : null}

          <h1 id="tp2-hero-title" className={styles.heroTitle}>
            <span className={styles.heroTitleLine}>{tHero("productTitlePart1")}</span>
            <span className={styles.heroTitleLine}>
              {tHero("productTitlePart2")}
              {tHero("productTitlePart3")}
            </span>
          </h1>
          <p className={styles.heroSubhead}>{productSubhead}</p>

          <div className={styles.tierSwitcher} role="tablist" aria-label="Izvēlies audita paketi">
            {TIER_ORDER.map((id) => {
              const plan = TEST_PRICING_PLANS.find((p) => p.id === id)!;
              const active = selectedId === id;
              return (
                <div key={id} className={styles.tierTabWrap}>
                  {plan.highlighted ? (
                    <span className={styles.tierBadge} aria-hidden>
                      ⭐ POPULĀRĀKĀ
                    </span>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`${styles.tierTab} ${active ? styles.tierTabActive : ""}`}
                    onClick={() => setSelectedId(id)}
                  >
                    {tierTabLabel(plan)}
                  </button>
                </div>
              );
            })}
          </div>

          <div
            className={`${styles.tierPanel} ${selectedPlan.highlighted ? styles.tierPanelPremium : ""}`}
            role="tabpanel"
            aria-live="polite"
          >
            <p className={styles.panelDesc}>{selectedPlan.description}</p>
            <ul className={styles.featureList}>
              {selectedPlan.features.map((item) => (
                <FeatureRow
                  key={item.kind === "includes" ? item.packageName : item.label}
                  item={item}
                />
              ))}
            </ul>
            <p className={styles.turnaround}>{selectedPlan.turnaround}</p>
            <div className={styles.ctaWrap}>
              <button
                type="button"
                className={`${demoStyles.ctaButton} ${styles.ctaBtn}`}
                onClick={() => setModalOpen(true)}
              >
                {selectedPlan.heroCtaLabel}
              </button>
            </div>
          </div>
        </div>
      </section>

      <TestPricing2Step2Modal
        planId={selectedId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
