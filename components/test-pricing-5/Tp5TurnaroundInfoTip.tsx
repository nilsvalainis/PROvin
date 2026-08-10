"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import {
  TP5_TURNAROUND_INFO_PHONE_TEL,
  type Tp5UiCopy,
} from "@/lib/test-pricing-5-ui-copy";

type Props = {
  copy: Pick<
    Tp5UiCopy,
    | "turnaroundUrgencyCta"
    | "turnaroundInfoAria"
    | "turnaroundInfoBody"
    | "turnaroundInfoPhoneLink"
  >;
};

function canHoverFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** «Steidzami?» + i — visa zona atver tipu; hover tikai peles/trackpad ierīcēs. */
export function Tp5TurnaroundInfoTip({ copy }: Props) {
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
      className={styles.turnaroundInfo}
      onMouseEnter={() => {
        if (canHoverFinePointer()) setOpen(true);
      }}
      onMouseLeave={() => {
        if (canHoverFinePointer()) setOpen(false);
      }}
    >
      <button
        type="button"
        className={styles.turnaroundUrgencyHit}
        aria-label={`${copy.turnaroundUrgencyCta}. ${copy.turnaroundInfoAria}`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={toggle}
        onTouchStart={stopSwipe}
        onTouchEnd={stopSwipe}
      >
        <span className={styles.turnaroundUrgency}>{copy.turnaroundUrgencyCta}</span>
        <span className={styles.turnaroundInfoBtn} aria-hidden>
          <span>i</span>
        </span>
      </button>
      {open ? (
        <span id={tipId} role="tooltip" className={styles.turnaroundInfoPopup}>
          <span className={styles.turnaroundInfoPopupText}>{copy.turnaroundInfoBody}</span>
          <a
            href={`tel:${TP5_TURNAROUND_INFO_PHONE_TEL}`}
            className={styles.turnaroundInfoPhone}
            onClick={(event) => event.stopPropagation()}
          >
            {copy.turnaroundInfoPhoneLink}
          </a>
        </span>
      ) : null}
    </span>
  );
}
