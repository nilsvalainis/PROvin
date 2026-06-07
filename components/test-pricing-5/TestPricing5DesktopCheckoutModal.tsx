"use client";

import { useCallback, useEffect, useId, useRef, type MouseEvent } from "react";
import styles from "@/app/test-pricing-5/test-pricing-5.module.css";
import { TP5_TIER_META } from "@/lib/test-pricing-5-checkout-routing";
import type { Tp5InlineFieldErrors } from "@/lib/test-pricing-5-inline-checkout";
import { getTestPricingPlan, type TestPricingPlanId } from "@/lib/test-pricing-plans";

type TestPricing5DesktopCheckoutModalProps = {
  planId: TestPricingPlanId | null;
  open: boolean;
  vin: string;
  listingUrl: string;
  errors: Tp5InlineFieldErrors;
  globalError: string | null;
  loading: boolean;
  onClose: () => void;
  onVinChange: (value: string) => void;
  onListingUrlChange: (value: string) => void;
  onSubmit: () => void;
};

export function TestPricing5DesktopCheckoutModal({
  planId,
  open,
  vin,
  listingUrl,
  errors,
  globalError,
  loading,
  onClose,
  onVinChange,
  onListingUrlChange,
  onSubmit,
}: TestPricing5DesktopCheckoutModalProps) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const plan = planId ? getTestPricingPlan(planId) : null;
  const tierMeta = planId ? TP5_TIER_META[planId] : null;

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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open || !planId || !plan || !tierMeta) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-8 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-lg leading-none text-white/70 transition hover:border-white/20 hover:text-white"
          aria-label="Aizvērt"
          onClick={onClose}
        >
          ×
        </button>

        <h2 id={titleId} className="m-0 pr-10 text-lg font-bold leading-snug text-white">
          Noformēt pasūtījumu: {tierMeta.title}
        </h2>

        <div className={`${styles.inlineFields} lg:mt-6`}>
          <input
            ref={firstFieldRef}
            type="text"
            className={`${styles.inlineInput} ${errors.vin ? styles.inlineInputError : ""}`}
            value={vin}
            onChange={(event) => onVinChange(event.target.value.toUpperCase())}
            placeholder="Ievadi VIN kodu"
            aria-label="Ievadi VIN kodu"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={17}
          />
          {errors.vin ? <p className={styles.inlineFieldError}>{errors.vin}</p> : null}
          <input
            type="url"
            className={`${styles.inlineInput} ${errors.listingUrl ? styles.inlineInputError : ""}`}
            value={listingUrl}
            onChange={(event) => onListingUrlChange(event.target.value)}
            placeholder="Iekopē sludinājuma linku"
            aria-label="Iekopē sludinājuma linku"
            autoComplete="url"
            inputMode="url"
          />
          {errors.listingUrl ? (
            <p className={styles.inlineFieldError}>{errors.listingUrl}</p>
          ) : null}
        </div>

        <p className={`${styles.turnaround} lg:mt-4`}>{plan.turnaround}</p>

        {globalError ? <p className={`${styles.checkoutError} lg:mt-3`}>{globalError}</p> : null}

        <button
          type="button"
          className={`${styles.liquidCta} lg:mt-6`}
          onClick={onSubmit}
          disabled={loading}
        >
          <span className={styles.liquidCtaShimmer} aria-hidden />
          <span className={styles.liquidCtaLabel}>
            {loading ? "Nosūta…" : "Turpināt uz apmaksu"}
          </span>
        </button>
      </div>
    </div>
  );
}
