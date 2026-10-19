"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/components/test-pricing-5/test-pricing-5.module.css";
import type { MiniCsddModalVariant } from "@/lib/mini-csdd-eligibility";
import { parseOptionalCheckoutEmail } from "@/lib/test-pricing-checkout-email";
import {
  getTp5MiniConfirmCopy,
  miniConfirmBody,
  miniConfirmTitle,
} from "@/lib/test-pricing-5-mini-confirm";

type MiniProps = {
  open: boolean;
  variant: MiniCsddModalVariant;
  locale?: string;
  onContinueMini: (email: string) => void;
  onSwitchAudits: (email: string) => void;
  onClose: () => void;
};

function usePortalOpen(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);

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

  return mounted && open;
}

function CheckoutEmailField({
  id,
  label,
  labelledBy,
  value,
  error,
  onChange,
}: {
  id: string;
  label?: string;
  labelledBy?: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.miniConfirmField}>
      {label ? (
        <label htmlFor={id} className={styles.miniConfirmLabel}>
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        aria-labelledby={labelledBy}
        className={`${styles.inlineInput} ${error ? styles.inlineInputError : ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className={styles.inlineFieldError}>{error}</p> : null}
    </div>
  );
}

export function Tp5MiniConfirmModal({
  open,
  variant,
  locale,
  onContinueMini,
  onSwitchAudits,
  onClose,
}: MiniProps) {
  const visible = usePortalOpen(open, onClose);
  const titleId = useId();
  const emailId = useId();
  const copy = getTp5MiniConfirmCopy(locale);
  const title = miniConfirmTitle(copy, variant);
  const body = miniConfirmBody(copy, variant);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setEmailError(null);
    }
  }, [open]);

  const submit = (next: (value: string) => void) => {
    const parsed = parseOptionalCheckoutEmail(email, copy.emailError);
    if (!parsed.ok) {
      setEmailError(parsed.error);
      return;
    }
    setEmailError(null);
    next(parsed.email ?? "");
  };

  if (!visible) return null;

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
          <p className={styles.miniConfirmBody}>{body}</p>
          {variant === "normal" ? (
            <>
              <p className={styles.miniConfirmListHeading}>{copy.includesHeading}</p>
              <ul className={styles.miniConfirmList}>
                <li className={styles.miniConfirmListItem}>
                  <span className={`${styles.miniConfirmDot} ${styles.miniConfirmDotInc}`} aria-hidden />
                  <span>{copy.includesItem}</span>
                </li>
                <li className={styles.miniConfirmListItem}>
                  <span className={`${styles.miniConfirmDot} ${styles.miniConfirmDotExc}`} aria-hidden />
                  <span>{copy.excludesItem}</span>
                </li>
              </ul>
            </>
          ) : null}
          <CheckoutEmailField
            id={emailId}
            label={copy.emailLabel}
            value={email}
            error={emailError}
            onChange={(value) => {
              setEmail(value);
              if (emailError) setEmailError(null);
            }}
          />
          <div className={styles.miniConfirmActions}>
            <button type="button" className={styles.miniConfirmPrimary} onClick={() => submit(onSwitchAudits)}>
              {copy.switchAudits}
            </button>
            <button type="button" className={styles.miniConfirmSecondary} onClick={() => submit(onContinueMini)}>
              {copy.continueMini}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type EmailModalProps = {
  open: boolean;
  locale?: string;
  onContinue: (email: string) => void;
  onClose: () => void;
};

/** Mazs e-pasta lauks pēc Pasūtīt (AUDITS u.c.). MINI lauku liek esošajā apstiprinājumā. */
export function Tp5CheckoutEmailModal({ open, locale, onContinue, onClose }: EmailModalProps) {
  const visible = usePortalOpen(open, onClose);
  const titleId = useId();
  const emailId = useId();
  const copy = getTp5MiniConfirmCopy(locale);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setEmailError(null);
    }
  }, [open]);

  if (!visible) return null;

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
            {copy.emailLabel}
          </h2>
          <CheckoutEmailField
            id={emailId}
            labelledBy={titleId}
            value={email}
            error={emailError}
            onChange={(value) => {
              setEmail(value);
              if (emailError) setEmailError(null);
            }}
          />
          <div className={styles.miniConfirmActions}>
            <button
              type="button"
              className={styles.miniConfirmPrimary}
              onClick={() => {
                const parsed = parseOptionalCheckoutEmail(email, copy.emailError);
                if (!parsed.ok) {
                  setEmailError(parsed.error);
                  return;
                }
                setEmailError(null);
                onContinue(parsed.email ?? "");
              }}
            >
              {copy.emailContinue}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
