"use client";

import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import {
  getTp5ActiveBlockCount,
  getTp5BlockRows,
  TP5_FEATURE_BLOCKS,
  type Tp5DisplayRow,
} from "@/lib/test-pricing-5-display";
import { TP5_CTA_LABEL, TP5_TIER_META } from "@/lib/test-pricing-5-checkout-routing";
import { getTestPricingPlan, type TestPricingPlanId } from "@/lib/test-pricing-plans";
import { TEST_PRICING_TIER_ORDER } from "@/lib/use-test-pricing-tier-swipe";

function DesktopFeatureRow({ row, active }: { row: Tp5DisplayRow; active: boolean }) {
  const label = row.footnoteMark ? `${row.label}*` : row.label;

  if (!active) {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkCross}`} aria-hidden>
          ✕
        </span>
        <span className={styles.featureLabelMuted}>{label}</span>
      </li>
    );
  }

  return (
    <li className={styles.featureRow}>
      <span className={`${styles.featureMark} ${styles.featureMarkBlue}`} aria-hidden>
        ✓
      </span>
      <span className={styles.featureLabelActive}>{label}</span>
    </li>
  );
}

function getTierFeatureLayout(planId: TestPricingPlanId) {
  const activeBlockCount = getTp5ActiveBlockCount(planId);
  const activeBlocks = TP5_FEATURE_BLOCKS.slice(0, activeBlockCount);
  const inactiveBlocks = TP5_FEATURE_BLOCKS.slice(activeBlockCount);
  const activeRowEntries = activeBlocks.flatMap((block) =>
    getTp5BlockRows(block.id).map((row) => ({ row, blockId: block.id })),
  );
  return { activeRowEntries, inactiveBlocks };
}

type TestPricing5DesktopPricingGridProps = {
  onOpenCheckout: (planId: TestPricingPlanId) => void;
};

export function TestPricing5DesktopPricingGrid({ onOpenCheckout }: TestPricing5DesktopPricingGridProps) {
  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:max-w-7xl lg:mx-auto lg:px-8 lg:mt-12 lg:items-stretch">
      {TEST_PRICING_TIER_ORDER.map((planId) => {
        const tierMeta = TP5_TIER_META[planId];
        const { activeRowEntries, inactiveBlocks } = getTierFeatureLayout(planId);

        if (!getTestPricingPlan(planId)) return null;

        return (
          <article
            key={planId}
            className={`${styles.spatialCard} lg:h-full lg:flex lg:flex-col lg:justify-between`}
          >
            <div className={styles.cardHeader}>
              <div className={styles.tierMeta} aria-live="polite">
                <p className={styles.tierMetaTitle}>{tierMeta.title}</p>
                <p
                  className={`${styles.tierMetaDesc} lg:line-clamp-none lg:block lg:overflow-visible`}
                >
                  {tierMeta.description}
                </p>
              </div>
            </div>

            <div className={`${styles.featureStack} lg:flex-1`}>
              {activeRowEntries.length > 0 ? (
                <div className={styles.liquidAccent} data-tier={planId}>
                  <ul className={styles.featureList}>
                    {activeRowEntries.map(({ row }) => (
                      <DesktopFeatureRow key={`${planId}-active-${row.id}`} row={row} active />
                    ))}
                  </ul>
                </div>
              ) : null}

              {inactiveBlocks.map((block) => (
                <div
                  key={block.id}
                  className={`${styles.inactiveGroup} lg:pointer-events-none lg:cursor-default`}
                >
                  <ul className={styles.featureList}>
                    {getTp5BlockRows(block.id).map((row) => (
                      <DesktopFeatureRow key={`${planId}-inactive-${row.id}`} row={row} active={false} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className={styles.ctaWrap}>
              <button
                type="button"
                className={styles.liquidCta}
                onClick={() => onOpenCheckout(planId)}
              >
                <span className={styles.liquidCtaShimmer} aria-hidden />
                <span className={styles.liquidCtaLabel}>{TP5_CTA_LABEL[planId]}</span>
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
