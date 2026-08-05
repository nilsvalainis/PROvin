"use client";

import { useEffect, useId, useRef } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import type { Tp5MobileFeature } from "@/lib/test-pricing-5-mobile";
import type { Tp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  features: Tp5MobileFeature[];
  footnote?: string;
  brands?: readonly string[];
  brandsHeading?: string;
  brandsYearNote?: string;
  brandsRefundNote?: string;
  extraNote?: string;
  closeLabel: string;
};

const MARK =
  "inline-flex h-[1.15rem] w-[1.15rem] shrink-0 items-center justify-center text-[0.95rem] font-bold leading-none";

function ModalFeatureRow({ feature }: { feature: Tp5MobileFeature }) {
  if (feature.included) {
    return (
      <li className={styles.featuresModalRow}>
        <span className={`${MARK} text-[#2563EB]`} aria-hidden>
          ✓
        </span>
        <span className={styles.featureLabelActive}>{feature.name}</span>
      </li>
    );
  }
  return (
    <li className={styles.featuresModalRow}>
      <span className={`${MARK} text-[#ef4444]`} aria-hidden>
        ✕
      </span>
      <span className={styles.featureLabelMuted}>{feature.name}</span>
    </li>
  );
}

/** Full package checklist modal for MINI / AUDITS / dealer. */
export function Tp5FeaturesModal({
  open,
  onClose,
  title,
  features,
  footnote,
  brands,
  brandsHeading,
  brandsYearNote,
  brandsRefundNote,
  extraNote,
  closeLabel,
}: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.featuresModalRoot} role="presentation">
      <button
        type="button"
        className={styles.featuresModalBackdrop}
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={styles.featuresModalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.featuresModalHead}>
          <h2 id={titleId} className={styles.featuresModalTitle}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.featuresModalClose}
            aria-label={closeLabel}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <ul className={styles.featuresModalList}>
          {features.map((feature) => (
            <ModalFeatureRow key={feature.name} feature={feature} />
          ))}
        </ul>
        {extraNote ? <p className={styles.dealerExplainNote}>{extraNote}</p> : null}
        {brands && brands.length > 0 ? (
          <div className={styles.featuresModalBrands}>
            {brandsHeading ? (
              <p className={styles.dealerBrandHeading}>{brandsHeading}</p>
            ) : null}
            {brandsYearNote ? (
              <p className={styles.dealerBrandsYearNote}>{brandsYearNote}</p>
            ) : null}
            <ul className={styles.dealerBrandsPopupGrid}>
              {brands.map((brand) => (
                <li key={brand} className={styles.dealerBrandItem}>
                  <span className={styles.dealerBrandCheck} aria-hidden>
                    ✓
                  </span>
                  <span>{brand}</span>
                </li>
              ))}
            </ul>
            {brandsRefundNote ? (
              <p className={styles.dealerBrandsRefundNote}>{brandsRefundNote}</p>
            ) : null}
          </div>
        ) : null}
        {footnote?.trim() ? <p className={styles.featuresModalFootnote}>{footnote}</p> : null}
      </div>
    </div>
  );
}

export type Tp5FeaturesModalCopy = Pick<
  Tp5UiCopy,
  "dealerBrandsClose" | "dealerBrandsYearNote" | "dealerBrandsRefundNote"
>;
