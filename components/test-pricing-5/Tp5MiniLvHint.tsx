"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";

type Props = {
  tip: string;
};

function canHoverFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Flag + circular i after PROVIN MINI. Popover is absolute and does not change layout. */
export function Tp5MiniLvHint({ tip }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const skipClickRef = useRef(false);
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
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    setOpen((prev) => !prev);
  }

  function stopSwipe(event: TouchEvent<HTMLButtonElement>) {
    event.stopPropagation();
  }

  return (
    <span className={styles.miniTitleTagline} ref={rootRef}>
      <span className={styles.lvFlag} aria-hidden />
      <button
        type="button"
        className={styles.miniLvInfoBtn}
        aria-label={tip}
        aria-expanded={open}
        aria-controls={tipId}
        aria-describedby={open ? tipId : undefined}
        onClick={toggle}
        onFocus={() => {
          if (canHoverFinePointer()) return;
          skipClickRef.current = true;
          setOpen(true);
        }}
        onMouseEnter={() => {
          if (canHoverFinePointer()) setOpen(true);
        }}
        onMouseLeave={() => {
          if (canHoverFinePointer()) setOpen(false);
        }}
        onTouchStart={stopSwipe}
        onTouchEnd={stopSwipe}
      >
        <span aria-hidden>i</span>
      </button>
      {open ? (
        <span id={tipId} role="tooltip" className={styles.miniLvInfoPopup}>
          {tip}
        </span>
      ) : null}
    </span>
  );
}
