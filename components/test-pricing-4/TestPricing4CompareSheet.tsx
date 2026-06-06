"use client";

import { useEffect, useId } from "react";
import styles from "@/app/test-pricing-4/test-pricing-4.module.css";
import {
  TEST_PRICING_COMPARE_LABELS,
  TEST_PRICING_COMPARE_PRICES,
  TEST_PRICING_COMPARE_ROWS,
} from "@/lib/test-pricing-compare-matrix";
import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

type Props = {
  open: boolean;
  activePlanId: TestPricingPlanId;
  onClose: () => void;
  onSelectPlan: (id: TestPricingPlanId) => void;
};

const TIERS: TestPricingPlanId[] = ["mini", "plus", "premium"];

function CellMark({ included }: { included: boolean }) {
  if (included) {
    return (
      <span className={styles.matrixMark} aria-hidden>
        ✔
      </span>
    );
  }
  return (
    <span className={`${styles.matrixMark} ${styles.matrixMarkCross}`} aria-hidden>
      ✕
    </span>
  );
}

export function TestPricing4CompareSheet({
  open,
  activePlanId,
  onClose,
  onSelectPlan,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.sheetOverlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.sheetPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHandle} aria-hidden />
        <div className={styles.sheetHeader}>
          <h2 id={titleId} className={styles.sheetTitle}>
            Salīdzini paketes
          </h2>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Aizvērt">
            ✕
          </button>
        </div>

        <div className={styles.matrixScroll}>
          <table className={styles.matrixTable}>
            <thead>
              <tr>
                <th className={styles.matrixFeatureHead}>Iekļauts</th>
                {TIERS.map((tier) => (
                  <th key={tier} className={styles.matrixTierHead}>
                    <span className={styles.matrixTierName}>{TEST_PRICING_COMPARE_LABELS[tier]}</span>
                    <span className={styles.matrixTierPrice}>{TEST_PRICING_COMPARE_PRICES[tier]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEST_PRICING_COMPARE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className={styles.matrixFeatureCell}>{row.label}</td>
                  <td className={styles.matrixCell}>
                    <CellMark included={row.mini} />
                  </td>
                  <td className={styles.matrixCell}>
                    <CellMark included={row.plus} />
                  </td>
                  <td className={styles.matrixCell}>
                    <CellMark included={row.premium} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.sheetActions}>
          {TIERS.map((tier) => {
            const isActive = tier === activePlanId;
            const label =
              tier === "premium"
                ? isActive
                  ? "Atpakaļ uz Premium"
                  : "Izvēlēties PREMIUM"
                : tier === "mini"
                  ? "Izvēlēties MINI"
                  : "Izvēlēties PLUS";
            return (
              <button
                key={tier}
                type="button"
                className={`${styles.sheetPickBtn} ${isActive ? styles.sheetPickBtnActive : ""}`}
                onClick={() => onSelectPlan(tier)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
