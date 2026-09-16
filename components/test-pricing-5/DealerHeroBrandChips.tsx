"use client";

import { useEffect, useState } from "react";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import {
  DEALER_BRANDS_HUD_EVENT,
  dealerBrandsHudDurationMs,
  TP5_DEALER_COVERAGE_TIERS,
} from "@/lib/dealer-brands";

type Props = {
  ariaLabel: string;
  /** Accordion / nested lists: same type as the hero rail, without absolute positioning. */
  embedded?: boolean;
  className?: string;
  /** Popup copies of the grid do not listen for the desktop HUD. */
  enableHud?: boolean;
};

/** Unboxed OEM names, H1e coverage tone. Shared by the public hero rail and B2B accordion. */
export function DealerHeroBrandChips({
  ariaLabel,
  embedded = false,
  className,
  enableHud = true,
}: Props) {
  const [hudRun, setHudRun] = useState(0);

  useEffect(() => {
    if (!enableHud) return;
    const onHud = () => setHudRun((n) => n + 1);
    window.addEventListener(DEALER_BRANDS_HUD_EVENT, onHud);
    return () => window.removeEventListener(DEALER_BRANDS_HUD_EVENT, onHud);
  }, [enableHud]);

  useEffect(() => {
    if (!hudRun) return;
    const t = window.setTimeout(() => setHudRun(0), dealerBrandsHudDurationMs());
    return () => window.clearTimeout(t);
  }, [hudRun]);

  let index = 0;

  return (
    <ul
      key={hudRun || "idle"}
      className={`${styles.dealerHeroBrandChips}${embedded ? ` ${styles.dealerHeroBrandChipsEmbedded}` : ""}${hudRun ? ` ${styles.dealerHeroBrandChipsHud}` : ""}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
    >
      {TP5_DEALER_COVERAGE_TIERS.flatMap((tier) =>
        tier.brands.map((brand) => {
          const hudI = index;
          index += 1;
          return (
            <li key={brand} className={styles.dealerBrandItem}>
              <span
                className={`${styles.dealerBrandChip} ${
                  tier.id === "full"
                    ? styles.dealerHeroChipFull
                    : tier.id === "workshop"
                      ? styles.dealerHeroChipWorkshop
                      : styles.dealerHeroChipLimited
                }`}
                style={{ ["--hud-i" as string]: String(hudI) }}
              >
                {brand}
              </span>
            </li>
          );
        }),
      )}
    </ul>
  );
}
