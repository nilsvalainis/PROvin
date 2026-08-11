"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import type { Tp5UiCopy } from "@/lib/test-pricing-5-ui-copy";

type Props = {
  copy: Pick<Tp5UiCopy, "dealerRefundBanner" | "dealerRefundInfoBody" | "dealerRefundInfoAria">;
};

function canHoverFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function Tp5DealerRefundTip({ copy }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const tipId = useId();

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

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen((prev) => !prev);
  }

  function stopSwipe(event: TouchEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  return (
    <span
      ref={rootRef}
      className={styles.dealerRefundTip}
      onMouseEnter={() => {
        if (canHoverFinePointer()) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHoverFinePointer()) setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.dealerRefundHit}
        aria-label={`${copy.dealerRefundBanner} ${copy.dealerRefundInfoAria}`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={toggle}
        onTouchStart={stopSwipe}
        onTouchEnd={stopSwipe}
      >
        <span className={styles.dealerRefundLabel}>{copy.dealerRefundBanner}</span>
        <span className={styles.dealerRefundInfoBtn} aria-hidden>
          <span>i</span>
        </span>
      </button>
      {open ? (
        <span id={tipId} role="tooltip" className={styles.dealerRefundPopup}>
          <span className={styles.dealerRefundPopupText}>{copy.dealerRefundInfoBody}</span>
        </span>
      ) : null}
    </span>
  );
}
