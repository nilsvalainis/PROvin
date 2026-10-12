"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import type { MiniCsddModalVariant } from "@/lib/mini-csdd-eligibility";
import {
  getTp5MiniConfirmCopy,
  miniConfirmBody,
  miniConfirmTitle,
} from "@/lib/test-pricing-5-mini-confirm";

type Props = {
  open: boolean;
  variant: MiniCsddModalVariant;
  locale?: string;
  onContinueMini: () => void;
  onSwitchAudits: () => void;
  onClose: () => void;
};

export function Tp5MiniConfirmModal({
  open,
  variant,
  locale,
  onContinueMini,
  onSwitchAudits,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const copy = getTp5MiniConfirmCopy(locale);
  const title = miniConfirmTitle(copy, variant);
  const body = miniConfirmBody(copy, variant);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className={styles.miniConfirmRoot} role="presentation">
      <button
        type="button"
        className={styles.miniConfirmBackdrop}
        aria-label={copy.closeAria}
        onClick={onClose}
      />
      <div className={styles.miniConfirmLayer}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={styles.miniConfirmPanel}
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id={titleId} className={styles.miniConfirmTitle}>
            {title}
          </h2>
          {variant === "warning" ? (
            <p className={styles.miniConfirmWarn}>{copy.warnBar}</p>
          ) : null}
          {body.split("\n\n").map((paragraph) => (
            <p key={paragraph} className={styles.miniConfirmBody}>
              {paragraph}
            </p>
          ))}
          <div className={styles.miniConfirmActions}>
            <button type="button" className={styles.miniConfirmPrimary} onClick={onContinueMini}>
              {copy.continueMini}
            </button>
            <button type="button" className={styles.miniConfirmSecondary} onClick={onSwitchAudits}>
              {copy.switchAudits}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
