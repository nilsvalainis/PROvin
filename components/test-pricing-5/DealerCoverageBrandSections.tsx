"use client";

import { useId } from "react";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { TP5_DEALER_COVERAGE_TIERS } from "@/lib/dealer-brands";
import {
  getDealerCoverageTierCopy,
  type DealerCoverageCopy,
} from "@/lib/test-pricing-5-ui-copy";

type Props = {
  copy: DealerCoverageCopy;
  /** Screen-reader name for the whole brand list. */
  ariaLabel: string;
};

/** Three headed coverage blocks: full / workshop remarks / limited. */
export function DealerCoverageBrandSections({ copy, ariaLabel }: Props) {
  const headingId = useId();
  return (
    <div className={styles.dealerCoverageStack} aria-label={ariaLabel}>
      {TP5_DEALER_COVERAGE_TIERS.map((tier) => {
        const { title, body } = getDealerCoverageTierCopy(copy, tier.id);
        const heading = `${headingId}-${tier.id}`;
        return (
          <section key={tier.id} className={styles.dealerCoverageBlock} aria-labelledby={heading}>
            <h3 id={heading} className={styles.dealerBrandHeading}>
              {title}
              <span className={styles.dealerCoverageCount}> ({tier.brands.length})</span>
            </h3>
            <p className={styles.dealerCoverageBody}>{body}</p>
            <ul className={styles.dealerBrandsPopupGrid}>
              {tier.brands.map((brand) => (
                <li key={brand} className={styles.dealerBrandItem}>
                  <span className={styles.dealerBrandChip}>{brand}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
