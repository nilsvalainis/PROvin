"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import type { Tp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

type Props = {
  brands: readonly string[];
  copy: Pick<Tp5UiCopy, "dealerBrandsTrigger" | "dealerBrandsAria" | "dealerBrandsClose">;
};

/** „Atbalstītie ražotāji ⓘ” — opens a compact brands-only dialog. */
export function Tp5DealerBrandsTip({ brands, copy }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dialogId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.dealerBrandsTip}>
      <button
        type="button"
        className={styles.dealerBrandsTrigger}
        aria-label={copy.dealerBrandsAria}
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span>{copy.dealerBrandsTrigger}</span>
        <span className={styles.dealerBrandsTriggerInfo} aria-hidden>
          i
        </span>
      </button>

      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className={styles.dealerBrandsPopup}
          onClick={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          <div className={styles.dealerBrandsPopupHead}>
            <p id={titleId} className={styles.dealerBrandsPopupTitle}>
              {copy.dealerBrandsAria}
            </p>
            <button
              type="button"
              className={styles.dealerBrandsPopupClose}
              aria-label={copy.dealerBrandsClose}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
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
        </div>
      ) : null}
    </div>
  );
}
