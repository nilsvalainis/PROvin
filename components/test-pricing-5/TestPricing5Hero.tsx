"use client";

import { useMemo, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { TestPricingStep2Modal } from "@/components/test-pricing-shared/TestPricingStep2Modal";
import {
  getTp5ActiveBlockCount,
  getTp5BlockRows,
  TP5_FEATURE_BLOCKS,
  type Tp5BlockId,
  type Tp5DisplayRow,
  type Tp5FeatureBlock,
} from "@/lib/test-pricing-5-display";
import {
  TP5_CHECKOUT_SOURCE,
  TP5_HERO_SUBHEAD,
  TP5_HERO_TITLE_LINE_1,
  TP5_HERO_TITLE_LINE_2,
  TP5_PRICE_TAB_LABEL,
  TP5_TRUST_BADGE,
} from "@/lib/test-pricing-5-hero-copy";
import {
  getTestPricingPlan,
  TEST_PRICING_PLANS,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";
import {
  TEST_PRICING_TIER_ORDER,
  useTestPricingTierSwipe,
} from "@/lib/use-test-pricing-tier-swipe";

const TAB_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };
const ACCENT_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };
const ROW_SPRING = { type: "spring" as const, stiffness: 480, damping: 34, mass: 0.62 };

type ActiveRowEntry = { row: Tp5DisplayRow; blockId: Tp5BlockId };

function FeatureRow({
  row,
  index,
  reducedMotion,
  active,
  premiumHighlight,
}: {
  row: Tp5DisplayRow;
  index: number;
  reducedMotion: boolean;
  active: boolean;
  premiumHighlight?: boolean;
}) {
  const delay = reducedMotion ? 0 : index * 0.04;

  if (!active) {
    return (
      <li className={styles.featureRow}>
        <span className={`${styles.featureMark} ${styles.featureMarkMuted}`} aria-hidden>
          ✓
        </span>
        <span className={styles.featureLabelMuted}>{row.label}</span>
      </li>
    );
  }

  return (
    <motion.li
      className={`${styles.featureRow} ${premiumHighlight ? styles.featureRowPremium : ""}`}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ROW_SPRING, delay }}
    >
      <motion.span
        className={`${styles.featureMark} ${styles.featureMarkBlue}`}
        aria-hidden
        initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...ROW_SPRING, delay: Math.max(0, delay - 0.08) }}
      >
        ✓
      </motion.span>
      <motion.span
        className={
          premiumHighlight ? styles.featureLabelPremium : styles.featureLabelActive
        }
        initial={reducedMotion ? false : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...ROW_SPRING, delay: delay + 0.08 }}
      >
        {row.label}
      </motion.span>
    </motion.li>
  );
}

function InactiveGroup({
  block,
  onSelect,
  startIndex,
}: {
  block: Tp5FeatureBlock;
  onSelect: (tier: TestPricingPlanId) => void;
  startIndex: number;
}) {
  const rows = getTp5BlockRows(block.id);
  const priceLabel = TP5_PRICE_TAB_LABEL[block.unlockTier];

  return (
    <section
      className={styles.inactiveGroup}
      role="button"
      tabIndex={0}
      aria-label={`Izvēlēties ${priceLabel} paketi`}
      onClick={() => onSelect(block.unlockTier)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(block.unlockTier);
        }
      }}
    >
      <ul className={styles.featureList}>
        {rows.map((row, rowIndex) => (
          <FeatureRow
            key={row.id}
            row={row}
            index={startIndex + rowIndex}
            reducedMotion
            active={false}
          />
        ))}
      </ul>
    </section>
  );
}

export function TestPricing5Hero() {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<TestPricingPlanId>("premium");
  const [modalOpen, setModalOpen] = useState(false);

  const { onSwipeAreaTouchStart, onSwipeAreaTouchEnd } = useTestPricingTierSwipe(
    selectedId,
    setSelectedId,
  );

  const cancelled = searchParams.get("atcelts") === "1";
  const selectedPlan = useMemo(
    () => getTestPricingPlan(selectedId) ?? TEST_PRICING_PLANS[2],
    [selectedId],
  );

  const activeBlockCount = getTp5ActiveBlockCount(selectedId);
  const activeBlocks = TP5_FEATURE_BLOCKS.slice(0, activeBlockCount);
  const inactiveBlocks = TP5_FEATURE_BLOCKS.slice(activeBlockCount);

  const activeRowEntries: ActiveRowEntry[] = activeBlocks.flatMap((block) =>
    getTp5BlockRows(block.id).map((row) => ({ row, blockId: block.id })),
  );
  let inactiveRowOffset = activeRowEntries.length;
  const isPremiumTier = selectedId === "premium";

  return (
    <>
      <section className={styles.heroSurface} aria-labelledby="tp5-hero-title">
        <div className={styles.heroBackdrop} aria-hidden>
          <HeroVisual />
        </div>
        <div className={styles.heroScrim} aria-hidden />

        <div className={styles.heroInner}>
          {cancelled ? (
            <p className={styles.cancelNote}>Maksājums tika atcelts. Vari mēģināt vēlreiz.</p>
          ) : null}

          <header className={styles.heroCopy}>
            <h1 id="tp5-hero-title" className={styles.heroTitle}>
              <span className={styles.heroTitleLine}>{TP5_HERO_TITLE_LINE_1}</span>
              <span className={styles.heroTitleLine}>{TP5_HERO_TITLE_LINE_2}</span>
            </h1>
            <p className={styles.heroSubhead}>{TP5_HERO_SUBHEAD}</p>
          </header>

          <div className={styles.stage}>
            <article
              className={styles.spatialCard}
              onTouchStart={onSwipeAreaTouchStart}
              onTouchEnd={onSwipeAreaTouchEnd}
            >
              <LayoutGroup id="tp5-tabs">
                <div
                  className={styles.tierSwitcher}
                  role="tablist"
                  aria-label="Izvēlies audita cenu"
                >
                  {TEST_PRICING_TIER_ORDER.map((id) => {
                    const active = selectedId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={`${TP5_PRICE_TAB_LABEL[id]} audits`}
                        className={`${styles.tierTabBtn} ${active ? styles.tierTabBtnActive : styles.tierTabBtnInactive}`}
                        onClick={() => setSelectedId(id)}
                      >
                        {active ? (
                          <motion.span
                            layoutId="tp5-tab-pill"
                            className={styles.tierTabPill}
                            transition={TAB_TRANSITION}
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className={`${styles.tierTabLabel} ${active ? styles.tierTabLabelActive : styles.tierTabLabelInactive}`}
                        >
                          {TP5_PRICE_TAB_LABEL[id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>

              <div className={styles.featureStack}>
                <motion.div
                  className={styles.liquidAccent}
                  data-tier={selectedId}
                  layout
                  transition={ACCENT_TRANSITION}
                >
                  <ul className={styles.featureList}>
                    {activeRowEntries.map(({ row, blockId }, index) => (
                      <FeatureRow
                        key={`${selectedId}-${row.id}`}
                        row={row}
                        index={index}
                        reducedMotion={!!reducedMotion}
                        active
                        premiumHighlight={isPremiumTier && blockId === "premium"}
                      />
                    ))}
                  </ul>
                </motion.div>

                {inactiveBlocks.map((block) => {
                  const offset = inactiveRowOffset;
                  inactiveRowOffset += getTp5BlockRows(block.id).length;
                  return (
                    <InactiveGroup
                      key={block.id}
                      block={block}
                      onSelect={setSelectedId}
                      startIndex={offset}
                    />
                  );
                })}
              </div>

              <p className={styles.turnaround}>{selectedPlan.turnaround}</p>

              <div className={styles.ctaWrap}>
                <button
                  type="button"
                  className={styles.liquidCta}
                  onClick={() => setModalOpen(true)}
                >
                  <span className={styles.liquidCtaShimmer} aria-hidden />
                  <span className={styles.liquidCtaLabel}>{selectedPlan.heroCtaLabel}</span>
                </button>
                <p className={styles.trustBadge}>{TP5_TRUST_BADGE}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <TestPricingStep2Modal
        planId={selectedId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sourcePage={TP5_CHECKOUT_SOURCE}
      />
    </>
  );
}
