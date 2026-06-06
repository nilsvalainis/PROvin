"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import styles from "@/app/test-pricing-4/test-pricing-4.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { TestPricingStep2Modal } from "@/components/test-pricing-shared/TestPricingStep2Modal";
import { TestPricing4CompareSheet } from "@/components/test-pricing-4/TestPricing4CompareSheet";
import { TEST_PRICING_STACK_BLOCKS } from "@/lib/test-pricing-stack-blocks";
import {
  getTestPricingPlan,
  TEST_PRICING_PLANS,
  type TestPricingFeatureItem,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";

const PREMIUM_BLOCK = TEST_PRICING_STACK_BLOCKS.find((b) => b.id === "premium")!;

function HeroFeatureRows({ planId }: { planId: TestPricingPlanId }) {
  const plan = getTestPricingPlan(planId)!;

  if (planId === "premium") {
    return (
      <ul className={styles.featureList}>
        {PREMIUM_BLOCK.items.map((label) => (
          <li key={label} className={styles.featureRow}>
            <span className={styles.featureMark} aria-hidden>
              ✔
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={styles.featureList}>
      {plan.features
        .filter((item): item is Exclude<TestPricingFeatureItem, { kind: "exclusion" }> => item.kind !== "exclusion")
        .map((item) => {
          if (item.kind === "includes") {
            return (
              <li key={item.tierName} className={styles.featureRow}>
                <span className={`${styles.featureMark} ${styles.featureMarkBlue}`} aria-hidden>
                  ✔
                </span>
                <span>
                  Viss no <strong className={styles.featureBrand}>PROVIN {item.tierName}</strong>
                </span>
              </li>
            );
          }
          return (
            <li key={item.label} className={styles.featureRow}>
              <span className={styles.featureMark} aria-hidden>
                ✔
              </span>
              <span>{item.label}</span>
            </li>
          );
        })}
    </ul>
  );
}

export function TestPricing4Hero() {
  const tHero = useTranslations("Hero");
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<TestPricingPlanId>("premium");
  const [modalOpen, setModalOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const cancelled = searchParams.get("atcelts") === "1";
  const selectedPlan = getTestPricingPlan(selectedId) ?? TEST_PRICING_PLANS[2];
  const isPremiumDefault = selectedId === "premium";

  useEffect(() => {
    if (!compareOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [compareOpen]);

  return (
    <>
      <section className={styles.heroSurface} aria-labelledby="tp4-hero-title">
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

          <h1 id="tp4-hero-title" className={styles.heroTitle}>
            <span className={styles.heroTitleLine}>{tHero("productTitlePart1")}</span>
            <span className={styles.heroTitleLine}>
              {tHero("productTitlePart2")}
              {tHero("productTitlePart3")}
            </span>
          </h1>
          <p className={styles.heroSubhead}>{tHero("productSubheadRich")}</p>

          <article className={`${styles.heroCard} ${isPremiumDefault ? styles.heroCardPremium : ""}`}>
            <div className={styles.heroCardHead}>
              <p className={styles.heroCardTier}>{selectedPlan.title}</p>
              <p className={styles.heroCardPrice}>{selectedPlan.priceLabel}</p>
            </div>
            <p className={styles.panelDesc}>{selectedPlan.description}</p>

            <HeroFeatureRows planId={selectedId} />

            <p className={styles.turnaround}>{selectedPlan.turnaround}</p>

            <button
              type="button"
              className={styles.compareTrigger}
              onClick={() => setCompareOpen(true)}
            >
              Salīdzināt ar MINI un PLUS paketēm <span aria-hidden>▾</span>
            </button>

            <div className={styles.ctaWrap}>
              <button
                type="button"
                className={`${demoStyles.ctaButton} ${styles.ctaBtn} ${styles.ctaBtnGlow}`}
                onClick={() => setModalOpen(true)}
              >
                {selectedPlan.heroCtaLabel}
              </button>
            </div>
          </article>
        </div>
      </section>

      <TestPricing4CompareSheet
        open={compareOpen}
        activePlanId={selectedId}
        onClose={() => setCompareOpen(false)}
        onSelectPlan={(id) => {
          setSelectedId(id);
          setCompareOpen(false);
        }}
      />

      <TestPricingStep2Modal
        planId={selectedId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sourcePage="test-pricing-4"
      />
    </>
  );
}
