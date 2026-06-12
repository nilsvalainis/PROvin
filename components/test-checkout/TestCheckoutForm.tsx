"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import demoStyles from "@/app/[locale]/demo/page.module.css";
import modalStyles from "@/components/test-pricing-shared/test-pricing-modal.module.css";
import styles from "@/app/test-checkout/test-checkout.module.css";
import { normalizeVin } from "@/lib/order-field-validation";
import { getTestPricingCheckoutFormCopy } from "@/lib/test-pricing-checkout-copy";
import {
  TP5_CHECKOUT_SOURCE,
  TP5_CTA_LABEL,
} from "@/lib/test-pricing-5-checkout-routing";
import {
  getTestPricingPlan,
  validateTestPricingStep2,
  type TestPricingPlanId,
} from "@/lib/test-pricing-plans";

type Props = {
  planId: TestPricingPlanId;
};

export function TestCheckoutForm({ planId }: Props) {
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const plan = getTestPricingPlan(planId);
  const [listingUrl, setListingUrl] = useState("");
  const [vin, setVin] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ listingUrl?: string; vin?: string; consent?: string }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          sourcePage: TP5_CHECKOUT_SOURCE,
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
  }, [consent, listingUrl, plan, planId, vin]);

  if (!plan) return null;

  const formCopy = getTestPricingCheckoutFormCopy(planId);

  return (
    <div className={styles.pageInner}>
      <article className={`${modalStyles.modalCard} ${styles.checkoutCard}`}>
        <h1 id={titleId} className={modalStyles.modalTitle}>
          {formCopy.title}
        </h1>
        <p className={modalStyles.modalLead}>{formCopy.lead}</p>

        {globalError ? <p className={modalStyles.modalGlobalError}>{globalError}</p> : null}

        <div className={modalStyles.modalFields}>
          <div className={modalStyles.field}>
            <label className={modalStyles.fieldLabel} htmlFor={`${TP5_CHECKOUT_SOURCE}-listing`}>
              Sludinājuma saite (nav obligāti)
            </label>
            <input
              ref={firstFieldRef}
              id={`${TP5_CHECKOUT_SOURCE}-listing`}
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="Iekopē linku..."
              className={`${modalStyles.fieldInput} ${errors.listingUrl ? modalStyles.fieldInputError : ""}`}
              value={listingUrl}
              onChange={(e) => {
                setListingUrl(e.target.value);
                setErrors((p) => ({ ...p, listingUrl: undefined }));
              }}
            />
            {errors.listingUrl ? <p className={modalStyles.fieldError}>{errors.listingUrl}</p> : null}
          </div>

          <div className={modalStyles.field}>
            <label className={modalStyles.fieldLabel} htmlFor={`${TP5_CHECKOUT_SOURCE}-vin`}>
              VIN kods vai numurzīme <span className={modalStyles.requiredMark}>*</span>
            </label>
            <input
              id={`${TP5_CHECKOUT_SOURCE}-vin`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={17}
              placeholder="Ievadi VIN kodu vai numurzīmi"
              className={`${modalStyles.fieldInput} ${errors.vin ? modalStyles.fieldInputError : ""}`}
              value={vin}
              onChange={(e) => {
                setVin(e.target.value.toUpperCase());
                setErrors((p) => ({ ...p, vin: undefined }));
              }}
            />
            {errors.vin ? <p className={modalStyles.fieldError}>{errors.vin}</p> : null}
          </div>

          <label className={modalStyles.consentRow}>
            <input
              type="checkbox"
              className={modalStyles.consentCheckbox}
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setErrors((p) => ({ ...p, consent: undefined }));
                if (e.target.checked) setGlobalError(null);
              }}
            />
            <span className={modalStyles.consentText}>
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
            <p className={modalStyles.fieldError}>{errors.consent}</p>
          ) : null}
        </div>

        <div className={modalStyles.modalActions}>
          <button
            type="button"
            className={`${demoStyles.ctaButton} ${modalStyles.ctaBtn}`}
            disabled={loading}
            onClick={() => void submit()}
          >
            {loading ? "Novirza uz Stripe…" : TP5_CTA_LABEL[planId]}
          </button>
          <Link href="/test-pricing-5" className={modalStyles.modalDismiss}>
            Atpakaļ
          </Link>
        </div>
      </article>
    </div>
  );
}
