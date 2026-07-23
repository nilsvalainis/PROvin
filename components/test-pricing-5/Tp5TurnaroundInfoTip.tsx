"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import {
  TP5_TURNAROUND_INFO_PHONE_TEL,
  type Tp5UiCopy,
} from "@/lib/test-pricing-5-ui-copy";

type Props = {
  copy: Pick<Tp5UiCopy, "turnaroundInfoAria" | "turnaroundInfoBody" | "turnaroundInfoPhoneLabel">;
};

/** Mazs „i” pie izpildes laika — hover un klikšķis atver skaidrojumu. */
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

  return (
    <span
      ref={rootRef}
      className={styles.turnaroundInfo}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.turnaroundInfoBtn}
        aria-label={copy.turnaroundInfoAria}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        i
      </button>
      {open ? (
        <span id={tipId} role="tooltip" className={styles.turnaroundInfoPopup}>
          <span className={styles.turnaroundInfoPopupText}>{copy.turnaroundInfoBody}</span>
          <a
            href={`tel:${TP5_TURNAROUND_INFO_PHONE_TEL}`}
            className={styles.turnaroundInfoPhone}
            onClick={(event) => event.stopPropagation()}
          >
            {copy.turnaroundInfoPhoneLabel}
          </a>
        </span>
      ) : null}
    </span>
  );
}
