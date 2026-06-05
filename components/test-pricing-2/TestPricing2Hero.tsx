"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import styles from "@/app/test-pricing-2/test-pricing-2.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { TestPricing2Step2Modal } from "@/components/test-pricing-2/TestPricing2Step2Modal";
import {
  TEST_PRICING_PLANS,
  type TestPricingFeatureItem,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";

const TIER_ORDER: TestPricingPlanId[] = ["mini", "plus", "premium"];
const TIER_TAB_LABEL: Record<TestPricingPlanId, string> = {
  mini: "MINI",
  plus: "PLUS",
  premium: "PREMIUM",
};
const SWIPE_THRESHOLD_PX = 48;

function featureRowKey(item: TestPricingFeatureItem): string {
  if (item.kind === "includes") return `includes-${item.tierName}`;
  return item.label;
}

function FeatureRow({ item }: { item: TestPricingFeatureItem }) {
  if (item.kind === "exclusion") {
    return (
      <li className={`${styles.featureRow} ${styles.featureRowExclusion}`}>
        <span className={`${styles.featureMark} ${styles.featureMarkCross}`} aria-hidden>
          ✕
        </span>
        <span>{item.label}</span>
      </li>
    );
  }

  if (item.kind === "includes") {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkBlue}`} aria-hidden>
          ✔
        </span>
        <span>
          Viss no <strong className={styles.featureBrand}>{item.tierName}</strong>
        </span>
      </li>
    );
  }

  return (
    <li className={styles.featureRow}>
      <span className={styles.featureMark} aria-hidden>
        ✔
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
  const touchStartX = useRef<number | null>(null);

  const cancelled = searchParams.get("atcelts") === "1";
  const selectedPlan = useMemo(
    () => TEST_PRICING_PLANS.find((p) => p.id === selectedId) ?? TEST_PRICING_PLANS[2],
    [selectedId],
  );

  const selectTierByOffset = useCallback((offset: -1 | 1) => {
    setSelectedId((current) => {
      const idx = TIER_ORDER.indexOf(current);
      const next = idx + offset;
      if (next < 0 || next >= TIER_ORDER.length) return current;
      return TIER_ORDER[next];
    });
  }, []);

  const onSwipeAreaTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }, []);

  const onSwipeAreaTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const endX = e.changedTouches[0]?.clientX;
      if (endX === undefined) return;
      const delta = endX - touchStartX.current;
      if (delta <= -SWIPE_THRESHOLD_PX) selectTierByOffset(1);
      else if (delta >= SWIPE_THRESHOLD_PX) selectTierByOffset(-1);
      touchStartX.current = null;
    },
    [selectTierByOffset],
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
              const active = selectedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${styles.tierTab} ${active ? styles.tierTabActive : ""}`}
                  onClick={() => setSelectedId(id)}
                >
                  {TIER_TAB_LABEL[id]}
                </button>
              );
            })}
          </div>

          <div
            className={`${styles.tierPanel} ${styles.tierPanelSwipe} ${selectedPlan.highlighted ? styles.tierPanelPremium : ""}`}
            role="tabpanel"
            aria-live="polite"
            onTouchStart={onSwipeAreaTouchStart}
            onTouchEnd={onSwipeAreaTouchEnd}
          >
            <p className={styles.panelDesc}>{selectedPlan.description}</p>
            <ul className={styles.featureList}>
              {selectedPlan.features.map((item) => (
                <FeatureRow key={featureRowKey(item)} item={item} />
              ))}
            </ul>
            <p className={styles.turnaround}>{selectedPlan.turnaround}</p>
            <div className={styles.ctaWrap}>
              <button
                type="button"
                className={`${demoStyles.ctaButton} ${styles.ctaBtn} ${selectedPlan.highlighted ? styles.ctaBtnPremium : ""}`}
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
