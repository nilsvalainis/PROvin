"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const reduceMotion = useReducedMotion();

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

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const mq = window.matchMedia("(max-width: 767.98px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
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

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              className={styles.dealerBrandsBackdrop}
              aria-label={copy.dealerBrandsClose}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.22 }}
              onClick={() => setOpen(false)}
            />
            <div className={styles.dealerBrandsPopupLayer}>
              <motion.div
                id={dialogId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={styles.dealerBrandsPopup}
                onClick={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                initial={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, y: 14, scale: 0.94, filter: "blur(6px)" }
                }
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                }
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 10, scale: 0.96, filter: "blur(4px)" }
                }
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { type: "spring", stiffness: 420, damping: 28, mass: 0.7 }
                }
              >
                <div className={styles.dealerBrandsPopupGlow} aria-hidden />
                <div className={styles.dealerBrandsPopupHead}>
                  <div className={styles.dealerBrandsPopupHeadText}>
                    <p id={titleId} className={styles.dealerBrandsPopupTitle}>
                      {copy.dealerBrandsAria}
                    </p>
                    <p className={styles.dealerBrandsPopupCount}>{brands.length}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.dealerBrandsPopupClose}
                    aria-label={copy.dealerBrandsClose}
                    onClick={() => setOpen(false)}
                  >
                    <span aria-hidden>×</span>
                  </button>
                </div>
                <div className={styles.dealerBrandsPopupDivider} aria-hidden />
                <ul className={styles.dealerBrandsPopupGrid}>
                  {brands.map((brand, index) => (
                    <motion.li
                      key={brand}
                      className={styles.dealerBrandItem}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : {
                              delay: 0.04 + index * 0.018,
                              duration: 0.28,
                              ease: [0.22, 1, 0.36, 1],
                            }
                      }
                    >
                      <span className={styles.dealerBrandChip}>{brand}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
