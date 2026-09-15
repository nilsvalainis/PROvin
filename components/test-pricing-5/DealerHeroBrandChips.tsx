"use client";

import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import { TP5_DEALER_COVERAGE_TIERS } from "@/lib/dealer-brands";

type Props = {
  ariaLabel: string;
  /** Accordion / nested lists: same type as the hero rail, without absolute positioning. */
  embedded?: boolean;
  className?: string;
};

/** Unboxed OEM names, H1e coverage tone. Shared by the public hero rail and B2B accordion. */
export function DealerHeroBrandChips({ ariaLabel, embedded = false, className }: Props) {
  return (
    <ul
      className={`${styles.dealerHeroBrandChips}${embedded ? ` ${styles.dealerHeroBrandChipsEmbedded}` : ""}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
    >
      {TP5_DEALER_COVERAGE_TIERS.flatMap((tier) =>
        tier.brands.map((brand) => (
          <li key={brand} className={styles.dealerBrandItem}>
            <span
              className={`${styles.dealerBrandChip} ${
                tier.id === "full"
                  ? styles.dealerHeroChipFull
                  : tier.id === "workshop"
                    ? styles.dealerHeroChipWorkshop
                    : styles.dealerHeroChipLimited
              }`}
            >
              {brand}
            </span>
          </li>
        )),
      )}
    </ul>
  );
}
