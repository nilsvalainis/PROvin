"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import styles from "@/app/test-pricing-3/test-pricing-3.module.css";
import { HeroVisual } from "@/components/HeroVisual";
import { TestPricingStep2Modal } from "@/components/test-pricing-shared/TestPricingStep2Modal";
import {
  TEST_PRICING_STACK_BLOCKS,
  getStackBlocksViewState,
  type StackFeatureBlock,
} from "@/lib/test-pricing-stack-blocks";
import {
  TEST_PRICING_PLANS,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";
import {
  TEST_PRICING_TIER_ORDER,
  useTestPricingTierSwipe,
} from "@/lib/use-test-pricing-tier-swipe";

const TIER_TAB_LABEL: Record<TestPricingPlanId, string> = {
  mini: "MINI",
  plus: "PLUS",
  premium: "PREMIUM",
};

function StackBlock({
  block,
  state,
  showWarning,
  warningText,
}: {
  block: StackFeatureBlock;
  state: "active" | "faded";
  showWarning?: boolean;
  warningText?: string;
}) {
  const faded = state === "faded";

  return (
    <div className={`${styles.stackBlock} ${faded ? styles.stackBlockFaded : styles.stackBlockActive}`}>
      <p className={styles.stackBlockTitle}>{block.title}</p>
      <ul className={styles.featureList}>
        {block.items.map((label) => (
          <li key={label} className={styles.featureRow}>
            <span className={styles.featureMark} aria-hidden>
              ✔
            </span>
            <span className={faded ? styles.featureLabelFaded : undefined}>{label}</span>
          </li>
        ))}
      </ul>
      {showWarning && warningText ? (
        <p className={styles.blockWarning}>
          <span className={styles.featureMarkCross} aria-hidden>
            ✕
          </span>
          {warningText}
        </p>
      ) : null}
    </div>
  );
}

export function TestPricing3Hero() {
  const tHero = useTranslations("Hero");
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<TestPricingPlanId>("premium");
  const [modalOpen, setModalOpen] = useState(false);

  const { onSwipeAreaTouchStart, onSwipeAreaTouchEnd } = useTestPricingTierSwipe(
    selectedId,
    setSelectedId,
  );

  const cancelled = searchParams.get("atcelts") === "1";
  const selectedPlan = useMemo(
    () => TEST_PRICING_PLANS.find((p) => p.id === selectedId) ?? TEST_PRICING_PLANS[2],
    [selectedId],
  );
  const viewState = getStackBlocksViewState(selectedId);

  return (
    <>
      <section className={styles.heroSurface} aria-labelledby="tp3-hero-title">
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

          <h1 id="tp3-hero-title" className={styles.heroTitle}>
            <span className={styles.heroTitleLine}>{tHero("productTitlePart1")}</span>
            <span className={styles.heroTitleLine}>
              {tHero("productTitlePart2")}
              {tHero("productTitlePart3")}
            </span>
          </h1>
          <p className={styles.heroSubhead}>{tHero("productSubheadRich")}</p>

          <div className={styles.tierSwitcher} role="tablist" aria-label="Izvēlies audita paketi">
            {TEST_PRICING_TIER_ORDER.map((id) => {
              const active = selectedId === id;
              return (
                <div key={id} className={styles.tierTabWrap}>
                  {id === "premium" ? (
                    <span className={styles.tierBadge} aria-hidden>
                      ⭐
                    </span>
                  ) : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`${styles.tierTab} ${active ? styles.tierTabActive : ""}`}
                    onClick={() => setSelectedId(id)}
                  >
                    {TIER_TAB_LABEL[id]}
                  </button>
                </div>
              );
            })}
          </div>

          <div
            className={`${styles.tierPanel} ${styles.tierPanelSwipe}`}
            role="tabpanel"
            aria-live="polite"
            onTouchStart={onSwipeAreaTouchStart}
            onTouchEnd={onSwipeAreaTouchEnd}
          >
            <p className={styles.panelDesc}>{selectedPlan.description}</p>

            <div className={styles.stackList}>
              {TEST_PRICING_STACK_BLOCKS.map((block) => {
                const blockState = viewState[block.id];
                const showWarning =
                  viewState.warningAfterBlock === block.id && Boolean(viewState.warningText);
                return (
                  <StackBlock
                    key={block.id}
                    block={block}
                    state={blockState}
                    showWarning={showWarning}
                    warningText={viewState.warningText}
                  />
                );
              })}
            </div>

            <p className={styles.turnaround}>{selectedPlan.turnaround}</p>
            <div className={styles.ctaWrap}>
              <button
                type="button"
                className={`${demoStyles.ctaButton} ${styles.ctaBtn} ${selectedPlan.highlighted ? styles.ctaBtnGlow : ""}`}
                onClick={() => setModalOpen(true)}
              >
                {selectedPlan.heroCtaLabel}
              </button>
            </div>
          </div>
        </div>
      </section>

      <TestPricingStep2Modal
        planId={selectedId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sourcePage="test-pricing-3"
      />
    </>
  );
}
