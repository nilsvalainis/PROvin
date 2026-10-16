"use client";

import { useEffect } from "react";
import { fireGoogleAdsPurchaseConversion } from "@/lib/google-ads";
import { PROVIN_CONSENT_UPDATED_EVENT } from "@/lib/cookie-consent";

type Props = {
  transactionId: string;
  value: number;
  label: string;
};

/**
 * Stripe /paldies: viens `gtag('event','conversion')` uz sesijas/pasūtījuma id.
 * Nav UI. Bez `NEXT_PUBLIC_GADS_PURCHASE_LABEL` komponenti neliek.
 */
export function GoogleAdsPurchaseConversion({ transactionId, value, label }: Props) {
  useEffect(() => {
    if (!label || !transactionId) return;

    const tryFire = () => {
      if (typeof sessionStorage === "undefined") return false;
      return fireGoogleAdsPurchaseConversion({
        label,
        value,
        transactionId,
        storage: sessionStorage,
      });
    };

    if (tryFire()) return;

    const onConsent = () => {
      tryFire();
    };
    const interval = window.setInterval(() => {
      if (tryFire()) window.clearInterval(interval);
    }, 400);
    const stop = window.setTimeout(() => window.clearInterval(interval), 12_000);
    window.addEventListener(PROVIN_CONSENT_UPDATED_EVENT, onConsent);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
      window.removeEventListener(PROVIN_CONSENT_UPDATED_EVENT, onConsent);
    };
  }, [label, transactionId, value]);

  return null;
}
