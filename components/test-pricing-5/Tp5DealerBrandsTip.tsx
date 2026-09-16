"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { DealerHeroBrandChips } from "@/components/test-pricing-5/DealerHeroBrandChips";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import {
  DEALER_BRANDS_HUD_VIEWPORT_MIN_PX,
  requestDealerBrandsHud,
} from "@/lib/dealer-brands";
import type { DealerBrandsTipCopy } from "@/lib/test-pricing-5-ui-copy";

type Props = {
  brands: readonly string[];
  copy: DealerBrandsTipCopy;
};

function desktopHudMq(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  return window.matchMedia(`(min-width: ${DEALER_BRANDS_HUD_VIEWPORT_MIN_PX}px)`);
}

/** „Atbalstītie ražotāji ⓘ” — desktop HUD on the left rail, phone keeps a dialog. */
export function Tp5DealerBrandsTip({ brands, copy }: Props) {
  const [open, setOpen] = useState(false);
  const [useHud, setUseHud] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dialogId = useId();
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const mq = desktopHudMq();
    if (!mq) return;
    const sync = () => {
      setUseHud(mq.matches);
      if (mq.matches) setOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
        aria-expanded={useHud ? undefined : open}
        aria-controls={useHud ? undefined : dialogId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (useHud) {
            requestDealerBrandsHud();
            return;
          }
          setOpen((prev) => !prev);
        }}
      >
        <span>{copy.dealerBrandsTrigger}</span>
        <span className={styles.dealerBrandsTriggerInfo} aria-hidden>
          i
        </span>
      </button>

      <AnimatePresence>
        {!useHud && open ? (
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
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.94 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { type: "spring", stiffness: 420, damping: 28, mass: 0.7 }
                }
              >
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
                <DealerHeroBrandChips
                  ariaLabel={copy.dealerBrandsAria}
                  embedded
                  enableHud={false}
                  className={styles.dealerHeroBrandChipsPopup}
                />
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
