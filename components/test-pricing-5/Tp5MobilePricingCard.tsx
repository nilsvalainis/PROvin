"use client";

import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { type SyntheticEvent, type TouchEvent } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import type { Tp5DisplayRow } from "@/lib/test-pricing-5-display";
import { TP5_DEALER_FOOTNOTE } from "@/lib/test-pricing-5-checkout-routing";
import type { Tp5InlineFieldErrors } from "@/lib/test-pricing-5-inline-checkout";
import {
  getTp5MobileFeatureLayout,
  TP5_MOBILE_CTA_LABEL,
  TP5_MOBILE_TAB_LABEL,
  TP5_MOBILE_TIER_META,
  TP5_MOBILE_TIER_ORDER,
  TP5_MOBILE_TURNAROUND,
  type Tp5MobileTierId,
} from "@/lib/test-pricing-5-mobile";

const TAB_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };
const ROW_SPRING = { type: "spring" as const, stiffness: 480, damping: 34, mass: 0.62 };

function MobileFeatureRow({
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
  const delay = reducedMotion ? 0 : index * 0.04;
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
    <motion.li
      className={styles.featureRow}
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
        className={styles.featureLabelActive}
        initial={reducedMotion ? false : { opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...ROW_SPRING, delay: delay + 0.08 }}
      >
        {label}
      </motion.span>
    </motion.li>
  );
}

type Tp5MobilePricingCardProps = {
  selectedId: Tp5MobileTierId;
  setSelectedId: (id: Tp5MobileTierId) => void;
  vin: string;
  listingUrl: string;
  errors: Tp5InlineFieldErrors;
  globalError: string | null;
  loading: boolean;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  onSubmit: () => void;
  onSwipeAreaTouchStart: (event: TouchEvent) => void;
  onSwipeAreaTouchEnd: (event: TouchEvent) => void;
  stopSwipePropagation: (event: SyntheticEvent) => void;
};

export function Tp5MobilePricingCard({
  selectedId,
  setSelectedId,
  vin,
  listingUrl,
  errors,
  globalError,
  loading,
  onVinChange,
  onListingUrlChange,
  onSubmit,
  onSwipeAreaTouchStart,
  onSwipeAreaTouchEnd,
  stopSwipePropagation,
}: Tp5MobilePricingCardProps) {
  const reducedMotion = useReducedMotion();
  const tierMeta = TP5_MOBILE_TIER_META[selectedId];
  const { activeRows, inactiveRows } = getTp5MobileFeatureLayout(selectedId);

  return (
    <article className={`${styles.spatialCard} w-full`}>
      <div className={styles.cardHeader}>
        <LayoutGroup id="tp5-tabs-mobile">
          <div
            className={`${styles.tierSwitcher} ${styles.tierSwitcherTwo}`}
            role="tablist"
            aria-label="Izvēlies audita paketi"
          >
            {TP5_MOBILE_TIER_ORDER.map((id) => {
              const active = selectedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${TP5_MOBILE_TAB_LABEL[id]} pakete`}
                  className={styles.tierTabBtn}
                  onClick={() => setSelectedId(id)}
                >
                  {active ? (
                    <motion.span
                      layoutId="tp5-tab-pill-mobile"
                      className={styles.tierTabPill}
                      transition={TAB_TRANSITION}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`${styles.tierTabLabel} ${styles.tierTabLabelCompact} ${active ? styles.tierTabLabelActive : styles.tierTabLabelInactive}`}
                  >
                    {TP5_MOBILE_TAB_LABEL[id]}
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>

        <div className={styles.tierMeta} aria-live="polite">
          <p className={styles.tierMetaTitle}>{tierMeta.title}</p>
          <p className={styles.tierMetaDesc}>{tierMeta.description}</p>
        </div>
      </div>

      <div
        className={styles.featureStack}
        onTouchStart={onSwipeAreaTouchStart}
        onTouchEnd={onSwipeAreaTouchEnd}
      >
        {activeRows.length > 0 ? (
          <div className={styles.liquidAccent} data-tier={selectedId}>
            <ul className={styles.featureList}>
              {activeRows.map((row, index) => (
                <MobileFeatureRow
                  key={row.id}
                  row={row}
                  index={index}
                  reducedMotion={!!reducedMotion}
                  active
                />
              ))}
            </ul>
          </div>
        ) : null}

        {inactiveRows.length > 0 ? (
          <div className={styles.inactiveGroup}>
            <ul className={styles.featureList}>
              {inactiveRows.map((row, index) => (
                <MobileFeatureRow
                  key={row.id}
                  row={row}
                  index={activeRows.length + index}
                  reducedMotion
                  active={false}
                />
              ))}
            </ul>
          </div>
        ) : null}

        <div
          className={styles.inlineFields}
          onTouchStart={stopSwipePropagation}
          onTouchEnd={stopSwipePropagation}
        >
          <input
            type="text"
            className={`${styles.inlineInput} ${errors.vin ? styles.inlineInputError : ""}`}
            value={vin}
            onChange={(event) => onVinChange(event.target.value.toUpperCase())}
            placeholder="Ievadi VIN kodu"
            aria-label="Ievadi VIN kodu"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={17}
          />
          {errors.vin ? <p className={styles.inlineFieldError}>{errors.vin}</p> : null}
          <input
            type="url"
            className={`${styles.inlineInput} ${errors.listingUrl ? styles.inlineInputError : ""}`}
            value={listingUrl}
            onChange={(event) => onListingUrlChange(event.target.value)}
            placeholder="Iekopē sludinājuma linku"
            aria-label="Iekopē sludinājuma linku"
            autoComplete="url"
            inputMode="url"
          />
          {errors.listingUrl ? (
            <p className={styles.inlineFieldError}>{errors.listingUrl}</p>
          ) : null}
        </div>
      </div>

      <p className={styles.turnaround}>{TP5_MOBILE_TURNAROUND}</p>

      <div className={styles.ctaWrap}>
        {globalError ? <p className={styles.checkoutError}>{globalError}</p> : null}
        <button type="button" className={styles.liquidCta} onClick={onSubmit} disabled={loading}>
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>{TP5_MOBILE_CTA_LABEL[selectedId]}</span>
        </button>
        <p className={styles.featureFootnote}>{TP5_DEALER_FOOTNOTE}</p>
      </div>
    </article>
  );
}
