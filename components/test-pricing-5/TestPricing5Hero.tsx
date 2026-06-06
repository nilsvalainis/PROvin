"use client";

import { useMemo, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { TestPricingStep2Modal } from "@/components/test-pricing-shared/TestPricingStep2Modal";
import {
  getTp5ActiveBlockCount,
  getTp5BlockRows,
  TP5_FEATURE_BLOCKS,
  type Tp5DisplayRow,
  type Tp5FeatureBlock,
} from "@/lib/test-pricing-5-display";
import {
  getTestPricingPlan,
  TEST_PRICING_PLANS,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";
import {
  TEST_PRICING_TIER_ORDER,
  useTestPricingTierSwipe,
} from "@/lib/use-test-pricing-tier-swipe";

const TIER_LABEL: Record<TestPricingPlanId, string> = {
  mini: "MINI",
  plus: "PLUS",
  premium: "PREMIUM",
};

const SPRING = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.72 };
const ROW_SPRING = { type: "spring" as const, stiffness: 480, damping: 34, mass: 0.62 };

function FeatureRow({
  row,
  index,
  reducedMotion,
  active,
}: {
  row: Tp5DisplayRow;
  index: number;
  reducedMotion: boolean;
  active: boolean;
}) {
  const delay = reducedMotion ? 0 : index * 0.045;

  return (
    <motion.li
      className={styles.featureRow}
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ROW_SPRING, delay }}
    >
      <motion.span
        className={`${styles.featureMark} ${active ? styles.featureMarkBlue : styles.featureMarkMuted}`}
        aria-hidden
        initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...ROW_SPRING, delay: Math.max(0, delay - 0.08) }}
      >
        ✓
      </motion.span>
      <motion.span
        className={active ? styles.featureLabelActive : styles.featureLabelMuted}
        initial={reducedMotion ? false : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...ROW_SPRING, delay: delay + 0.08 }}
      >
        {row.label}
      </motion.span>
    </motion.li>
  );
}

function ActiveBlock({
  block,
  blockIndex,
  reducedMotion,
  tierKey,
}: {
  block: Tp5FeatureBlock;
  blockIndex: number;
  reducedMotion: boolean;
  tierKey: TestPricingPlanId;
}) {
  const rows = getTp5BlockRows(block.id);

  return (
    <section className={styles.fusionBlock}>
      <p className={styles.fusionBlockTitle}>{block.title}</p>
      <ul className={styles.featureList}>
        {rows.map((row, rowIndex) => (
          <FeatureRow
            key={`${tierKey}-${row.id}`}
            row={row}
            index={blockIndex * 4 + rowIndex}
            reducedMotion={reducedMotion}
            active
          />
        ))}
      </ul>
    </section>
  );
}

function InactiveBlock({
  block,
  onSelect,
}: {
  block: Tp5FeatureBlock;
  onSelect: (tier: TestPricingPlanId) => void;
}) {
  const rows = getTp5BlockRows(block.id);

  return (
    <section
      className={styles.stackBlockInactive}
      role="button"
      tabIndex={0}
      aria-label={`Izvēlēties ${block.title} paketi`}
      onClick={() => onSelect(block.unlockTier)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(block.unlockTier);
        }
      }}
    >
      <p className={styles.fusionBlockTitleMuted}>{block.title}</p>
      <ul className={styles.featureList}>
        {rows.map((row) => (
          <li key={row.id} className={styles.featureRow}>
            <span className={`${styles.featureMark} ${styles.featureMarkMuted}`} aria-hidden>
              ✓
            </span>
            <span className={styles.featureLabelMuted}>{row.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TestPricing5Hero() {
  const tHero = useTranslations("Hero");
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

          <h1 id="tp5-hero-title" className={styles.heroTitle}>
            <span className={styles.heroTitleLine}>{tHero("productTitlePart1")}</span>
            <span className={styles.heroTitleLine}>
              {tHero("productTitlePart2")}
              {tHero("productTitlePart3")}
            </span>
          </h1>
          <p className={styles.heroSubhead}>{tHero("productSubheadRich")}</p>

          <div className={styles.stage}>
            <article
              className={styles.spatialCard}
              onTouchStart={onSwipeAreaTouchStart}
              onTouchEnd={onSwipeAreaTouchEnd}
            >
              <LayoutGroup id="tp5-tabs">
                <div className={styles.tierSwitcher} role="tablist" aria-label="Izvēlies audita paketi">
                  {TEST_PRICING_TIER_ORDER.map((id) => {
                    const active = selectedId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`${styles.tierTabBtn} ${active ? styles.tierTabBtnActive : styles.tierTabBtnInactive}`}
                        onClick={() => setSelectedId(id)}
                      >
                        {active ? (
                          <motion.span
                            layoutId="tp5-tab-pill"
                            className={styles.tierTabPill}
                            transition={SPRING}
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className={`${styles.tierTabLabel} ${active ? styles.tierTabLabelActive : styles.tierTabLabelInactive}`}
                        >
                          {TIER_LABEL[id]}
                          {id === "premium" ? (
                            <span className={styles.tierStar} aria-hidden>
                              {" "}
                              ★
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>

              <p className={styles.panelDesc}>{selectedPlan.description}</p>

              <div className={styles.stackList}>
                <motion.div
                  className={styles.fusionFrame}
                  data-tier={selectedId}
                  layout
                  transition={SPRING}
                >
                  {activeBlocks.map((block, blockIndex) => (
                    <ActiveBlock
                      key={block.id}
                      block={block}
                      blockIndex={blockIndex}
                      reducedMotion={!!reducedMotion}
                      tierKey={selectedId}
                    />
                  ))}
                </motion.div>

                {inactiveBlocks.map((block) => (
                  <InactiveBlock key={block.id} block={block} onSelect={setSelectedId} />
                ))}
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
              </div>
            </article>
          </div>
        </div>
      </section>

      <TestPricingStep2Modal
        planId={selectedId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sourcePage="test-pricing-5"
      />
    </>
  );
}
