"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { PremiumLockIcon } from "@/components/test-pricing-5/PremiumLockIcon";
import { TestPricingStep2Modal } from "@/components/test-pricing-shared/TestPricingStep2Modal";
import {
  getTp5BlockRows,
  isTp5BlockLocked,
  TP5_FEATURE_BLOCKS,
  type Tp5BlockId,
  type Tp5DisplayRow,
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
}: {
  row: Tp5DisplayRow;
  index: number;
  reducedMotion: boolean;
}) {
  const delay = reducedMotion ? 0 : index * 0.045;

  if (row.kind === "inherit") {
    return (
      <motion.li
        className={styles.featureRow}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
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
          ✔
        </motion.span>
        <motion.span
          initial={reducedMotion ? false : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...ROW_SPRING, delay: delay + 0.08 }}
        >
          Viss no <strong className={styles.featureBrand}>{row.tierName}</strong>
        </motion.span>
      </motion.li>
    );
  }

  return (
    <motion.li
      className={styles.featureRow}
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...ROW_SPRING, delay }}
    >
      <motion.span
        className={styles.featureMark}
        aria-hidden
        initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...ROW_SPRING, delay: Math.max(0, delay - 0.08) }}
      >
        ✔
      </motion.span>
      <motion.span
        initial={reducedMotion ? false : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...ROW_SPRING, delay: delay + 0.08 }}
      >
        {row.label}
      </motion.span>
    </motion.li>
  );
}

function LockedBlockOverlay({
  unlocking,
  onUnlock,
  blockTitle,
}: {
  unlocking: boolean;
  onUnlock: () => void;
  blockTitle: string;
}) {
  return (
    <motion.button
      type="button"
      className={styles.refractOverlay}
      aria-label={`Atbloķēt ${blockTitle} paketi`}
      onClick={onUnlock}
      initial={false}
      animate={{
        backdropFilter: unlocking ? "blur(0px) saturate(100%)" : "blur(12px) saturate(180%)",
        scale: unlocking ? 1 : 1.012,
      }}
      transition={{ type: "spring", stiffness: 560, damping: 34 }}
    >
      <div className={styles.refractLens} aria-hidden />
      <div className={styles.lockCenter}>
        <PremiumLockIcon unlocked={false} unlocking={unlocking} />
      </div>
    </motion.button>
  );
}

export function TestPricing5Hero() {
  const tHero = useTranslations("Hero");
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<TestPricingPlanId>("premium");
  const [unlockingBlock, setUnlockingBlock] = useState<Tp5BlockId | null>(null);
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

  const isPremium = selectedId === "premium";

  const unlockBlock = useCallback(
    (blockId: Tp5BlockId) => {
      const block = TP5_FEATURE_BLOCKS.find((b) => b.id === blockId);
      if (!block || !isTp5BlockLocked(blockId, selectedId)) return;

      setUnlockingBlock(blockId);
      window.setTimeout(() => {
        setSelectedId(block.unlockTier);
        setUnlockingBlock(null);
      }, reducedMotion ? 0 : 320);
    },
    [reducedMotion, selectedId],
  );

  return (
    <>
      <section
        className={`${styles.heroSurface} ${isPremium ? styles.heroSurfacePremium : ""}`}
        aria-labelledby="tp5-hero-title"
      >
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
            <motion.article
              className={`${styles.spatialCard} ${isPremium ? styles.spatialCardElevated : styles.spatialCardRecessed}`}
              layout
              transition={SPRING}
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
                        className={styles.tierTabBtn}
                        onClick={() => setSelectedId(id)}
                      >
                        {active ? (
                          <motion.span
                            layoutId="tp5-tab-pill"
                            className={styles.tierTabPill}
                            transition={SPRING}
                          />
                        ) : null}
                        <span className={styles.tierTabLabel}>
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
                <AnimatePresence mode="popLayout" initial={false}>
                  {TP5_FEATURE_BLOCKS.map((block, blockIndex) => {
                    const locked = isTp5BlockLocked(block.id, selectedId);
                    const rows = getTp5BlockRows(block.id, selectedId);
                    const unlocking = unlockingBlock === block.id;

                    return (
                      <motion.section
                        key={block.id}
                        className={`${styles.stackBlock} ${locked ? styles.stackBlockLocked : styles.stackBlockOpen}`}
                        layout
                        transition={SPRING}
                      >
                        <p className={styles.stackBlockTitle}>{block.title}</p>
                        <div className={styles.stackBlockBody}>
                          <ul className={styles.featureList}>
                            {rows.map((row, rowIndex) => (
                              <FeatureRow
                                key={`${selectedId}-${row.id}`}
                                row={row}
                                index={blockIndex * 4 + rowIndex}
                                reducedMotion={!!reducedMotion}
                              />
                            ))}
                          </ul>
                          {locked ? (
                            <LockedBlockOverlay
                              blockTitle={block.title}
                              unlocking={unlocking}
                              onUnlock={() => unlockBlock(block.id)}
                            />
                          ) : null}
                        </div>
                      </motion.section>
                    );
                  })}
                </AnimatePresence>
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
            </motion.article>
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
