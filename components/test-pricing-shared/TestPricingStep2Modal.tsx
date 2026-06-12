"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import styles from "@/components/test-pricing-shared/test-pricing-modal.module.css";
import { normalizeVin } from "@/lib/order-field-validation";
import { getTestPricingCheckoutFormCopy } from "@/lib/test-pricing-checkout-copy";
import {
  getTestPricingPlan,
  validateTestPricingStep2,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";

type Props = {
  planId: TestPricingPlanId;
  open: boolean;
  onClose: () => void;
  sourcePage: "test-pricing-2" | "test-pricing-3" | "test-pricing-4" | "test-pricing-5";
};

export function TestPricingStep2Modal({ planId, open, onClose, sourcePage }: Props) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const plan = getTestPricingPlan(planId);
  const [listingUrl, setListingUrl] = useState("");
  const [vin, setVin] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ listingUrl?: string; vin?: string; consent?: string }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = useCallback(async () => {
    if (!plan) return;
    setGlobalError(null);
    const validation = validateTestPricingStep2(plan, listingUrl, vin, consent);
    if (!validation.ok) {
      setErrors(validation.errors);
      if (validation.errors.consent) setGlobalError(validation.errors.consent);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/checkout/test-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          locale: "lv",
          listingUrl: listingUrl.trim(),
          vin: normalizeVin(vin),
          withdrawalConsent: consent,
          sourcePage,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        errors?: string[];
      };
      if (!res.ok || !data.url) {
        throw new Error(data.errors?.[0] ?? data.error ?? "Neizdevās sākt maksājumu.");
      }
      window.location.href = data.url;
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Neizdevās sākt maksājumu.");
    } finally {
      setLoading(false);
    }
  }, [consent, listingUrl, plan, planId, sourcePage, vin]);

  if (!open || !plan) return null;

  const formCopy = getTestPricingCheckoutFormCopy(planId);

  return (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.modalTitle}>
          {formCopy.title}
        </h2>
        <p className={styles.modalLead}>{formCopy.lead}</p>

        {globalError ? <p className={styles.modalGlobalError}>{globalError}</p> : null}

        <div className={styles.modalFields}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${sourcePage}-listing`}>
              Sludinājuma saite (nav obligāti)
            </label>
            <input
              ref={firstFieldRef}
              id={`${sourcePage}-listing`}
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="Iekopē linku..."
              className={`${styles.fieldInput} ${errors.listingUrl ? styles.fieldInputError : ""}`}
              value={listingUrl}
              onChange={(e) => {
                setListingUrl(e.target.value);
                setErrors((p) => ({ ...p, listingUrl: undefined }));
              }}
            />
            {errors.listingUrl ? <p className={styles.fieldError}>{errors.listingUrl}</p> : null}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${sourcePage}-vin`}>
              VIN kods vai numurzīme <span className={styles.requiredMark}>*</span>
            </label>
            <input
              id={`${sourcePage}-vin`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={17}
              placeholder="Ievadi VIN kodu vai numurzīmi"
              className={`${styles.fieldInput} ${errors.vin ? styles.fieldInputError : ""}`}
              value={vin}
              onChange={(e) => {
                setVin(e.target.value.toUpperCase());
                setErrors((p) => ({ ...p, vin: undefined }));
              }}
            />
            {errors.vin ? <p className={styles.fieldError}>{errors.vin}</p> : null}
          </div>

          <label className={styles.consentRow}>
            <input
              type="checkbox"
              className={styles.consentCheckbox}
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setErrors((p) => ({ ...p, consent: undefined }));
                if (e.target.checked) setGlobalError(null);
              }}
            />
            <span className={styles.consentText}>
              Apstiprinu{" "}
              <Link href="/lv/lietosanas-noteikumi" target="_blank" rel="noopener noreferrer">
                lietošanas noteikumus
              </Link>
              ,{" "}
              <Link href="/lv/privatuma-politika" target="_blank" rel="noopener noreferrer">
                privātuma politiku
              </Link>{" "}
              un piekrītu digitālā satura tūlītējai izpildei (atteikuma tiesību zaudēšana).
            </span>
          </label>
          {errors.consent && !globalError ? (
            <p className={styles.fieldError}>{errors.consent}</p>
          ) : null}
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={`${demoStyles.ctaButton} ${styles.ctaBtn}`}
            disabled={loading}
            onClick={() => void submit()}
          >
            {loading ? "Novirza uz Stripe…" : plan.heroCtaLabel}
          </button>
          <button type="button" className={styles.modalDismiss} onClick={onClose}>
            Atcelt
          </button>
        </div>
      </div>
    </div>
  );
}
